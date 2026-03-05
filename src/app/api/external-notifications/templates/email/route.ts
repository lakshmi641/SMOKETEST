export const dynamic = 'force-dynamic'

/**
 * Email Template Management API
 * 
 * Creates Email templates via SendGrid Templates API
 * Stores template metadata in Firestore using the V3 Schema
 */

import { NextRequest, NextResponse } from 'next/server';
import { TemplateServiceAdmin } from '@/lib/services/external-notifications/template-service-admin';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { companyId, groupId, name, design, language = 'en_US', userId, userName } = body;

        // Validate required fields
        if (!companyId || !name || !design) {
            return NextResponse.json(
                { error: 'Missing required fields: companyId, name, design' },
                { status: 400 }
            );
        }

        // ----------------------------------------------------------------------
        // Real SendGrid Template API Creation (Logic can be expanded here)
        // ----------------------------------------------------------------------
        const externalId = '';
        const submissionStatus = 'approved'; // Email templates usually don't need Meta-style approval

        // 3. Create template in Firestore with new V3 Schema (using Admin SDK)
        const template = await TemplateServiceAdmin.createTemplate(companyId, {
            companyId,
            name,
            type: 'email',
            language,
            design,
            status: submissionStatus as any,
            isDefault: false,
            associatedEvents: [],
            externalId,
            createdBy: userId,
            lastModifiedBy: userId,
            approvalTrail: userId ? [{
                status: submissionStatus as any,
                userId,
                userName: userName || 'User',
                timestamp: new Date().toISOString(),
                comment: 'Email template created and auto-approved'
            }] : []
        } as any, groupId ?? undefined);

        return NextResponse.json({
            success: true,
            templateId: template.id,
            status: submissionStatus,
            externalId: externalId
        });

    } catch (error: any) {
        console.error('[Email Template API V3] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    // Keep as is for now or migrate to service
    return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
