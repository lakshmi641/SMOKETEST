/**
 * Template Service Admin - Server-side Template Management
 * Uses Firebase Admin SDK to bypass security rules in API routes.
 * Uses enterprise group path to align with client-side TemplateService.
 */

import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type {
    CompanyTemplate,
    TemplateStatus,
    ApprovalEntry
} from '@/types/external-notifications';

export class TemplateServiceAdmin {
    private static getTemplatesRef(companyId: string, groupId?: string | null) {
        const effectiveGroupId = groupId || companyId;
        return getAdminFirestore()
            .collection('enterpriseGroups')
            .doc(effectiveGroupId)
            .collection('companies')
            .doc(companyId)
            .collection('companyTemplates');
    }

    /**
     * Create a new template using admin SDK
     */
    static async createTemplate(
        companyId: string,
        template: Omit<CompanyTemplate, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'approvalTrail'>,
        groupId?: string | null
    ): Promise<CompanyTemplate> {
        const templatesRef = this.getTemplatesRef(companyId, groupId);
        const templateDoc = templatesRef.doc();

        const now = new Date().toISOString();
        const newTemplate: any = {
            ...template,
            id: templateDoc.id,
            companyId,
            version: 1,
            approvalTrail: (template as any).approvalTrail || [],
            createdAt: now,
            updatedAt: now,
        };

        await templateDoc.set(newTemplate);
        return newTemplate as CompanyTemplate;
    }

    /**
     * Update template using admin SDK
     */
    static async updateTemplate(
        companyId: string,
        templateId: string,
        updates: Partial<CompanyTemplate>,
        groupId?: string | null
    ): Promise<void> {
        const templateRef = this.getTemplatesRef(companyId, groupId).doc(templateId);
        await templateRef.update({
            ...updates,
            updatedAt: new Date().toISOString(),
        });
    }

    /**
     * Get a specific template
     */
    static async getTemplate(companyId: string, templateId: string, groupId?: string | null): Promise<CompanyTemplate | null> {
        const templateRef = this.getTemplatesRef(companyId, groupId).doc(templateId);
        const doc = await templateRef.get();
        return doc.exists ? (doc.data() as CompanyTemplate) : null;
    }
}
