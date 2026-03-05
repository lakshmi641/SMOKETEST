/**
 * Secure Gateway for External Notifications
 * 
 * This API route acts as the secure bridge between the client/service layer
 * and the external providers (SendGrid/Twilio).
 * 
 * PRINCIPLES:
 * 1. Security: API Keys never leave this server-side environment.
 * 2. Zero Failure: Email failure does not crash WhatsApp, and vice-versa.
 * 3. Validation: Ensures inputs are correct before attempting sending.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendNotification } from '../lib/sendNotification';
import { resolveCompanyIdFromRequest } from '@/lib/proxy';

// ============================================================================
// API HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Auto-resolve groupId if missing (crucial for multi-tenant config lookup)
        if (!body.groupId) {
            const { companyId: resolvedGroupId } = await resolveCompanyIdFromRequest();
            if (resolvedGroupId) {
                console.log(`[NotificationAPI] Auto-resolved Group ID: ${resolvedGroupId}`);
                body.groupId = resolvedGroupId;
            }
        }

        const response = await sendNotification(body);
        return NextResponse.json(response);

    } catch (error: any) {
        // Critical Server Error (e.g., JSON parsing failed)
        console.error('[NotificationAPI] Critical Error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
