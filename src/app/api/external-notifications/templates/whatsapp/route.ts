/**
 * WhatsApp Template Management API
 * 
 * Creates WhatsApp templates via Twilio Content API
 * Stores template metadata in Firestore using the V3 Schema
 */

import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { TemplateServiceAdmin } from '@/lib/services/external-notifications/template-service-admin';
import type { CompanyTemplate } from '@/types/external-notifications';

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

        // 1. Prepare for Twilio submission (extract text from design elements)
        const messageBody = design.elements
            .filter((el: any) => el.type === 'body')
            .map((el: any) => el.content)
            .join('\n\n');

        const twilioClient = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
        );

        let externalId = '';
        let submissionStatus: any = 'draft';

        // 2. Real Twilio Content API Submission
        try {
            if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
                // Create Content resource
                const content = await twilioClient.content.v1.contents.create({
                    friendlyName: name,
                    language: language.split('_')[0],
                    types: {
                        'twilio/text': { body: messageBody }
                    }
                } as any);

                externalId = content.sid;

                // Submit for WhatsApp Approval
                try {
                    await (twilioClient.content.v1.contents(content.sid) as any).approvalCreate({
                        name: 'whatsapp',
                        category: 'UTILITY'
                    });
                    submissionStatus = 'pending_approval';
                } catch (approvalError) {
                    console.warn(`[Twilio] Approval submission failed:`, approvalError);
                    submissionStatus = 'draft';
                }
            }
        } catch (twilioError) {
            console.error('[Twilio] Content API failed:', twilioError);
        }

        // 3. Create template in Firestore with new V3 Schema (using Admin SDK)
        const template = await TemplateServiceAdmin.createTemplate(companyId, {
            companyId,
            name,
            type: 'whatsapp',
            language,
            design,
            status: submissionStatus,
            isDefault: false,
            associatedEvents: [],
            externalId,
            createdBy: userId,
            lastModifiedBy: userId,
            approvalTrail: userId ? [{
                status: submissionStatus,
                userId,
                userName: userName || 'User',
                timestamp: new Date().toISOString(),
                comment: externalId ? 'Submitted to Twilio Content API' : 'Created locally (Submission Skipped)'
            }] : []
        } as any, groupId ?? undefined);

        return NextResponse.json({
            success: true,
            templateId: template.id,
            status: submissionStatus,
            externalId: externalId
        });

    } catch (error: any) {
        console.error('[WhatsApp Template API V3] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
