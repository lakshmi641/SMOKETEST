/**
 * Approval Monitor Service
 * 
 * Periodically checks the status of WhatsApp templates submitted to Twilio.
 * Moves templates from 'pending_approval' to 'approved' or 'rejected'.
 */

import { TemplateService } from './template-service';
import twilio from 'twilio';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

export class ApprovalMonitorService {

    /**
     * Check pending templates for a specific company
     */
    static async checkCompanyPendingTemplates(companyId: string): Promise<void> {
        try {
            // Get effective Twilio config for the company
            // Ideally we use TenantService, but for MVP we use env vars if mostly single tenant dev
            // For production, we must fetch from TenantConfig
            const accountSid = process.env.TWILIO_ACCOUNT_SID;
            const authToken = process.env.TWILIO_AUTH_TOKEN;

            if (!accountSid || !authToken) {
                console.warn(`[ApprovalMonitor] No Twilio credentials for company ${companyId}`);
                return;
            }

            const client = twilio(accountSid, authToken);

            // Get pending templates
            const pendingTemplates = await TemplateService.getPendingTemplates(companyId);

            for (const template of pendingTemplates) {
                // We assume externalId was saved when template was submitted.
                // If we implemented the full flow, we'd have the ContentSid.
                // For this implementation plan, we lacked the strict submission logic in Stage 3 API.
                // Assuming we are just simulating or checking if externalId exists.

                if (!template.externalId) {
                    console.log(`[ApprovalMonitor] Template ${template.id} has no externalId, skipping.`);
                    continue;
                }

                try {
                    // Fetch status from Twilio Content API
                    // Note: Twilio Node helper might not have full Content API support in older versions,
                    // but we can use raw requests or updated client.
                    // Using a hypothetical fetch here as Twilio Content API is newer.

                    // const content = await client.content.v1.contents(template.externalId).fetch();
                    // const status = content.approvalRequests?.status; 

                    // ------------------------------------------------------------------
                    // Real Twilio Status Check
                    // ------------------------------------------------------------------

                    // Fetch approval requests for this content
                    // Endpoint: /v1/Contents/{Sid}/ApprovalRequests
                    // Using 'any' cast for safety against strict library types
                    const approvalRequestsContext = (client.content.v1.contents(template.externalId) as any).approvalRequests;

                    if (approvalRequestsContext) {
                        const requests = await approvalRequestsContext.list();

                        // Find the WhatsApp approval request
                        const whatsAppRequest = requests.find((r: any) => r.name === 'whatsapp');

                        if (whatsAppRequest) {
                            const status = whatsAppRequest.status; // 'pending', 'approved', 'rejected'

                            console.log(`[ApprovalMonitor] Template ${template.name} (${template.externalId}) status: ${status}`);

                            if (status === 'approved') {
                                await TemplateService.updateTemplateStatus(companyId, template.id, 'approved');
                                console.log(`[ApprovalMonitor] Template ${template.name} APPROVED and updated.`);
                            } else if (status === 'rejected') {
                                // Capture rejection reason if available
                                const reason = whatsAppRequest.rejection_reason || 'Rejected by Meta';
                                await TemplateService.updateTemplateStatus(companyId, template.id, 'rejected', reason);
                                console.log(`[ApprovalMonitor] Template ${template.name} REJECTED.`);
                            }
                            // If pending, do nothing
                        }
                    } else {
                        console.warn(`[ApprovalMonitor] No approvalRequests context for ${template.externalId}`);
                    }

                } catch (error) {
                    console.error(`[ApprovalMonitor] Error checking template ${template.id}:`, error);
                }
            }

        } catch (error) {
            console.error(`[ApprovalMonitor] Error processing company ${companyId}:`, error);
        }
    }

    /**
     * Run checks for all companies
     * This method would be called by a CRON job / Scheduled Function
     */
    static async runGlobalCheck(): Promise<void> {
        console.log('[ApprovalMonitor] Starting global template check...');
        try {
            // Get all companies
            const companiesSnapshot = await getDocs(collection(db, 'companies'));

            for (const doc of companiesSnapshot.docs) {
                await this.checkCompanyPendingTemplates(doc.id);
            }
            console.log('[ApprovalMonitor] Global check completed.');
        } catch (error) {
            console.error('[ApprovalMonitor] Global check failed:', error);
        }
    }
}
