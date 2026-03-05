export const dynamic = "force-dynamic"
/**
 * POST /api/auth/send-otp
 * 
 * Generates a 6-digit OTP, stores hash in Firestore, sends email via SendGrid.
 * Follows existing patterns from /api/users/create and /api/external-notifications/send
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import {
    generateOTP,
    hashOTP,
    getCompanyBranding,
    generateOTPEmailHTML,
    OTP_EXPIRY_MINUTES,
    OTP_MAX_ATTEMPTS,
    RATE_LIMIT_WINDOW_MINUTES,
    RATE_LIMIT_MAX_REQUESTS,
} from '@/lib/services/auth/password-reset-service';
import type { SendOTPRequest, SendOTPResponse } from '@/types/password-reset';

export async function POST(request: NextRequest): Promise<NextResponse<SendOTPResponse>> {
    try {
        // Parse request body
        const body: SendOTPRequest & { groupId?: string } = await request.json();
        const { email, companyId, type, groupId } = body;

        // Use groupId if provided, fallback to companyId for multi-tenant structure
        const effectiveGroupId = groupId || companyId;

        // Validate required fields
        if (!email || !companyId || !type) {
            return NextResponse.json({
                success: false,
                message: 'Missing required fields',
                error: 'email, companyId, and type are required',
                code: 'INVALID_REQUEST',
            }, { status: 400 });
        }

        // Validate email format
        if (!email.includes('@')) {
            return NextResponse.json({
                success: false,
                message: 'Invalid email format',
                error: 'Please provide a valid email address',
                code: 'INVALID_REQUEST',
            }, { status: 400 });
        }

        const adminFirestore = getAdminFirestore();

        // Find user by email in the company (Enterprise structure)
        // First try group-level users
        const groupUsersRef = adminFirestore
            .collection('enterpriseGroups')
            .doc(effectiveGroupId)
            .collection('users');

        let userQuery = await groupUsersRef.where('email', '==', email.toLowerCase()).limit(1).get();

        // Fallback to company-level users if not found in group
        if (userQuery.empty) {
            const companyUsersRef = adminFirestore
                .collection('enterpriseGroups')
                .doc(effectiveGroupId)
                .collection('companies')
                .doc(companyId)
                .collection('users');
            userQuery = await companyUsersRef.where('email', '==', email.toLowerCase()).limit(1).get();
        }

        if (userQuery.empty) {
            return NextResponse.json({
                success: false,
                message: 'Email not found',
                error: 'No account found with this email address',
                code: 'USER_NOT_FOUND',
            }, { status: 404 });
        }

        const userDoc = userQuery.docs[0];
        if (!userDoc) {
            return NextResponse.json({
                success: false,
                message: 'User data not found',
                code: 'USER_NOT_FOUND',
            }, { status: 404 });
        }
        const userId = userDoc.id;

        // Rate limiting: Check recent OTP requests for this email
        const otpsRef = adminFirestore
            .collection('enterpriseGroups')
            .doc(effectiveGroupId)
            .collection('companies')
            .doc(companyId)
            .collection('password_reset_otps');

        const rateLimitWindow = new Date();
        rateLimitWindow.setMinutes(rateLimitWindow.getMinutes() - RATE_LIMIT_WINDOW_MINUTES);

        // Optimized: Only filter by email to avoid ANY composite index requirements.
        // We sort and filter by time in-memory.
        const recentOTPsQuery = await otpsRef
            .where('email', '==', email.toLowerCase())
            .limit(RATE_LIMIT_MAX_REQUESTS + 5) // Get a few extra to be safe
            .get();

        const windowStart = rateLimitWindow.getTime();
        const tooManyRequests = recentOTPsQuery.docs.filter((doc: any) => {
            const createdAt = doc.data().createdAt?.toDate();
            return createdAt && createdAt.getTime() >= windowStart;
        }).length >= RATE_LIMIT_MAX_REQUESTS;

        if (tooManyRequests) {
            return NextResponse.json({
                success: false,
                message: 'Too many requests',
                error: `Please wait ${RATE_LIMIT_WINDOW_MINUTES} minutes before requesting another code`,
                code: 'RATE_LIMITED',
            }, { status: 429 });
        }

        // Generate OTP
        const otp = generateOTP();
        const otpHash = hashOTP(otp);

        // Calculate expiry
        const now = new Date();
        const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

        // Store OTP in Firestore
        const otpDocRef = await otpsRef.add({
            email: email.toLowerCase(),
            userId,
            otpHash,
            type,
            expiresAt: Timestamp.fromDate(expiresAt),
            attempts: 0,
            maxAttempts: OTP_MAX_ATTEMPTS,
            used: false,
            createdAt: Timestamp.now(),
        });

        // Get company branding for email
        const branding = await getCompanyBranding(companyId, effectiveGroupId);

        // Generate email HTML
        const emailHTML = generateOTPEmailHTML(branding, otp, type);

        // Send email via existing SendGrid integration
        try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            const notificationUrl = baseUrl.includes('localhost')
                ? `${baseUrl}/api/external-notifications/send`
                : `${process.env.APP_URL || baseUrl}/api/external-notifications/send`;

            const emailResponse = await fetch(notificationUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyId,
                    groupId: effectiveGroupId,
                    channel: 'email',
                    recipientEmail: email,
                    subject: type === 'forgot' ? 'Reset Your Password' : 'Verify Password Change',
                    messageBody: emailHTML,
                    eventType: 'system_announcement',
                    priority: 'high',
                }),
            });

            const emailResult = await emailResponse.json();

            if (!emailResult.success && !emailResult.channels?.email?.sent) {
                console.error('SendGrid error:', emailResult);
                // Delete the OTP doc since email failed
                await otpDocRef.delete();

                return NextResponse.json({
                    success: false,
                    message: 'Failed to send email',
                    error: 'Could not send verification email. Please try again.',
                    code: 'EMAIL_FAILED',
                }, { status: 500 });
            }
        } catch (emailError) {
            console.error('Email send error:', emailError);
            await otpDocRef.delete();

            return NextResponse.json({
                success: false,
                message: 'Failed to send email',
                error: 'Could not send verification email. Please try again.',
                code: 'EMAIL_FAILED',
            }, { status: 500 });
        }

        // Success
        console.log(`OTP sent to ${email} for ${type} password flow`);

        return NextResponse.json({
            success: true,
            message: 'Verification code sent to your email',
            otpId: otpDocRef.id,
            expiresIn: OTP_EXPIRY_MINUTES * 60, // seconds
        });

    } catch (error: any) {
        console.error('Send OTP error:', error);

        return NextResponse.json({
            success: false,
            message: 'An error occurred',
            error: error.message || 'Unknown error',
        }, { status: 500 });
    }
}
