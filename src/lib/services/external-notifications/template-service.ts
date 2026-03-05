/**
 * Template Service - Manages Company Templates
 * 
 * Handles CRUD operations for WhatsApp and Email templates following
 * path-based multi-tenancy (same as existing system).
 */

import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { companySubcollectionPathSegments } from '@/lib/firestore-paths';
import type {
    CompanyTemplate,
    TemplateStatus,
    ApprovalEntry,
    EventType
} from '@/types/external-notifications';

export class TemplateService {
    /**
     * Get base collection reference for company templates
     * Uses enterprise group path: enterpriseGroups/{groupId}/companies/{companyId}/companyTemplates
     */
    private static getTemplatesRef(companyId: string, groupId?: string | null) {
        const effectiveGroupId = groupId || companyId;
        const segments = companySubcollectionPathSegments(effectiveGroupId, companyId, 'companyTemplates');
        return collection(db, segments[0], ...segments.slice(1));
    }

    /**
     * Create a new template
     */
    static async createTemplate(
        companyId: string,
        template: Omit<CompanyTemplate, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'approvalTrail'>,
        groupId?: string | null
    ): Promise<CompanyTemplate> {
        const templatesRef = this.getTemplatesRef(companyId, groupId);
        const templateDoc = doc(templatesRef);

        const now = new Date().toISOString();
        const newTemplate: CompanyTemplate = {
            ...template,
            id: templateDoc.id,
            companyId,
            version: 1,
            approvalTrail: [],
            createdAt: now,
            updatedAt: now,
        } as CompanyTemplate;

        await setDoc(templateDoc, newTemplate);
        return newTemplate;
    }

    /**
     * Get a specific template by ID
     */
    static async getTemplate(companyId: string, templateId: string, groupId?: string | null): Promise<CompanyTemplate | null> {
        const effectiveGroupId = groupId || companyId;
        const segments = companySubcollectionPathSegments(effectiveGroupId, companyId, 'companyTemplates');
        const templateRef = doc(db, ...segments, templateId);
        const snapshot = await getDoc(templateRef);
        return snapshot.exists() ? (snapshot.data() as CompanyTemplate) : null;
    }

    /**
     * Get all templates for a company
     */
    static async getAllTemplates(companyId: string, groupId?: string | null): Promise<CompanyTemplate[]> {
        const templatesRef = this.getTemplatesRef(companyId, groupId);
        const snapshot = await getDocs(templatesRef);
        return snapshot.docs.map(doc => doc.data() as CompanyTemplate);
    }

    /**
     * Set a template as default for specific events
     */
    static async setAsDefault(
        companyId: string,
        templateId: string,
        events: EventType[],
        groupId?: string | null
    ): Promise<void> {
        const templatesRef = this.getTemplatesRef(companyId, groupId);

        // 1. Fetch current template
        const template = await this.getTemplate(companyId, templateId, groupId);
        if (!template) return;

        // 2. Unset default for these events on ALL other templates of the SAME TYPE
        const q = query(templatesRef, where('type', '==', template.type), where('isDefault', '==', true));
        const snapshots = await getDocs(q);

        const batch: Promise<any>[] = [];
        snapshots.docs.forEach(d => {
            const data = d.data() as CompanyTemplate;
            if (d.id === templateId) return;

            const remainingEvents = data.associatedEvents.filter(e => !events.includes(e));

            if (remainingEvents.length === 0) {
                batch.push(updateDoc(d.ref, { isDefault: false, associatedEvents: [] }));
            } else {
                batch.push(updateDoc(d.ref, { associatedEvents: remainingEvents }));
            }
        });

        // 3. Set this template as default for these events
        const effectiveGroupId = groupId || companyId;
        const segs = companySubcollectionPathSegments(effectiveGroupId, companyId, 'companyTemplates');
        batch.push(updateDoc(doc(db, ...segs, templateId), {
            isDefault: true,
            associatedEvents: events,
            updatedAt: new Date().toISOString()
        }));

        await Promise.all(batch);
    }

    /**
     * Submit for approval
     */
    static async submitForApproval(
        companyId: string,
        templateId: string,
        userId: string,
        userName: string,
        groupId?: string | null
    ): Promise<void> {
        const effectiveGroupId = groupId || companyId;
        const segments = companySubcollectionPathSegments(effectiveGroupId, companyId, 'companyTemplates');
        const templateRef = doc(db, ...segments, templateId);
        const entry: ApprovalEntry = {
            status: 'pending_approval',
            userId,
            userName,
            timestamp: new Date().toISOString()
        };

        await updateDoc(templateRef, {
            status: 'pending_approval',
            approvalTrail: [entry],
            updatedAt: new Date().toISOString()
        });
    }

    /**
     * Approve or Reject
     */
    static async recordApproval(
        companyId: string,
        templateId: string,
        status: 'approved' | 'rejected',
        userId: string,
        userName: string,
        comment?: string,
        groupId?: string | null
    ): Promise<void> {
        const effectiveGroupId = groupId || companyId;
        const segments = companySubcollectionPathSegments(effectiveGroupId, companyId, 'companyTemplates');
        const templateRef = doc(db, ...segments, templateId);
        const template = await this.getTemplate(companyId, templateId, groupId);
        if (!template) return;

        const entry: ApprovalEntry = {
            status,
            userId,
            userName,
            timestamp: new Date().toISOString(),
            comment
        };

        await updateDoc(templateRef, {
            status,
            approvalTrail: [...template.approvalTrail, entry],
            rejectionReason: status === 'rejected' ? comment : null,
            updatedAt: new Date().toISOString()
        });
    }

    /**
     * Update template
     */
    static async updateTemplate(
        companyId: string,
        templateId: string,
        updates: Partial<CompanyTemplate>,
        groupId?: string | null
    ): Promise<void> {
        const effectiveGroupId = groupId || companyId;
        const segments = companySubcollectionPathSegments(effectiveGroupId, companyId, 'companyTemplates');
        const templateRef = doc(db, ...segments, templateId);
        await updateDoc(templateRef, {
            ...updates,
            updatedAt: new Date().toISOString(),
        });
    }

    /**
     * Delete template
     */
    static async deleteTemplate(companyId: string, templateId: string, groupId?: string | null): Promise<void> {
        const effectiveGroupId = groupId || companyId;
        const segments = companySubcollectionPathSegments(effectiveGroupId, companyId, 'companyTemplates');
        const templateRef = doc(db, ...segments, templateId);
        await deleteDoc(templateRef);
    }

    /**
     * Get pending templates for a company
     */
    static async getPendingTemplates(companyId: string, groupId?: string | null): Promise<CompanyTemplate[]> {
        const templatesRef = this.getTemplatesRef(companyId, groupId);
        const q = query(templatesRef, where('status', '==', 'pending_approval'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as CompanyTemplate);
    }

    /**
     * Update template status
     */
    static async updateTemplateStatus(
        companyId: string,
        templateId: string,
        status: TemplateStatus,
        rejectionReason?: string,
        groupId?: string | null
    ): Promise<void> {
        const effectiveGroupId = groupId || companyId;
        const segments = companySubcollectionPathSegments(effectiveGroupId, companyId, 'companyTemplates');
        const templateRef = doc(db, ...segments, templateId);
        const template = await this.getTemplate(companyId, templateId, groupId);
        if (!template) return;

        const entry: ApprovalEntry = {
            status,
            userId: 'system',
            userName: 'System',
            timestamp: new Date().toISOString(),
            comment: rejectionReason
        };

        await updateDoc(templateRef, {
            status,
            approvalTrail: [...template.approvalTrail, entry],
            rejectionReason: status === 'rejected' ? rejectionReason : null,
            updatedAt: new Date().toISOString()
        });
    }
}
