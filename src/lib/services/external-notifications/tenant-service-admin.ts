/**
 * Tenant Service Admin - Server-side Tenant Management
 * Uses Firebase Admin SDK to bypass security rules in API routes.
 */

import { getAdminFirestore } from '@/lib/firebase-admin';
import type { TenantConfig } from '@/types/external-notifications';

export class TenantServiceAdmin {
    private static COLLECTION = 'tenantConfigs';

    /**
     * Helper to get Firestore doc reference for tenant config (Admin SDK)
     */
    private static getConfigRef(companyId: string, groupId?: string | null) {
        const effectiveGroupId = groupId || companyId;
        return getAdminFirestore()
            .collection('enterpriseGroups')
            .doc(effectiveGroupId)
            .collection('companies')
            .doc(companyId)
            .collection(this.COLLECTION)
            .doc('config');
    }

    /**
     * Get tenant configuration for a company (Admin SDK)
     */
    static async getTenantConfig(companyId: string, groupId?: string | null): Promise<TenantConfig | null> {
        try {
            const effectiveGroupId = groupId || companyId;
            const path = `enterpriseGroups/${effectiveGroupId}/companies/${companyId}/tenantConfigs/config`;
            console.log(`[TenantServiceAdmin] Fetching config from: ${path}`);

            const configRef = this.getConfigRef(companyId, groupId);
            const snapshot = await configRef.get();

            if (!snapshot.exists) {
                console.log(`[TenantServiceAdmin] ❌ Config NOT FOUND at: ${path}`);
                return null;
            }

            console.log(`[TenantServiceAdmin] ✅ Config FOUND at: ${path}`);
            return snapshot.data() as TenantConfig;
        } catch (error) {
            console.error('Error getting tenant configuration (Admin):', error);
            return null;
        }
    }

    /**
     * Get effective credentials (Tenant config with environment fallback)
     */
    static async getEffectiveConfig(companyId: string, groupId?: string | null) {
        const config = await this.getTenantConfig(companyId, groupId);

        const isActive = config?.isActive ?? true; // Default to true if no config exists (backward compatibility)

        return {
            twilio: {
                accountSid: (isActive && config?.twilio?.accountSid) || process.env.TWILIO_ACCOUNT_SID || '',
                authToken: (isActive && config?.twilio?.authToken) || process.env.TWILIO_AUTH_TOKEN || '',
                fromNumber: (isActive && config?.twilio?.fromNumber) || process.env.TWILIO_FROM_NUMBER || '',
                contentSid: (isActive && config?.twilio?.whatsappContentSid) || process.env.TWILIO_WHATSAPP_CONTENT_SID || '',
                whatsappMappings: (isActive && config?.twilio?.whatsappMappings) || {},
            },
            sendgrid: {
                apiKey: (isActive && config?.sendgrid?.apiKey) || process.env.SENDGRID_API_KEY || '',
                fromEmail: (isActive && config?.sendgrid?.fromEmail) || process.env.SENDGRID_FROM_EMAIL || '',
                fromName: (isActive && config?.sendgrid?.fromName) || process.env.SENDGRID_FROM_NAME || 'Autocracy PMS',
            },
            isActive
        };
    }
}
