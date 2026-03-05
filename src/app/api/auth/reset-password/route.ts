export const dynamic = "force-dynamic"
/**
 * POST /api/auth/reset-password
 * 
 * Verifies OTP and updates user password using Firebase Admin SDK.
 * Follows existing patterns from /api/users/create
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import {
    hashOTP,
    validatePassword,
    getCompanyBranding,
    generatePasswordChangedEmailHTML,
} from '@/lib/services/auth/password-reset-service';
import type { ResetPasswordRequest, ResetPasswordResponse } from '@/types/password-reset';

export async function POST(request: NextRequest): Promise<NextResponse<ResetPasswordResponse>> {
    try {
        // Parse request body
        const body: ResetPasswordRequest & { groupId?: string } = await request.json();
        const { otpId, otp, newPassword, confirmPassword, companyId, groupId } = body;

        // Use groupId if provided, fallback to companyId for multi-tenant structure
        const effectiveGroupId = groupId || companyId;

        // Validate required fields
        if (!otpId || !otp || !newPassword || !confirmPassword || !companyId) {
            return NextResponse.json({
                success: false,
                message: 'Missing required fields',
                error: 'All fields are required',
                code: 'INVALID_OTP',
            }, { status: 400 });
        }

        // Validate passwords match
        if (newPassword !== confirmPassword) {
            return NextResponse.json({
                success: false,
                message: 'Passwords do not match',
                error: 'New password and confirmation must match',
                code: 'PASSWORD_MISMATCH',
            }, { status: 400 });
        }

        // Validate password strength
        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.isValid) {
            return NextResponse.json({
                success: false,
                message: 'Password is too weak',
                error: 'Password must be at least 8 characters with uppercase, lowercase, and a number',
                code: 'WEAK_PASSWORD',
            }, { status: 400 });
        }

        const adminFirestore = getAdminFirestore();
        const adminAuth = getAdminAuth();

        // Get OTP document from nested path
        const otpDocRef = adminFirestore
            .collection('enterpriseGroups')
            .doc(effectiveGroupId)
            .collection('companies')
            .doc(companyId)
            .collection('password_reset_otps')
            .doc(otpId);

        const otpDoc = await otpDocRef.get();

        if (!otpDoc.exists) {
            return NextResponse.json({
                success: false,
                message: 'Invalid or expired code',
                error: 'The verification code is invalid. Please request a new one.',
                code: 'INVALID_OTP',
            }, { status: 400 });
        }

        const otpData = otpDoc.data()!;

        // Check if already used
        if (otpData.used) {
            return NextResponse.json({
                success: false,
                message: 'Code already used',
                error: 'This code has already been used. Please request a new one.',
                code: 'ALREADY_USED',
            }, { status: 410 });
        }

        // Check expiry
        const expiresAt = otpData.expiresAt.toDate();
        if (new Date() > expiresAt) {
            return NextResponse.json({
                success: false,
                message: 'Code expired',
                error: 'The verification code has expired. Please request a new one.',
                code: 'OTP_EXPIRED',
            }, { status: 410 });
        }

        // Check attempts
        if (otpData.attempts >= otpData.maxAttempts) {
            return NextResponse.json({
                success: false,
                message: 'Too many attempts',
                error: 'Maximum attempts exceeded. Please request a new code.',
                code: 'MAX_ATTEMPTS',
                attemptsRemaining: 0,
            }, { status: 423 });
        }

        // Verify OTP hash
        const inputHash = hashOTP(otp);
        if (inputHash !== otpData.otpHash) {
            // Increment attempts
            const newAttempts = otpData.attempts + 1;
            await otpDocRef.update({ attempts: newAttempts });

            const remaining = otpData.maxAttempts - newAttempts;

            return NextResponse.json({
                success: false,
                message: 'Invalid code',
                error: remaining > 0
                    ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
                    : 'Maximum attempts exceeded. Please request a new code.',
                code: 'INVALID_OTP',
                attemptsRemaining: remaining,
            }, { status: 400 });
        }

        // OTP is valid! Update password
        try {
            await adminAuth.updateUser(otpData.userId, {
                password: newPassword,
            });

            // Clear any temporary-password onboarding flags on the user document(s)
            try {
                const userId = otpData.userId as string;

                // Update enterprise group level user doc if it exists
                const groupUserRef = adminFirestore
                    .collection('enterpriseGroups')
                    .doc(effectiveGroupId)
                    .collection('users')
                    .doc(userId);
                const groupUserSnap = await groupUserRef.get();
                if (groupUserSnap.exists) {
                    await groupUserRef.update({
                        mustChangePassword: false,
                    });
                }

                // Update company-level user doc if it exists
                const companyUserRef = adminFirestore
                    .collection('enterpriseGroups')
                    .doc(effectiveGroupId)
                    .collection('companies')
                    .doc(companyId)
                    .collection('users')
                    .doc(userId);
                const companyUserSnap = await companyUserRef.get();
                if (companyUserSnap.exists) {
                    await companyUserRef.update({
                        mustChangePassword: false,
                    });
                }
            } catch (metaError) {
                console.error('Failed to clear temporary password flags after reset:', metaError);
                // Do not fail the reset flow if metadata update fails
            }
        } catch (authError: any) {
            console.error('Firebase Auth update error:', authError);
            return NextResponse.json({
                success: false,
                message: 'Failed to update password',
                error: 'Could not update password. Please try again.',
                code: 'UPDATE_FAILED',
            }, { status: 500 });
        }

        // Mark OTP as used
        await otpDocRef.update({
            used: true,
            usedAt: Timestamp.now(),
        });

        // Send confirmation email
        try {
            const branding = await getCompanyBranding(companyId, effectiveGroupId);
            const confirmationHTML = generatePasswordChangedEmailHTML(branding, otpData.email);

            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            const notificationUrl = baseUrl.includes('localhost')
                ? `${baseUrl}/api/external-notifications/send`
                : `${process.env.APP_URL || baseUrl}/api/external-notifications/send`;

            await fetch(notificationUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyId,
                    groupId: effectiveGroupId,
                    channel: 'email',
                    recipientEmail: otpData.email,
                    subject: 'Your Password Has Been Changed',
                    messageBody: confirmationHTML,
                    eventType: 'system_announcement',
                    priority: 'high',
                }),
            });
        } catch (emailError) {
            // Log but don't fail - password was already changed
            console.error('Confirmation email error:', emailError);
        }

        console.log(`Password reset successful for user ${otpData.userId}`);

        return NextResponse.json({
            success: true,
            message: 'Password reset successfully',
        });

    } catch (error: any) {
        console.error('Reset password error:', error);

        return NextResponse.json({
            success: false,
            message: 'An error occurred',
            error: error.message || 'Unknown error',
        }, { status: 500 });
    }
}
