/**
 * External Notification Orchestrator
 * 
 * This service sits between the business logic (Task/Comment services) and 
 * the API Gateway. It handles:
 * 1. Fetching User Preferences
 * 2. Fetching User Contact Info (Email/Phone)
 * 3. Determining Priority
 * 4. Calling the Secure API Gateway
 */

import { PreferenceService } from './preference-service';
import { getPriorityForEvent, EventType, UserExternalPreferences, ChannelPreference } from '@/types/external-notifications';
import { UserService } from '@/lib/services/users/user-services';
import { TenantService } from './tenant-service';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { companySubcollectionPathSegments } from '@/lib/firestore-paths';
import { toast } from 'react-hot-toast';

const PREFERENCE_CATEGORY_MAP: Record<string, string> = {
    // Task Assignments
    'task_assigned': 'taskAssigned',
    'rft_task_assigned': 'taskAssigned',
    'task_reassigned': 'taskAssigned',
    'workspace_task_request': 'taskAssigned',

    // Task Reminders
    'task_due_soon': 'taskDueSoon',
    'due_date_reminder': 'taskDueSoon',

    // Task Lifecycle (Direct)
    'task_overdue': 'taskOverdue',
    'task_completed': 'taskCompleted',
    'task_updated': 'taskUpdated',
    'comment_mention': 'commentMention',

    // Approvals
    'approval_required': 'approvalRequired',
    'approval_approved': 'approvalApproved',
    'approval_rejected': 'approvalRejected',

    // Recurring Tasks
    'recurring_task_generated': 'recurringTaskGenerated',
    'recurring_config_updated': 'recurringConfigUpdated',
    'ghost_task_alert': 'ghostTaskAlert',
    'ghost_task_resolved': 'ghostTaskResolved',
    'recurring_task_paused': 'recurringTaskPaused',
    'recurring_task_reactivated': 'recurringTaskReactivated',
    'recurring_schedule_ended': 'recurringScheduleEnded',

    // Projects
    'project_created': 'projectCreated',
    'project_updated': 'projectUpdated',
    'project_milestone': 'projectMilestone',

    // System
    'quality_alert': 'qualityAlert',
    'system_announcement': 'systemAnnouncement',
    'workspace_admin_promoted': 'systemAnnouncement',
    'workspace_admin_demoted': 'systemAnnouncement',

    // Workflows
    'workflow_completed': 'taskCompleted',
};

export class ExternalNotificationService {
    /**
     * Main entry point to trigger a notification.
     * When groupId is set, in-app notification is written to enterpriseGroups/{groupId}/companies/{companyId}/notifications.
     */
    static async triggerNotification(
        companyId: string,
        userId: string,
        eventType: EventType,
        data: {
            subject: string;
            messageBody: string;
            actionUrl?: string;
            metadata?: Record<string, any>;
        },
        groupId?: string | null
    ) {
        try {
            console.log(`[ExtNotify] Triggering ${eventType} for user ${userId}. GroupId passed: ${groupId}`);

            // 1. Get User Preferences and Tenant Config
            const [rawPrefs, tenantConfig] = await Promise.all([
                PreferenceService.getUserPreferences(companyId, userId, groupId ?? undefined),
                TenantService.getTenantNotificationConfig(companyId, groupId ?? undefined)
            ]);

            const publicBaseUrl = tenantConfig?.publicBaseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

            // Critical check for prefs and prefs.preferences
            if (!rawPrefs || !rawPrefs.preferences) {
                console.warn('[ExtNotify] Preferences missing for user:', userId);
                return;
            }

            const prefs = rawPrefs as UserExternalPreferences;

            // Check Quiet Hours
            if (PreferenceService.isInQuietHours(prefs)) {
                console.log('[ExtNotify] Skipped due to Quiet Hours');
                return;
            }

            // 2. Construct Absolute URL if relative
            let actionUrl = data.actionUrl || null;
            if (actionUrl && !actionUrl.startsWith('http')) {
                const base = publicBaseUrl.endsWith('/') ? publicBaseUrl.slice(0, -1) : publicBaseUrl;
                const path = actionUrl.startsWith('/') ? actionUrl : `/${actionUrl}`;
                actionUrl = `${base}${path}`;
            }

            // 3. Determine which category and channels are active for this event
            const preferenceKey = PREFERENCE_CATEGORY_MAP[eventType] ||
                eventType.replace(/_([a-z])/g, (g) => (g[1] || '').toUpperCase());

            // Type-safe lookup
            const preferences = prefs.preferences as Record<string, any>;
            const eventPrefs: ChannelPreference = preferences[preferenceKey] ||
                { whatsapp: true, email: true, inApp: true };

            if (!eventPrefs.inApp && !eventPrefs.email && !eventPrefs.whatsapp) {
                console.log(`[ExtNotify] All channels disabled for category ${preferenceKey} (event: ${eventType})`);
                return;
            }

            // ------------------------------------------------------------------
            // IN-APP NOTIFICATION (Frontend/Firestore)
            // ------------------------------------------------------------------
            if (eventPrefs.inApp) {
                try {
                    // Firestore doesn't allow 'undefined' fields. We must sanitize metadata.
                    const sanitizedMetadata: Record<string, any> = {};
                    if (data.metadata) {
                        Object.entries(data.metadata).forEach(([key, value]) => {
                            if (value !== undefined) {
                                sanitizedMetadata[key] = value;
                            }
                        });
                    }

                    // Always use enterprise groups path. 
                    // WARNING: If groupId is missing, we fallback to companyId which may cause 'Missing or insufficient permissions' 
                    // if the group ID does not match the company ID.
                    if (!groupId) {
                        console.warn(`[ExtNotify] Triggered for user ${userId} without groupId. Falling back to companyId ${companyId}. This may fail Firestore security rules.`);
                    }
                    const effectiveGroupId = groupId || companyId
                    const segments = companySubcollectionPathSegments(effectiveGroupId, companyId, 'notifications')
                    const notifRef = collection(db, segments[0], ...segments.slice(1))

                    // Extract common IDs for top-level access if available
                    const projectId = data.metadata?.projectId || null;
                    const taskId = data.metadata?.taskId || null;

                    const notificationData = {
                        userId: userId,
                        companyId: companyId,
                        type: eventType,
                        title: data.subject,
                        message: data.messageBody,
                        priority: getPriorityForEvent(eventType),
                        isRead: false,
                        actionRequired: true,
                        actionUrl: actionUrl,
                        projectId: projectId,
                        taskId: taskId,
                        metadata: sanitizedMetadata,
                        createdAt: new Date().toISOString()
                    };

                    // Sanitize: Firestore doesn't accept 'undefined' fields
                    const sanitizedNotifData = Object.fromEntries(
                        Object.entries(notificationData).filter(([_, v]) => v !== undefined)
                    );

                    const docRef = await addDoc(notifRef, sanitizedNotifData);
                    console.log('[ExtNotify] In-App notification created', { id: docRef.id, actionUrl });
                } catch (err) {
                    console.error('[ExtNotify] Failed to create in-app notification:', err);
                }
            }

            if (!eventPrefs.email && !eventPrefs.whatsapp) {
                console.log('[ExtNotify] User disabled external channels');
                return;
            }

            // 3. Get User Contact Info
            const user = await UserService.getUser(companyId, userId, groupId ?? undefined);
            if (!user) {
                console.warn('[ExtNotify] User not found:', userId);
                return;
            }

            // 4. Prepare Payload
            const rawPhone = user.contact?.phone || (user as any).phoneNumber || (user as any).phone;

            // Debugging phone extraction
            if (!rawPhone || rawPhone === 'Not provided') {
                console.log('[ExtNotify] Phone check failed. User structure:', JSON.stringify({
                    id: user.id,
                    contact: user.contact,
                    phoneNumber: (user as any).phoneNumber,
                    phone: (user as any).phone
                }));
            }

            const hasValidPhone = rawPhone && rawPhone !== 'Not provided';

            if (eventPrefs.whatsapp && !hasValidPhone) {
                console.warn('[ExtNotify] WhatsApp enabled but no valid phone found:', userId);
            }

            const payload = {
                companyId,
                groupId: groupId || undefined,
                recipientUserId: userId,
                eventType,
                channel: 'both',
                recipientEmail: eventPrefs.email ? user.email : undefined,
                recipientPhone: (eventPrefs.whatsapp && hasValidPhone) ? rawPhone : undefined,
                subject: data.subject,
                messageBody: data.messageBody,
                priority: getPriorityForEvent(eventType),
                templateData: {
                    ...data.metadata,
                    recipientName: user.name || user.email?.split('@')[0],
                    actorName: data.metadata?.actorName || data.metadata?.assignerName || data.metadata?.requestedBy || data.metadata?.commenterName || 'Teammate',
                    objectTitle: data.metadata?.objectTitle || data.metadata?.taskTitle || data.metadata?.projectName || data.metadata?.alertTitle || 'Notification',
                    primaryCtaUrl: actionUrl || data.metadata?.actionUrl,
                }
            };

            if (!payload.recipientEmail && !payload.recipientPhone) {
                return;
            }

            const isClient = typeof document !== 'undefined';
            const baseUrl = isClient ? '' : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');

            console.log('[ExtNotify] Preparing fetch. isClient:', isClient, 'baseUrl:', baseUrl);

            const response = await fetch(`${baseUrl}/api/external-notifications/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            console.log('[ExtNotify] Server Response:', result);

            // 5. Provide UI Feedback (Toasts) if on client
            if (isClient) {
                const results = [];
                if (payload.recipientEmail) {
                    const sent = result.channels?.email?.sent;
                    results.push(`Email: ${sent ? '✅ Sent' : '❌ Not Sent'}`);
                }
                if (payload.recipientPhone) {
                    const sent = result.channels?.whatsapp?.sent;
                    results.push(`WhatsApp: ${sent ? '✅ Sent' : '❌ Not Sent'}`);
                }

                if (results.length > 0) {
                    const message = results.join('\n');
                    if (result.success) {
                        toast.success(message, { id: `ext-notify-${Date.now()}` });
                    } else {
                        toast.error(message, { id: `ext-notify-${Date.now()}` });
                    }
                }
            }

            if (result.success) {
                console.log('[ExtNotify] Notification orchestrated successfully');
            } else {
                console.warn('[ExtNotify] Server reported failure:', result.channels);
            }

            return result;

        } catch (error) {
            console.error('[ExtNotify] Orchestration Failed:', error);
            if (typeof document !== 'undefined') {
                toast.error('Failed to send external notifications');
            }
            return { success: false, error };
        }
    }

    // ==========================================================================
    // CONVENIENCE METHODS
    // ==========================================================================

    static async notifyTaskAssigned(
        companyId: string,
        assigneeId: string,
        taskTitle: string,
        assignerName: string,
        projectId?: string,
        taskId?: string,
        groupId?: string | null
    ) {
        const actionUrl = projectId && taskId ? `/projects/${projectId}/tasks/${taskId}` : undefined;
        return this.triggerNotification(companyId, assigneeId, 'task_assigned', {
            subject: `New Task Assigned: ${taskTitle}`,
            messageBody: `Hello, ${assignerName} has assigned you a new task: "${taskTitle}". Please check your dashboard for details.`,
            actionUrl,
            metadata: {
                taskTitle,
                assignerName,
                actorName: assignerName,
                objectTitle: taskTitle,
                projectId,
                taskId
            }
        }, groupId);
    }

    /**
     * Notify user/owner of an RFT task assignment
     */
    static async notifyRFTTaskAssigned(
        companyId: string,
        recipientId: string,
        requestorName: string,
        requestorWorkspaceName: string,
        taskName: string,
        projectId?: string,
        taskId?: string,
        groupId?: string | null
    ) {
        const actionUrl = projectId && taskId ? `/projects/${projectId}/tasks/${taskId}` : undefined;
        return this.triggerNotification(companyId, recipientId, 'rft_task_assigned', {
            subject: `Workspace Request from ${requestorWorkspaceName}`,
            messageBody: `Workspace Request: ${requestorName} from ${requestorWorkspaceName} has sent a request ${taskName}. Please review it at your convenience.`,
            actionUrl,
            metadata: {
                requestorName,
                requestorWorkspaceName,
                taskName,
                actorName: requestorName,
                objectTitle: taskName,
                projectId,
                taskId
            }
        }, groupId);
    }

    static async notifyProjectCreated(
        companyId: string,
        managerId: string,
        projectName: string,
        creatorName: string,
        projectId?: string,
        groupId?: string | null
    ) {
        // Silenced: return early to skip notification
        return;

        const actionUrl = projectId ? `/projects/${projectId}` : undefined;
        return this.triggerNotification(companyId, managerId, 'project_created', {
            subject: `New Project Assigned: ${projectName}`,
            messageBody: `Hello, you have been assigned as the manager for the new project: "${projectName}" by ${creatorName}.`,
            actionUrl,
            metadata: { projectName, creatorName, projectId, actorName: creatorName }
        }, groupId);
    }

    static async notifyTaskReassigned(
        companyId: string,
        newAssigneeId: string,
        taskTitle: string,
        previousAssigneeName: string,
        newAssigneeName: string,
        projectId?: string,
        taskId?: string,
        groupId?: string | null
    ) {
        const actionUrl = projectId && taskId ? `/projects/${projectId}/tasks/${taskId}` : undefined;
        return this.triggerNotification(companyId, newAssigneeId, 'task_reassigned', {
            subject: `Task Reassigned: ${taskTitle}`,
            messageBody: `The task "${taskTitle}" has been reassigned from ${previousAssigneeName} to you.`,
            actionUrl,
            metadata: {
                taskTitle,
                objectTitle: taskTitle,
                previousAssignee: previousAssigneeName,
                newAssignee: newAssigneeName,
                actorName: previousAssigneeName,
                projectId,
                taskId
            }
        }, groupId);
    }

    static async notifyCommentMention(
        companyId: string,
        mentionedUserId: string,
        taskTitle: string,
        commenterName: string,
        commentText: string,
        projectId?: string,
        taskId?: string,
        groupId?: string | null
    ) {
        const actionUrl = projectId && taskId ? `/projects/${projectId}/tasks/${taskId}` : undefined;
        return this.triggerNotification(companyId, mentionedUserId, 'comment_mention', {
            subject: `You were mentioned in "${taskTitle}"`,
            messageBody: `${commenterName} mentioned you: "${commentText}"`,
            actionUrl,
            metadata: {
                taskTitle,
                objectTitle: taskTitle,
                actorName: commenterName,
                commenterName,
                commentPreview: commentText,
                commentText,
                projectId,
                taskId
            }
        }, groupId);
    }

    // ==========================================================================
    // TASK LIFECYCLE METHODS
    // ==========================================================================

    static async notifyTaskDueSoon(
        companyId: string,
        userId: string,
        taskTitle: string,
        hoursUntilDue: number,
        dueDate: string,
        projectId?: string,
        taskId?: string,
        groupId?: string | null
    ) {
        const urgency = hoursUntilDue <= 2 ? 'URGENT' : hoursUntilDue <= 24 ? 'Important' : 'Reminder';
        const actionUrl = projectId && taskId ? `/projects/${projectId}/tasks/${taskId}` : undefined;
        return this.triggerNotification(companyId, userId, 'task_due_soon', {
            subject: `${urgency}: Task "${taskTitle}" Due Soon`,
            messageBody: `Task "${taskTitle}" is due in ${hoursUntilDue} hours (${dueDate}). Please complete it soon.`,
            actionUrl,
            metadata: { taskTitle, hoursUntilDue, dueDate, projectId, taskId }
        }, groupId);
    }

    static async notifyDueDateReminder(
        companyId: string,
        userId: string,
        taskTitle: string,
        dueAt: string,
        projectId?: string,
        taskId?: string,
        groupId?: string | null
    ) {
        const actionUrl = projectId && taskId ? `/projects/${projectId}/tasks/${taskId}` : undefined;
        return this.triggerNotification(companyId, userId, 'due_date_reminder', {
            subject: `Reminder: Task "${taskTitle}" is due tomorrow`,
            messageBody: `Your task "${taskTitle}" is due on ${dueAt}.`,
            actionUrl,
            metadata: {
                objectTitle: taskTitle,
                dueAt,
                timeRemaining: '24 hours',
                projectId,
                taskId
            }
        }, groupId);
    }

    static async notifyTaskOverdue(
        companyId: string,
        userId: string,
        taskTitle: string,
        daysOverdue: number,
        dueDate: string,
        projectId?: string,
        taskId?: string,
        groupId?: string | null
    ) {
        const actionUrl = projectId && taskId ? `/projects/${projectId}/tasks/${taskId}` : undefined;
        return this.triggerNotification(companyId, userId, 'task_overdue', {
            subject: `OVERDUE: Task "${taskTitle}" is ${daysOverdue} days overdue`,
            messageBody: `Task "${taskTitle}" was due on ${dueDate} and is now ${daysOverdue} days overdue. Please take immediate action.`,
            actionUrl,
            metadata: {
                taskTitle,
                daysOverdue,
                dueDate,
                actionMessage: `Task "${taskTitle}" is now ${daysOverdue} days overdue.`,
                dueAt: dueDate,
                escalationLevel: daysOverdue > 7 ? 2 : 1,
                objectTitle: taskTitle,
                projectId,
                taskId
            }
        }, groupId);
    }

    static async notifyTaskCompleted(
        companyId: string,
        userId: string,
        taskTitle: string,
        completedBy: string,
        projectId?: string,
        taskId?: string,
        groupId?: string | null
    ) {
        const actionUrl = projectId && taskId ? `/projects/${projectId}/tasks/${taskId}` : undefined;
        return this.triggerNotification(companyId, userId, 'task_completed', {
            subject: `Task Completed: "${taskTitle}"`,
            messageBody: `Task "${taskTitle}" has been marked as completed by ${completedBy}.`,
            actionUrl,
            metadata: { taskTitle, completedBy, projectId, taskId }
        }, groupId);
    }

    static async notifyTaskUpdated(
        companyId: string,
        userId: string,
        taskTitle: string,
        updateType: string,
        updatedBy: string,
        projectId?: string,
        taskId?: string,
        groupId?: string | null
    ) {
        const actionUrl = projectId && taskId ? `/projects/${projectId}/tasks/${taskId}` : undefined;
        return this.triggerNotification(companyId, userId, 'task_updated', {
            subject: `Task Updated: "${taskTitle}"`,
            messageBody: `Task "${taskTitle}" has been updated by ${updatedBy}. Change: ${updateType}`,
            actionUrl,
            metadata: { taskTitle, updateType, updatedBy, projectId, taskId }
        }, groupId);
    }

    // ==========================================================================
    // APPROVAL WORKFLOW METHODS
    // ==========================================================================

    static async notifyApprovalRequired(
        companyId: string,
        approverId: string,
        taskTitle: string,
        requestedBy: string,
        projectId?: string,
        taskId?: string,
        groupId?: string | null,
        actionUrl?: string
    ) {
        const finalActionUrl = actionUrl || (projectId && taskId ? `/projects/${projectId}/tasks/${taskId}` : undefined);
        return this.triggerNotification(companyId, approverId, 'approval_required', {
            subject: `Approval Required: ${requestedBy} has requested your approval for task ${taskTitle}`,
            messageBody: `Approval Required: ${requestedBy} has requested your approval for task ${taskTitle}.\nPlease review the request below.`,
            actionUrl: finalActionUrl,
            metadata: {
                taskTitle,
                requestedBy,
                actorName: requestedBy,
                objectTitle: taskTitle,
                resourceType: 'Task',
                resourceName: taskTitle,
                dueAt: 'N/A',
                projectId,
                taskId
            }
        }, groupId);
    }

    static async notifyApprovalStatusChange(
        companyId: string,
        userId: string,
        taskTitle: string,
        status: 'approved' | 'rejected',
        approverName: string,
        reason?: string,
        projectId?: string,
        taskId?: string,
        groupId?: string | null
    ) {
        const eventType = status === 'approved' ? 'approval_approved' : 'approval_rejected';
        const statusText = status === 'approved' ? 'Approved' : 'Rejected';
        const actionUrl = projectId && taskId ? `/projects/${projectId}/tasks/${taskId}` : undefined;

        return this.triggerNotification(companyId, userId, eventType, {
            subject: `Task ${statusText}: "${taskTitle}"`,
            messageBody: reason
                ? `Your task "${taskTitle}" has been ${status} by ${approverName}. Reason: ${reason}`
                : `Your task "${taskTitle}" has been ${status} by ${approverName}.`,
            actionUrl,
            metadata: { taskTitle, status, approverName, reason, projectId, taskId }
        }, groupId);
    }

    static async notifyWorkflowCompleted(
        companyId: string,
        userId: string,
        workflowName: string,
        resourceType: string,
        resourceName: string,
        actionUrl?: string,
        groupId?: string | null
    ) {
        return this.triggerNotification(companyId, userId, 'workflow_completed', {
            subject: `🚀 Workflow Completed: ${workflowName}`,
            messageBody: `The workflow "${workflowName}" has been finished successfully for ${resourceType} "${resourceName}".`,
            actionUrl,
            metadata: {
                objectTitle: workflowName,
                resourceType,
                resourceName
            }
        }, groupId);
    }

    static async notifyApprovalRejected(
        companyId: string,
        userId: string,
        resourceName: string,
        rejectedBy: string,
        rejectionReason?: string,
        actionUrl?: string,
        groupId?: string | null
    ) {
        const reasonText = rejectionReason ? `: ${rejectionReason}` : ''
        return this.triggerNotification(companyId, userId, 'approval_rejected', {
            subject: `❌ Task Rejected: ${resourceName}`,
            messageBody: `Your task "${resourceName}" was rejected by ${rejectedBy}${reasonText}. Please review and resubmit.`,
            actionUrl,
            metadata: {
                objectTitle: resourceName,
                rejectedBy,
                rejectionReason
            }
        }, groupId);
    }

    // ==========================================================================
    // RECURRING TASK NOTIFICATION METHODS 
    // ==========================================================================

    static async notifyGhostTaskAlert(
        companyId: string,
        adminIds: string[],
        configId: string,
        taskTitle: string,
        reason: 'position_vacant' | 'user_inactive' | 'permission_denied',
        workspaceName: string,
        groupId?: string | null
    ) {
        // Silenced: return early to skip notification
        return Promise.resolve([]);

        const reasonText = reason === 'position_vacant'
            ? 'Position is vacant'
            : reason === 'user_inactive'
                ? 'User is inactive'
                : 'No valid assignee found';

        const promises = adminIds.map(adminUserId => {
            const relativePath = `/recurring-tasks?edit=${configId}`;
            return this.triggerNotification(companyId, adminUserId, 'ghost_task_alert', {
                subject: `🚨 Ghost Task Alert: "${taskTitle}"`,
                messageBody: `The recurring task "${taskTitle}" in workspace "${workspaceName}" has become a Ghost Task.\n\nReason: ${reasonText}\n\nPlease reassign it to ensure continued execution.`,
                actionUrl: relativePath,
                metadata: { configId, taskTitle, reason, workspaceName }
            }, groupId);
        });

        return Promise.allSettled(promises);
    }

    static async notifyGhostTaskResolved(
        companyId: string,
        adminUserId: string,
        taskTitle: string,
        resolvedBy: string,
        newAssignment: string,
        configId: string,
        groupId?: string | null
    ) {
        // Silenced: return early to skip notification
        return;

        const actionUrl = `/recurring-tasks?edit=${configId}`;
        return this.triggerNotification(companyId, adminUserId, 'ghost_task_resolved', {
            subject: `✅ Ghost Task Resolved: "${taskTitle}"`,
            messageBody: `The ghost task "${taskTitle}" has been resolved by ${resolvedBy}.\n\nNew assignment: ${newAssignment}\n\nThe task will resume normal execution on its next scheduled run.`,
            actionUrl,
            metadata: { taskTitle, resolvedBy, newAssignment, configId, taskId: configId }
        }, groupId);
    }

    static async notifyRecurringTaskGenerated(
        companyId: string,
        userId: string,
        taskTitle: string,
        scheduledDate: string,
        dueDate: string,
        configId: string,
        taskId?: string, // The generated task ID
        projectId?: string,
        groupId?: string | null
    ) {
        // Silenced: return early to skip notification
        return;

        const actionUrl = projectId && taskId ? `/projects/${projectId}/tasks/${taskId}` : `/recurring-tasks?edit=${configId}`;
        return this.triggerNotification(companyId, userId, 'recurring_task_generated', {
            subject: `📋 New Recurring Task: "${taskTitle}"`,
            messageBody: `A new instance of the recurring task "${taskTitle}" has been generated for ${scheduledDate}.\n\nDue Date: ${dueDate}\n\nThis task was automatically created from your recurring schedule.`,
            actionUrl,
            metadata: { taskTitle, scheduledDate, dueDate, configId, taskId, projectId }
        }, groupId);
    }

    static async notifyRecurringConfigUpdated(
        companyId: string,
        affectedUserIds: string[],
        taskTitle: string,
        changedFields: string[],
        updatedBy: string,
        configId: string,
        groupId?: string | null
    ) {
        // Silenced: return early to skip notification
        return Promise.resolve([]);

        const fieldsText = changedFields.join(', ');
        const actionUrl = `/recurring-tasks?edit=${configId}`;
        const promises = affectedUserIds.map(userId =>
            this.triggerNotification(companyId, userId, 'recurring_config_updated', {
                subject: `⚙️ Recurring Task Config Updated: "${taskTitle}"`,
                messageBody: `The recurring task "${taskTitle}" has been updated by ${updatedBy}.\n\nChanged fields: ${fieldsText}\n\nThis may affect your upcoming task assignments.`,
                actionUrl,
                metadata: { taskTitle, changedFields, updatedBy, configId }
            }, groupId)
        );

        return Promise.allSettled(promises);
    }

    static async notifyRecurringTaskPaused(
        companyId: string,
        affectedUserIds: string[],
        taskTitle: string,
        pausedBy: string,
        configId: string,
        reason?: string,
        groupId?: string | null
    ) {
        // Silenced: return early to skip notification
        return Promise.resolve([]);

        const actionUrl = `/recurring-tasks?edit=${configId}`;
        const promises = affectedUserIds.map(userId =>
            this.triggerNotification(companyId, userId, 'recurring_task_paused', {
                subject: `⏸️ Recurring Task Paused: "${taskTitle}"`,
                messageBody: `The recurring task "${taskTitle}" has been paused by ${pausedBy}.${reason ? `\n\nReason: ${reason}` : ''}\n\nNo new instances will be generated until the task is reactivated.`,
                actionUrl,
                metadata: { taskTitle, pausedBy, reason, configId }
            }, groupId)
        );

        return Promise.allSettled(promises);
    }

    static async notifyRecurringTaskReactivated(
        companyId: string,
        affectedUserIds: string[],
        taskTitle: string,
        reactivatedBy: string,
        nextRunDate: string,
        configId: string,
        groupId?: string | null
    ) {
        // Silenced: return early to skip notification
        return Promise.resolve([]);

        const actionUrl = `/recurring-tasks?edit=${configId}`;
        const promises = affectedUserIds.map(userId =>
            this.triggerNotification(companyId, userId, 'recurring_task_reactivated', {
                subject: `▶️ Recurring Task Reactivated: "${taskTitle}"`,
                messageBody: `The recurring task "${taskTitle}" has been reactivated by ${reactivatedBy}.\n\nNext scheduled run: ${nextRunDate}\n\nTask generation will resume according to the defined schedule.`,
                actionUrl,
                metadata: { taskTitle, reactivatedBy, nextRunDate, configId }
            }, groupId)
        );

        return Promise.allSettled(promises);
    }

    static async notifyRecurringScheduleEnded(
        companyId: string,
        affectedUserIds: string[],
        taskTitle: string,
        endReason: 'date_reached' | 'occurrence_count_reached',
        totalTasksGenerated: number,
        configId: string,
        groupId?: string | null
    ) {
        // Silenced: return early to skip notification
        return Promise.resolve([]);

        const reasonText = endReason === 'date_reached'
            ? 'The end date has been reached'
            : `The target occurrence count has been reached`;
        const actionUrl = `/recurring-tasks?edit=${configId}`;

        const promises = affectedUserIds.map(userId =>
            this.triggerNotification(companyId, userId, 'recurring_schedule_ended', {
                subject: `🏁 Recurring Task Schedule Ended: "${taskTitle}"`,
                messageBody: `The recurring schedule for "${taskTitle}" has ended.\n\nReason: ${reasonText}\nTotal tasks generated: ${totalTasksGenerated}\n\nThe task has been automatically archived.`,
                actionUrl,
                metadata: { taskTitle, endReason, totalTasksGenerated, configId }
            }, groupId)
        );

        return Promise.allSettled(promises);
    }

    // ==========================================================================
    // PROJECT MANAGEMENT METHODS
    // ==========================================================================

    static async notifyProjectUpdate(
        companyId: string,
        userId: string,
        projectName: string,
        updateType: 'created' | 'updated' | 'milestone',
        updateDetails: string,
        projectId?: string,
        groupId?: string | null
    ) {
        // Silenced: return early to skip notification
        return;

        const eventType = updateType === 'created' ? 'project_created'
            : updateType === 'milestone' ? 'project_milestone'
                : 'project_updated';
        const actionUrl = projectId ? `/projects/${projectId}` : undefined;

        return this.triggerNotification(companyId, userId, eventType, {
            subject: `Project ${updateType === 'created' ? 'Created' : updateType === 'milestone' ? 'Milestone' : 'Update'}: "${projectName}"`,
            messageBody: updateDetails,
            actionUrl,
            metadata: { projectName, updateType, projectId }
        }, groupId);
    }

    // ==========================================================================
    // SYSTEM NOTIFICATION METHODS
    // ==========================================================================

    static async notifyQualityAlert(
        companyId: string,
        userId: string,
        alertTitle: string,
        alertDescription: string,
        severity: 'low' | 'medium' | 'high' | 'critical'
    ) {
        return this.triggerNotification(companyId, userId, 'quality_alert', {
            subject: `Quality Alert [${severity.toUpperCase()}]: ${alertTitle}`,
            messageBody: alertDescription,
            metadata: { alertTitle, severity }
        });
    }

    static async notifySystemAnnouncement(
        companyId: string,
        userId: string,
        title: string,
        message: string
    ) {
        return this.triggerNotification(companyId, userId, 'system_announcement', {
            subject: `Announcement: ${title}`,
            messageBody: message,
            metadata: { title }
        });
    }

    // ==========================================================================
    // WORKSPACE MANAGEMENT METHODS
    // ==========================================================================

    static async notifyWorkspaceAdminPromoted(
        companyId: string,
        userId: string,
        workspaceName: string,
        promotedBy: string,
        workspaceId?: string,
        groupId?: string | null
    ) {
        const actionUrl = workspaceId ? `/workspaces/${workspaceId}` : undefined;
        return this.triggerNotification(companyId, userId, 'workspace_admin_promoted', {
            subject: `🚀 Appointed as W-Admin for "${workspaceName}"`,
            messageBody: `Hello! You have been appointed as a Workspace Administrator (W-Admin) for the "${workspaceName}" workspace by ${promotedBy}. You now have full administrative rights for this workspace and its associated projects.`,
            actionUrl,
            metadata: { workspaceName, promotedBy, role: 'W-Admin', workspaceId }
        }, groupId);
    }

    static async notifyWorkspaceAdminDemoted(
        companyId: string,
        userId: string,
        workspaceName: string,
        demotedBy: string,
        workspaceId?: string,
        groupId?: string | null
    ) {
        const actionUrl = workspaceId ? `/workspaces/${workspaceId}` : undefined;
        return this.triggerNotification(companyId, userId, 'workspace_admin_demoted', {
            subject: `Account Role Updated: "${workspaceName}"`,
            messageBody: `Your administrative role for the "${workspaceName}" workspace has been updated by ${demotedBy}. You will continue to have standard member access.`,
            actionUrl,
            metadata: { workspaceName, demotedBy, role: 'Member', workspaceId }
        }, groupId);
    }

    static async notifyWorkspaceTaskRequest(
        companyId: string,
        recipientId: string,
        fromWorkspaceName: string,
        toWorkspaceName: string,
        message: string,
        requesterName: string,
        requestId: string,
        toWorkspaceId: string,
        priority: string,
        groupId?: string | null
    ) {
        const actionUrl = `/workspaces/${toWorkspaceId}`;
        return this.triggerNotification(companyId, recipientId, 'workspace_task_request', {
            subject: `New Task Request from ${fromWorkspaceName}`,
            messageBody: `Workspace "${fromWorkspaceName}" is requesting a task in "${toWorkspaceName}". Message: "${message}"`,
            actionUrl,
            metadata: {
                fromWorkspaceName,
                fromTenantName: fromWorkspaceName,
                actorName: requesterName,
                message,
                requestId,
                toWorkspaceId,
                priority
            }
        }, groupId);
    }
}
