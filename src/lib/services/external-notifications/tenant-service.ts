/**
 * Tenant Configuration Service
 * 
 * Manages per-tenant (company) configurations for Twilio/SendGrid
 * Supports both Sandbox (development) and Production modes
 * 
 * For Sandbox mode: Uses shared master account credentials with code-level isolation
 * For Production mode: Uses actual Twilio subaccounts and SendGrid subusers
 */

import { collection, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { TenantConfig } from '@/types/external-notifications';

export class TenantService {
    private static COLLECTION = 'tenantConfigs';

    /**
     * Get tenant configuration for a company
     * Creates default sandbox config if not exists
     */
    static async getTenantConfig(companyId: string, groupId?: string): Promise<TenantConfig> {
        const configRef = this.getConfigRef(companyId, groupId);
        const snapshot = await getDoc(configRef);

        if (!snapshot.exists()) {
            // Create default sandbox configuration
            const defaultConfig = this.createDefaultSandboxConfig(companyId);
            await setDoc(configRef, defaultConfig);
            return defaultConfig;
        }

        return snapshot.data() as TenantConfig;
    }

    /**
     * Helper to get Firestore doc reference for tenant config
     */
    private static getConfigRef(companyId: string, groupId?: string) {
        const effectiveGroupId = groupId || companyId;
        return doc(db, 'enterpriseGroups', effectiveGroupId, 'companies', companyId, this.COLLECTION, 'config');
    }

    /**
     * Get tenant notification configuration for the UI
     */
    static async getTenantNotificationConfig(companyId: string, groupId?: string): Promise<TenantConfig | null> {
        try {
            const configRef = this.getConfigRef(companyId, groupId);
            const snapshot = await getDoc(configRef);

            if (!snapshot.exists()) {
                return this.createDefaultSandboxConfig(companyId);
            }

            return snapshot.data() as TenantConfig;
        } catch (error) {
            console.error('Error getting tenant notification config:', error);
            return null;
        }
    }

    /**
     * Create default sandbox configuration
     */
    private static createDefaultSandboxConfig(companyId: string): TenantConfig {
        return {
            companyId,
            twilio: {
                // Uses master account credentials from environment
                accountSid: undefined, // Will use process.env.TWILIO_ACCOUNT_SID
                authToken: undefined,  // Will use process.env.TWILIO_AUTH_TOKEN
                fromNumber: process.env.TWILIO_FROM_NUMBER || 'whatsapp:+16592186132',
                sandboxNumber: 'whatsapp:+14155238886', // Twilio Sandbox number
            },
            sendgrid: {
                // Uses master account credentials from environment
                apiKey: undefined, // Will use process.env.SENDGRID_API_KEY
                fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@autocracy.com',
                fromName: process.env.SENDGRID_FROM_NAME || 'Autocracy PMS',
            },
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
    }

    /**
     * Save tenant notification configuration
     */
    static async saveTenantNotificationConfig(companyId: string, config: Partial<TenantConfig>, groupId?: string): Promise<void> {
        const configRef = this.getConfigRef(companyId, groupId);
        const now = new Date().toISOString();

        const dataToSave = {
            ...config,
            companyId,
            updatedAt: now,
        };

        const snapshot = await getDoc(configRef);
        if (snapshot.exists()) {
            await updateDoc(configRef, dataToSave);
        } else {
            await setDoc(configRef, {
                ...dataToSave,
                createdAt: now,
            });
        }
    }

    /**
     * Get effective Twilio credentials (tenant-specific or master)
     */
    static async getEffectiveTwilioConfig(companyId: string, groupId?: string): Promise<{
        accountSid: string;
        authToken: string;
        fromNumber: string;
        isActive: boolean;
    }> {
        const config = await this.getTenantConfig(companyId, groupId);

        return {
            accountSid: config.isActive ? (config.twilio.accountSid || process.env.TWILIO_ACCOUNT_SID || '') : '',
            authToken: config.isActive ? (config.twilio.authToken || process.env.TWILIO_AUTH_TOKEN || '') : '',
            fromNumber: config.isActive ? (config.twilio.fromNumber || process.env.TWILIO_FROM_NUMBER || '') : '',
            isActive: config.isActive
        };
    }

    /**
     * Get effective SendGrid credentials (tenant-specific or master)
     */
    static async getEffectiveSendGridConfig(companyId: string, groupId?: string): Promise<{
        apiKey: string;
        fromEmail: string;
        fromName: string;
        isActive: boolean;
    }> {
        const config = await this.getTenantConfig(companyId, groupId);

        return {
            apiKey: config.isActive ? (config.sendgrid.apiKey || process.env.SENDGRID_API_KEY || '') : '',
            fromEmail: config.isActive ? (config.sendgrid.fromEmail || process.env.SENDGRID_FROM_EMAIL || '') : '',
            fromName: config.isActive ? (config.sendgrid.fromName || process.env.SENDGRID_FROM_NAME || 'Autocracy PMS') : '',
            isActive: config.isActive
        };
    }

    /**
     * Upgrade tenant to production (with actual subaccounts)
     * This will be used when moving from sandbox to production
     */
    static async upgradeToProduction(
        companyId: string,
        twilioSubaccountSid: string,
        twilioAuthToken: string,
        twilioFromNumber: string,
        sendgridApiKey: string,
        sendgridFromEmail: string,
        groupId?: string
    ): Promise<void> {
        const configRef = this.getConfigRef(companyId, groupId);

        await updateDoc(configRef, {
            twilio: {
                accountSid: twilioSubaccountSid,
                authToken: twilioAuthToken,
                fromNumber: twilioFromNumber,
            },
            sendgrid: {
                apiKey: sendgridApiKey,
                fromEmail: sendgridFromEmail,
            },
            updatedAt: new Date().toISOString(),
        });
    }
}
