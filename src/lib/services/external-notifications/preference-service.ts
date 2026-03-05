/**
 * Preference Service - Manages User External Notification Preferences
 * 
 * Handles user opt-in/opt-out for external channels (WhatsApp, Email)
 * Following path-based multi-tenancy pattern.
 */

import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { companySubcollectionPathSegments } from '@/lib/firestore-paths';
import type { UserExternalPreferences } from '@/types/external-notifications';

export class PreferenceService {
    /**
     * Get doc reference for user preferences.
     * Always uses enterpriseGroups path structure - uses companyId as groupId fallback if needed
     */
    private static getPreferenceRef(companyId: string, userId: string, groupId?: string | null) {
        // Always use enterpriseGroups path - use companyId as groupId fallback if needed
        const effectiveGroupId = groupId || companyId;
        const segments = companySubcollectionPathSegments(effectiveGroupId, companyId, 'userExternalPreferences');
        return doc(db, ...segments, userId);
    }

    /**
     * Get default preferences for new users
     */
    private static getDefaultPreferences(userId: string, companyId: string): UserExternalPreferences {
        return {
            id: userId,
            userId,
            companyId,
            preferences: {
                // Task Lifecycle
                taskAssigned: { whatsapp: true, email: true, inApp: true },
                commentMention: { whatsapp: true, email: true, inApp: true },
                taskDueSoon: { whatsapp: true, email: true, inApp: true },
                taskOverdue: { whatsapp: true, email: true, inApp: true },
                taskCompleted: { whatsapp: false, email: false, inApp: true },
                taskUpdated: { whatsapp: false, email: false, inApp: true },

                // Approval Workflow
                approvalRequired: { whatsapp: true, email: true, inApp: true },
                approvalApproved: { whatsapp: true, email: true, inApp: true },
                approvalRejected: { whatsapp: true, email: true, inApp: true },

                // Recurring Tasks
                recurringTaskGenerated: { whatsapp: false, email: true, inApp: true },
                recurringConfigUpdated: { whatsapp: true, email: true, inApp: true },
                ghostTaskAlert: { whatsapp: true, email: true, inApp: true },
                ghostTaskResolved: { whatsapp: true, email: true, inApp: true },
                recurringTaskPaused: { whatsapp: true, email: true, inApp: true },
                recurringTaskReactivated: { whatsapp: true, email: true, inApp: true },
                recurringScheduleEnded: { whatsapp: true, email: true, inApp: true },

                // Project Management
                projectCreated: { whatsapp: false, email: true, inApp: true },
                projectUpdated: { whatsapp: false, email: false, inApp: true },
                projectMilestone: { whatsapp: true, email: true, inApp: true },

                // System
                qualityAlert: { whatsapp: true, email: true, inApp: true },
                systemAnnouncement: { whatsapp: false, email: true, inApp: true },
            },
            frequencyLimits: {
                maxPerHour: 10,
                maxPerDay: 50,
                quietHours: {
                    enabled: false,
                    start: '22:00',
                    end: '08:00',
                },
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
    }

    /**
     * Get user preferences (creates default if not exists).
     * When groupId is set, uses enterprise path.
     */
    static async getUserPreferences(
        companyId: string,
        userId: string,
        groupId?: string | null
    ): Promise<UserExternalPreferences> {
        const prefRef = this.getPreferenceRef(companyId, userId, groupId);
        const snapshot = await getDoc(prefRef);

        const defaultPrefs = this.getDefaultPreferences(userId, companyId);

        if (!snapshot.exists()) {
            // Create default preferences
            await setDoc(prefRef, defaultPrefs);
            return defaultPrefs;
        }

        const data = snapshot.data() as UserExternalPreferences;

        // Merge stored preferences with defaults to ensure all keys are present
        // This handles migration for users created before new notification types were added
        const mergedPreferences = {
            ...defaultPrefs.preferences,
            ...(data.preferences || {})
        };

        return {
            ...data,
            preferences: mergedPreferences
        };
    }

    /**
     * Update user preferences
     */
    static async updateUserPreferences(
        companyId: string,
        userId: string,
        updates: Partial<UserExternalPreferences>,
        groupId?: string | null
    ): Promise<void> {
        const prefRef = this.getPreferenceRef(companyId, userId, groupId);

        await updateDoc(prefRef, {
            ...updates,
            updatedAt: new Date().toISOString(),
        });
    }

    /**
     * Update task assignment preferences
     */
    static async updateTaskAssignedPreferences(
        companyId: string,
        userId: string,
        whatsapp: boolean,
        email: boolean,
        groupId?: string | null
    ): Promise<void> {
        const prefRef = this.getPreferenceRef(companyId, userId, groupId);

        await updateDoc(prefRef, {
            'preferences.taskAssigned.whatsapp': whatsapp,
            'preferences.taskAssigned.email': email,
            updatedAt: new Date().toISOString(),
        });
    }

    /**
     * Update comment mention preferences
     */
    static async updateCommentMentionPreferences(
        companyId: string,
        userId: string,
        whatsapp: boolean,
        email: boolean,
        groupId?: string | null
    ): Promise<void> {
        const prefRef = this.getPreferenceRef(companyId, userId, groupId);

        await updateDoc(prefRef, {
            'preferences.commentMention.whatsapp': whatsapp,
            'preferences.commentMention.email': email,
            updatedAt: new Date().toISOString(),
        });
    }

    /**
     * Update quiet hours
     */
    static async updateQuietHours(
        companyId: string,
        userId: string,
        enabled: boolean,
        start?: string,
        end?: string,
        groupId?: string | null
    ): Promise<void> {
        const prefRef = this.getPreferenceRef(companyId, userId, groupId);

        const updates: any = {
            'frequencyLimits.quietHours.enabled': enabled,
            updatedAt: new Date().toISOString(),
        };

        if (start) updates['frequencyLimits.quietHours.start'] = start;
        if (end) updates['frequencyLimits.quietHours.end'] = end;

        await updateDoc(prefRef, updates);
    }

    /**
     * Check if user has opted in for a specific event and channel
     */
    static async hasOptedIn(
        companyId: string,
        userId: string,
        eventType: 'taskAssigned' | 'commentMention',
        channel: 'whatsapp' | 'email',
        groupId?: string | null
    ): Promise<boolean> {
        const prefs = await this.getUserPreferences(companyId, userId, groupId);
        return prefs.preferences[eventType][channel];
    }

    /**
     * Generic update for any category/channel
     */
    static async updateCategoryPreference(
        companyId: string,
        userId: string,
        category: string,
        channel: 'whatsapp' | 'email' | 'inApp',
        value: boolean,
        groupId?: string | null
    ): Promise<void> {
        const prefRef = this.getPreferenceRef(companyId, userId, groupId);
        const fieldPath = `preferences.${category}.${channel}`;

        await updateDoc(prefRef, {
            [fieldPath]: value,
            updatedAt: new Date().toISOString(),
        });
    }

    /**
     * Check if notification should be sent based on quiet hours
     */
    static isInQuietHours(prefs: UserExternalPreferences): boolean {
        if (!prefs?.frequencyLimits?.quietHours?.enabled) {
            return false;
        }

        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        const start = prefs.frequencyLimits.quietHours.start;
        const end = prefs.frequencyLimits.quietHours.end;

        // Handle overnight quiet hours (e.g., 22:00 - 08:00)
        if (start > end) {
            return currentTime >= start || currentTime < end;
        }

        // Handle same-day quiet hours (e.g., 12:00 - 14:00)
        return currentTime >= start && currentTime < end;
    }
}
