export const dynamic = "force-dynamic"
/**
 * CRON Job for Task Lifecycle Monitoring (Server-Side using Admin SDK)
 * 
 * Handles:
 * 1. Overdue Tasks
 * 2. Due Soon Tasks (within 48h)
 * 
 * Logic:
 * - Uses Firebase Admin SDK to bypass security rules (since Cron has no user context)
 * - Iterates all companies -> all assigned/in_progress tasks
 * - Checks due dates
 * - Fetches User Preferences & Contact Info
 * - Triggers Notification via /api/external-notifications/send
 * 
 * Recommended frequency: Hourly
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';
import { sendNotification } from '../../lib/sendNotification';
import {
    enterpriseGroupCompanySubcollectionPath,
    enterpriseGroupUserPath,
} from '@/lib/firestore-paths';

// Helper to determine quiet hours (simplified version of PreferenceService)
function isInQuietHours(prefs: any): boolean {
    if (!prefs?.frequencyLimits?.quietHours?.enabled) return false;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const start = prefs.frequencyLimits.quietHours.start;
    const end = prefs.frequencyLimits.quietHours.end;

    if (start > end) {
        return currentTime >= start || currentTime < end;
    }
    return currentTime >= start && currentTime < end;
}

/** Paths for prefs, user, and notifications. When groupId is set, uses enterprise paths. */
function getPaths(companyId: string, userId: string, groupId?: string | null) {
    if (groupId) {
        return {
            prefsDoc: `${enterpriseGroupCompanySubcollectionPath(groupId, companyId, 'userExternalPreferences')}/${userId}`,
            userDoc: enterpriseGroupUserPath(groupId, userId),
            notificationsCollection: enterpriseGroupCompanySubcollectionPath(groupId, companyId, 'notifications'),
        };
    }
    return {
        prefsDoc: `companies/${companyId}/userExternalPreferences/${userId}`,
        userDoc: `companies/${companyId}/users/${userId}`,
        notificationsCollection: `companies/${companyId}/notifications`,
    };
}

/** Process one company's tasks (root or enterprise). */
async function processCompanyTasks(
    db: Firestore,
    companyId: string,
    groupId: string | null | undefined,
    now: Date,
    notificationPromises: Promise<any>[],
    checksCount: { value: number }
) {
    const tasksCollectionPath = groupId
        ? enterpriseGroupCompanySubcollectionPath(groupId, companyId, 'tasks')
        : `companies/${companyId}/tasks`;

    const tasksSnap = await db.collection(tasksCollectionPath)
        .where('status', 'in', ['assigned', 'in_progress'])
        .get();

    if (tasksSnap.empty) return;

    for (const taskDoc of tasksSnap.docs) {
        const task = taskDoc.data();
        if (!task.dueDate || !task.assignedUserId) continue;

        checksCount.value++;
        const dueDate = new Date(task.dueDate);
        const userId = task.assignedUserId;
        const paths = getPaths(companyId, userId, groupId);

        const diffMs = dueDate.getTime() - now.getTime();
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const hoursUntilDue = Math.floor(diffMs / (1000 * 60 * 60));

        let eventType = '';
        let subject = '';
        let messageBody = '';

        if (daysOverdue > 0) {
            eventType = 'task_overdue';
            subject = `OVERDUE: Task "${task.title}" is ${daysOverdue} days overdue`;
            messageBody = `Task "${task.title}" was due on ${task.dueDate}. Please update the status immediately.`;
        } else if (hoursUntilDue >= 0 && hoursUntilDue <= 48) {
            eventType = 'task_due_soon';
            const urgency = hoursUntilDue <= 4 ? 'URGENT' : 'Reminder';
            subject = `${urgency}: Task "${task.title}" Due Soon`;
            messageBody = `Task "${task.title}" is due in ${hoursUntilDue} hours.`;
        }

        if (!eventType) continue;

        notificationPromises.push((async () => {
            try {
                const prefsDoc = await db.doc(paths.prefsDoc).get();
                const prefs = prefsDoc.exists ? prefsDoc.data() : null;

                const taskPrefs = prefs?.preferences?.[eventType === 'task_due_soon' ? 'taskDueSoon' : 'taskOverdue']
                    || { whatsapp: true, email: true };

                if (prefs && isInQuietHours(prefs)) {
                    console.log(`[CRON] user ${userId} in quiet hours. Skipping.`);
                    return;
                }

                if (!taskPrefs.email && !taskPrefs.whatsapp) return;

                const userDoc = await db.doc(paths.userDoc).get();
                if (!userDoc.exists) return;
                const userData = userDoc.data();

                const phone = userData?.contact?.phone || userData?.phoneNumber || userData?.phone;
                const email = userData?.email;

                const payload = {
                    companyId,
                    recipientUserId: userId,
                    eventType: eventType as 'task_overdue' | 'task_due_soon',
                    channel: 'both' as const,
                    recipientEmail: taskPrefs.email ? email : undefined,
                    recipientPhone: taskPrefs.whatsapp ? phone : undefined,
                    subject,
                    messageBody,
                    priority: 'high' as const,
                    metadata: {
                        taskId: taskDoc.id,
                        taskTitle: task.title,
                        hoursUntilDue,
                        daysOverdue
                    }
                };

                try {
                    const inAppEnabled = prefs?.preferences?.[eventType === 'task_due_soon' ? 'taskDueSoon' : 'taskOverdue']?.inApp !== false;

                    if (inAppEnabled) {
                        await db.collection(paths.notificationsCollection).add({
                            userId,
                            companyId,
                            type: eventType,
                            title: subject,
                            message: messageBody,
                            actionUrl: `/projects/${task.projectId || ''}/tasks/${taskDoc.id}`,
                            priority: 'high',
                            isRead: false,
                            actionRequired: true,
                            metadata: payload.metadata,
                            createdAt: new Date().toISOString()
                        });
                        console.log(`[CRON] In-App Notification created for ${userId}`);
                    }
                } catch (firestoreErr) {
                    console.error('[CRON] Failed to create in-app notification:', firestoreErr);
                }

                await sendNotification(payload);
                console.log(`[CRON] Notified ${userId} for ${eventType}`);
            } catch (innerErr) {
                console.error(`[CRON] Failed for user ${userId} task ${taskDoc.id}`, innerErr);
            }
        })());
    }
}

export async function GET(req: NextRequest) {
    try {
        console.log('[CRON Tasks] Starting task lifecycle check (Admin SDK)...');
        const db = getAdminFirestore();

        const now = new Date();
        const notificationPromises: Promise<any>[] = [];
        const checksCount = { value: 0 };

        // 1. Enterprise groups: iterate enterpriseGroups -> companies -> tasks; use enterprise path for userExternalPreferences, users, notifications
        const groupsSnap = await db.collection('enterpriseGroups').get();
        for (const groupDoc of groupsSnap.docs) {
            const groupId = groupDoc.id;
            const companiesSnap = await db.collection(`enterpriseGroups/${groupId}/companies`).get();
            for (const companyDoc of companiesSnap.docs) {
                await processCompanyTasks(db, companyDoc.id, groupId, now, notificationPromises, checksCount);
            }
        }

        // 2. Root companies (standalone): use companies/{id}/userExternalPreferences, companies/{id}/users, etc.
        const rootCompaniesSnap = await db.collection('companies').get();
        for (const companyDoc of rootCompaniesSnap.docs) {
            await processCompanyTasks(db, companyDoc.id, null, now, notificationPromises, checksCount);
        }

        await Promise.allSettled(notificationPromises);

        return NextResponse.json({
            success: true,
            checked: checksCount.value,
            triggered: notificationPromises.length
        });

    } catch (error: any) {
        console.error('[CRON Tasks] Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
