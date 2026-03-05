/**
 * Core Notification Sending Logic
 * 
 * This utility contains the core logic for sending notifications via
 * SendGrid (email) and Twilio (WhatsApp).
 * 
 * PRINCIPLES:
 * 1. Security: API Keys never leave this server-side environment.
 * 2. Zero Failure: Email failure does not crash WhatsApp, and vice-versa.
 * 3. Validation: Ensures inputs are correct before attempting sending.
 */

import sgMail from '@sendgrid/mail';
import twilio from 'twilio';
import {
    SendNotificationRequest,
    SendNotificationResponse,
    getPriorityForEvent,
    formatEmailSubject,
    formatWhatsAppNumber,
} from '@/types/external-notifications';
import { TenantServiceAdmin } from '@/lib/services/external-notifications/tenant-service-admin';
import { resolveWhatsAppVariables } from '@/lib/services/external-notifications/whatsapp-variable-resolver';

// ============================================================================
// CONFIGURATION & INITIALIZATION
// ============================================================================

// Initialize clients helper
function getClients(config?: any) {
    const SG_API_KEY = config?.sendgrid?.apiKey || process.env.SENDGRID_API_KEY;
    const SG_FROM = config?.sendgrid?.fromEmail || process.env.SENDGRID_FROM_EMAIL;
    const SG_FROM_NAME = config?.sendgrid?.fromName || process.env.SENDGRID_FROM_NAME || 'Autocracy PMS';
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

    // Twilio Credential Selection
    const accountSid = config?.twilio?.accountSid || process.env.TWILIO_ACCOUNT_SID;
    const authToken = config?.twilio?.authToken || process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = config?.twilio?.fromNumber || process.env.TWILIO_FROM_NUMBER;

    console.log('[NotificationAPI] Config Check:', {
        SG_FROM,
        SG_KEY_PREFIX: SG_API_KEY ? SG_API_KEY.substring(0, 4) + '...' : 'MISSING',
        TWILIO_FROM: twilioFrom,
        USING_API_KEY: false, // Legacy field in logs
        APP_URL
    });

    if (SG_API_KEY) {
        sgMail.setApiKey(SG_API_KEY);
    }

    let twilioClient = null;
    if (accountSid && authToken) {
        twilioClient = twilio(accountSid, authToken);
    }

    return { SG_API_KEY, SG_FROM, SG_FROM_NAME, twilioClient, TWILIO_FROM: twilioFrom };
}

// ============================================================================
// CORE LOGIC (Testable without NextRequest)
// ============================================================================
export async function sendNotification(
    body: SendNotificationRequest & {
        messageBody?: string;
        subject?: string;
        recipientEmail?: string;
        recipientPhone?: string;
        groupId?: string; // Optional group ID
    }
): Promise<SendNotificationResponse> {
    // Construct Response Object (Default: failure)
    const response: SendNotificationResponse = {
        success: false,
        channels: {}
    };

    // Determine Priority (Use explicit or derive from event)
    const priority = body.priority || getPriorityForEvent(body.eventType);

    console.log('[NotificationAPI] Incoming Request Body:', {
        companyId: body.companyId,
        groupId: body.groupId,
        recipientUserId: body.recipientUserId,
        channel: body.channel,
        eventType: body.eventType
    });

    // 1. Fetch Tenant Configuration
    const effectiveConfig = await TenantServiceAdmin.getEffectiveConfig(body.companyId, body.groupId);

    // Initialize Clients (Runtime)
    const { SG_API_KEY, SG_FROM, SG_FROM_NAME, twilioClient, TWILIO_FROM } = getClients(effectiveConfig);

    // ------------------------------------------------------------------------
    // 2. CHANNEL: EMAIL (SendGrid)
    // ------------------------------------------------------------------------
    if (body.channel === 'email' || body.channel === 'both') {
        // Pre-flight checks
        if (!SG_API_KEY || !SG_FROM) {
            console.warn('[NotificationAPI] SendGrid keys missing');
            response.channels.email = { sent: false, error: 'Service not configured' };
        }
        else if (!body.recipientEmail) {
            response.channels.email = { sent: false, error: 'Recipient email missing' };
        }
        else {
            // Attempt Send
            try {
                const rawSubject = body.subject || 'New Notification';
                const formattedSubject = formatEmailSubject(rawSubject, priority);

                // Use Template Engine for Email
                const { renderEmailTemplate } = await import('./template-engine');

                // Map EventType to TemplateName
                let templateName: any = 'universal';
                if (body.eventType === 'task_assigned' || body.eventType === 'rft_task_assigned') templateName = 'task_assigned';
                else if (body.eventType === 'workspace_task_request') templateName = 'workspace_task_request';
                else if (body.eventType === 'approval_required') templateName = 'approval_request';
                else if (body.eventType === 'task_overdue' || body.eventType === 'ghost_task_alert') templateName = 'escalation_reminder';
                else if (body.eventType === 'workflow_completed') templateName = 'workflow_completed';
                else if (body.eventType === 'task_reassigned') templateName = 'task_reassigned';
                else if (body.eventType === 'comment_mention') templateName = 'comment_mention';
                else if (body.eventType === 'due_date_reminder' || body.eventType === 'task_due_soon') templateName = 'due_date_reminder';

                const htmlBody = renderEmailTemplate(templateName, {
                    subject: formattedSubject,
                    message: body.messageBody,
                    tenantDisplayName: SG_FROM_NAME,
                    ...body.templateData,
                    primaryCtaUrl: body.templateData?.actionUrl || body.templateData?.primaryCtaUrl,
                });

                const emailData = {
                    to: body.recipientEmail,
                    from: {
                        email: SG_FROM,
                        name: SG_FROM_NAME
                    },
                    subject: formattedSubject,
                    text: body.messageBody || 'You have a new notification.',
                    html: htmlBody,
                    customArgs: {
                        companyId: body.companyId,
                        eventType: body.eventType,
                        priority: priority
                    }
                };

                await sgMail.send(emailData);
                response.channels.email = { sent: true };

            } catch (error: any) {
                console.error('[NotificationAPI] SendGrid Failed:', error);

                // Log specific SendGrid error details if available
                if (error.response && error.response.body) {
                    console.error('[NotificationAPI] SendGrid Error Body:', JSON.stringify(error.response.body, null, 2));
                }

                response.channels.email = {
                    sent: false,
                    error: error.message || 'Provider error'
                };
            }
        }
    }

    // ------------------------------------------------------------------------
    // 3. CHANNEL: WHATSAPP (Twilio)
    // ------------------------------------------------------------------------
    if (body.channel === 'whatsapp' || body.channel === 'both') {
        // Pre-flight checks
        if (!twilioClient || !TWILIO_FROM) {
            console.warn('[NotificationAPI] Twilio keys missing');
            response.channels.whatsapp = { sent: false, error: 'Service not configured' };
        }
        else if (!body.recipientPhone) {
            response.channels.whatsapp = { sent: false, error: 'Recipient phone missing' };
        }
        else {
            // Attempt Send
            try {
                const from = formatWhatsAppNumber(TWILIO_FROM);
                const to = formatWhatsAppNumber(body.recipientPhone);

                // 1. Select the correct Content SID (Specific mapping vs Global fallback)
                const contentSid = effectiveConfig.twilio.whatsappMappings?.[body.eventType] ||
                    effectiveConfig.twilio.contentSid ||
                    process.env.TWILIO_WHATSAPP_CONTENT_SID;

                let message;

                if (contentSid) {
                    // PRODUCTION MODE: Use Content Template
                    console.log(`[NotificationAPI] Using Content Template [${body.eventType}]:`, contentSid);

                    // 2. Resolve Variables using specialized logic
                    const contentVariables = resolveWhatsAppVariables(
                        body.eventType,
                        body.templateData || {},
                        SG_FROM_NAME // Used as tenant branding
                    );

                    message = await twilioClient.messages.create({
                        from: from,
                        to: to,
                        contentSid: contentSid,
                        contentVariables: JSON.stringify(contentVariables),
                    });
                } else {
                    // FALLBACK / SESSION MODE: Use free-form message
                    console.log('[NotificationAPI] Using free-form message for WhatsApp (session mode)');

                    message = await twilioClient.messages.create({
                        from: from,
                        to: to,
                        body: body.messageBody || 'You have a new notification.',
                    });
                }

                response.channels.whatsapp = {
                    sent: true,
                    messageId: message.sid
                };

            } catch (error: any) {
                console.error('[NotificationAPI] Twilio Failed:', error);

                let errorMessage = error.message || 'Provider error';

                // Detection for 24-hour session window issue (Error 63016)
                if (error.code === 63016) {
                    errorMessage = "WhatsApp Error 63016: Outside 24-hour session window. You must use an approved Message Template (set TWILIO_WHATSAPP_CONTENT_SID) for business-initiated messages.";
                }

                // Detection for Sandbox vs Production numbers (Error 63007)
                if (error.code === 63007 || errorMessage.includes('Channel')) {
                    errorMessage = "WhatsApp Channel not found. If using Twilio Sandbox, your TWILIO_FROM_NUMBER must be '+14155238886'. If using a production number, it must be approved by Meta.";
                }

                response.channels.whatsapp = {
                    sent: false,
                    error: errorMessage,
                    code: error.code
                };
            }
        }
    }


    // ------------------------------------------------------------------------
    // 4. FINAL STATUS
    // ------------------------------------------------------------------------
    // Overall success if AT LEAST ONE channel succeeded
    response.success = (response.channels.email?.sent || response.channels.whatsapp?.sent) ?? false;

    return response;
}

