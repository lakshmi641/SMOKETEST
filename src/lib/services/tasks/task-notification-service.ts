// Task Notification and Assignment System
// Handles real-time notifications for task assignments and updates

import {
  collection,
  doc,
  getDocs,
  query,
  where,
  addDoc,
  updateDoc,
  onSnapshot,
  orderBy,
  limit,
  getDoc
} from 'firebase/firestore'
import { db } from '../../firebase'
import { ExternalNotificationService } from '../external-notifications/external-notification-service'
import { UserService } from '../users/user-services'
import { companyCollectionPathSegments, companySubcollectionPathSegments, enterpriseGroupPath } from '@/lib/firestore-paths'
import { TaskTemplateService } from './task-template-service'
import { PositionTaskAssignmentService } from './position-task-assignment-service'
import { sendTaskAssignedPushNotification } from '../notifications/push-sender-service'
import type { GeneratedTask } from '@/types/task-template-schema'

export interface TaskNotification {
  id: string
  companyId: string
  userId: string
  type: 'task_assigned' | 'task_due_soon' | 'task_overdue' | 'task_completed' | 'task_updated' | 'approval_required' | 'approval_approved' | 'approval_rejected' | 'ghost_task_alert' | 'ghost_task_resolved' | 'recurring_task_paused' | 'recurring_task_reactivated' | 'recurring_schedule_ended' | 'workflow_completed'
  title: string
  message: string
  taskId?: string
  projectId?: string
  templateId?: string
  positionId?: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  isRead: boolean
  actionRequired: boolean
  actionUrl?: string
  metadata?: Record<string, any>
  createdAt: string
  expiresAt?: string
}

export interface NotificationPreferences {
  id: string
  companyId: string
  userId: string
  emailNotifications: boolean
  pushNotifications: boolean
  taskAssigned: boolean
  taskDueSoon: boolean
  taskOverdue: boolean
  taskCompleted: boolean
  approvalRequired: boolean
  dueSoonHours: number // Hours before due date to notify
  digestFrequency: 'immediate' | 'hourly' | 'daily' | 'weekly'
  quietHours: {
    enabled: boolean
    startTime: string // HH:MM format
    endTime: string // HH:MM format
    timezone: string
  }
  createdAt: string
  updatedAt: string
}

export class TaskNotificationService {

  // ============================================================================
  // NOTIFICATION CREATION
  // ============================================================================

  /**
   * Create a task notification.
   * When groupId is set, writes to enterpriseGroups/{groupId}/companies/{companyId}/notifications.
   */
  static async createNotification(
    companyId: string,
    userId: string,
    notification: Omit<TaskNotification, 'id' | 'createdAt'>,
    groupId?: string | null
  ): Promise<string> {
    const notificationRef = groupId
      ? collection(db, ...companyCollectionPathSegments(groupId, companyId, 'notifications'))
      : collection(db, 'companies', companyId, 'notifications')
    const now = new Date().toISOString()

    const notificationDataToSave = {
      ...notification,
      createdAt: now,
    }

    // Sanitize: Firestore doesn't accept 'undefined' fields
    const sanitizedData = Object.fromEntries(
      Object.entries(notificationDataToSave).filter(([_, v]) => v !== undefined)
    )

    const docRef = await addDoc(notificationRef, sanitizedData)
    return docRef.id
  }

  /**
   * Notify user of new task assignment.
   * When groupId is set, in-app notification is written to enterprise path.
   */
  static async notifyTaskAssigned(
    companyId: string,
    userId: string | null,
    task: GeneratedTask,
    groupId?: string | null
  ): Promise<void> {
    console.log(`Notifying for task assignment: ${task.title} (User: ${userId})`)

    try {
      // 1. Detect RFT Project
      const effectiveGroupId = groupId || companyId
      const projSegs = companySubcollectionPathSegments(effectiveGroupId, companyId, 'projects')
      const projRef = doc(db, projSegs[0], ...projSegs.slice(1), task.projectId)
      const projDoc = await getDoc(projRef)
      const project = projDoc.data()
      const isRFT = project?.projectType === 'rft' || (project?.name && project?.name.match(/RFT/i))

      const { ExternalNotificationService } = await import('@/lib/services/external-notifications/external-notification-service');

      if (isRFT) {
        try {
          // 2. Retrieve RFT Metadata
          let requestorName = 'Requestor'
          let requestorWorkspaceName = 'Partner Workspace'

          const trSegs = companySubcollectionPathSegments(effectiveGroupId, companyId, 'task_requests')
          const trQuery = query(
            collection(db, trSegs[0], ...trSegs.slice(1)),
            where('linkedTaskId', '==', task.id)
          )
          const trSnap = await getDocs(trQuery)
          if (!trSnap.empty && trSnap.docs[0]) {
            const trData = trSnap.docs[0].data()
            requestorName = trData.requesterName || requestorName
            requestorWorkspaceName = trData.fromWorkspaceName || requestorWorkspaceName
          }

          // 3. Identify Recipients (Assignee or Workspace Owner)
          let recipients: string[] = []
          if (userId) {
            recipients = [userId]
          } else if (task.workspaceId) {
            const { WorkspaceService } = await import('../workspaces/workspace-service');
            recipients = await WorkspaceService.resolveWorkspaceStakeholders(groupId as string, companyId, task.workspaceId)
          }

          // 4. Send RFT Notifications
          for (const recipientId of recipients) {
            await ExternalNotificationService.notifyRFTTaskAssigned(
              companyId,
              recipientId,
              requestorName,
              requestorWorkspaceName,
              task.title || 'Task Assigned',
              task.projectId,
              task.id,
              groupId
            )
          }
          return // Exit early after RFT notification
        } catch (rftErr) {
          console.error('⚠️ Failed to process RFT notification:', rftErr)
        }
      }

      // Standard (Non-RFT) Notification Logic
      if (!userId) return

      try {
        // Resolve assigner name
        let assignerName = 'Teammate'
        const reporterId = (task as any).reporter || (task as any).assignedBy
        if (reporterId && reporterId !== 'system') {
          const user = await UserService.getUser(companyId, reporterId, groupId)
          if (user) {
            assignerName = user.name || 'Teammate'
          }
        }

        await ExternalNotificationService.notifyTaskAssigned(
          companyId,
          userId,
          task.title,
          assignerName,
          task.projectId,
          task.id,
          groupId
        );
      } catch (externalError) {
        console.error('⚠️ Failed to orchestrate task assignment notification:', externalError);
      }

      // Keep existing Push Notification Service (FCM)
      await sendTaskAssignedPushNotification(companyId, userId, task, false, groupId as string)

    } catch (error) {
      console.error('Error creating task assignment notification:', error)
    }
  }

  /**
   * Notify user of upcoming task due date
   */
  static async notifyTaskDueSoon(
    companyId: string,
    userId: string,
    task: GeneratedTask,
    hoursUntilDue: number,
    groupId?: string | null
  ): Promise<void> {
    console.log(`Notifying user ${userId} that task ${task.title} is due in ${hoursUntilDue} hours`)

    try {
      await this.createNotification(companyId, userId, {
        type: 'task_due_soon',
        title: 'Task Due Soon',
        message: `Task "${task.title}" is due in ${hoursUntilDue} hours`,
        userId,
        companyId,
        taskId: task.id,
        templateId: task.templateId,
        positionId: task.positionId,
        priority: hoursUntilDue <= 2 ? 'urgent' : 'high',
        isRead: false,
        actionRequired: true,
        actionUrl: `/projects/${task.projectId}/tasks/${task.id}`,
        metadata: {
          hoursUntilDue,
          dueDate: task.dueDate,
        },
      }, groupId)

      // Send push notification for due date alert
      const { sendDueDateAlertPushNotification } = await import('../notifications/push-sender-service')
      await sendDueDateAlertPushNotification(companyId, userId, task, hoursUntilDue, groupId as string)

      // ------------------------------------------------------------------------
      // External Notifications (Email/WhatsApp) - Non-Blocking
      // ------------------------------------------------------------------------
      try {
        const { ExternalNotificationService } = await import('@/lib/services/external-notifications/external-notification-service');
        ExternalNotificationService.notifyTaskDueSoon(
          companyId,
          userId,
          task.title,
          hoursUntilDue,
          task.dueDate || 'N/A',
          task.projectId,
          task.id,
          groupId
        ).catch(e => console.error('⚠️ External due soon notification failed:', e));
      } catch (externalError) {
        console.error('⚠️ Failed to trigger external due soon notification:', externalError);
      }

    } catch (error) {
      console.error('Error creating task due soon notification:', error)
    }
  }

  /**
   * Notify user specifically for task due tomorrow (24h reminder)
   */
  static async notifyDueDateReminder(
    companyId: string,
    userId: string,
    task: GeneratedTask,
    groupId?: string | null
  ): Promise<void> {
    console.log(`Notifying user ${userId} that task ${task.title} is due tomorrow`)

    try {
      // 1. In-App Notification
      await this.createNotification(companyId, userId, {
        type: 'due_date_reminder' as any,
        title: 'Task Due Tomorrow',
        message: `Reminder: Your task "${task.title}" is due tomorrow (${task.dueDate})`,
        userId,
        companyId,
        taskId: task.id,
        templateId: task.templateId,
        positionId: task.positionId,
        priority: 'high',
        isRead: false,
        actionRequired: true,
        actionUrl: `/projects/${task.projectId}/tasks/${task.id}`,
        metadata: {
          dueDate: task.dueDate,
        },
      }, groupId)

      // 2. External Notification (Email/WhatsApp)
      try {
        const { ExternalNotificationService } = await import('@/lib/services/external-notifications/external-notification-service');
        await ExternalNotificationService.notifyDueDateReminder(
          companyId,
          userId,
          task.title,
          task.dueDate || 'Tomorrow',
          task.projectId,
          task.id,
          groupId
        );
      } catch (extError) {
        console.error('⚠️ Failed to trigger external due tomorrow notification:', extError);
      }
    } catch (error) {
      console.error('Error creating due tomorrow notification:', error)
    }
  }

  /**
   * Notify user of overdue task
   */
  static async notifyTaskOverdue(
    companyId: string,
    userId: string,
    task: GeneratedTask,
    daysOverdue: number,
    groupId?: string | null
  ): Promise<void> {
    console.log(`Notifying user ${userId} that task ${task.title} is ${daysOverdue} days overdue`)

    try {
      await this.createNotification(companyId, userId, {
        type: 'task_overdue',
        title: 'Task Overdue',
        message: `Task "${task.title}" is ${daysOverdue} days overdue`,
        userId,
        companyId,
        taskId: task.id,
        templateId: task.templateId,
        positionId: task.positionId,
        priority: 'urgent',
        isRead: false,
        actionRequired: true,
        actionUrl: `/projects/${task.projectId}/tasks/${task.id}`,
        metadata: {
          daysOverdue,
          dueDate: task.dueDate,
        },
      }, groupId)

      // Send email notification for overdue tasks
      await this.sendEmailNotification(companyId, userId, 'task_overdue', {
        taskTitle: task.title,
        daysOverdue,
        dueDate: task.dueDate,
      })

      // Send escalation push notification
      const { sendEscalationAlertPushNotification } = await import('../notifications/push-sender-service')
      await sendEscalationAlertPushNotification(companyId, userId, task, daysOverdue, groupId as string)

      // ------------------------------------------------------------------------
      // External Notifications (Email/WhatsApp) - Non-Blocking
      // ------------------------------------------------------------------------
      try {
        const { ExternalNotificationService } = await import('@/lib/services/external-notifications/external-notification-service');
        ExternalNotificationService.notifyTaskOverdue(
          companyId,
          userId,
          task.title,
          daysOverdue,
          task.dueDate || 'N/A',
          task.projectId,
          task.id,
          groupId
        ).catch(e => console.error('⚠️ External overdue notification failed:', e));
      } catch (externalError) {
        console.error('⚠️ Failed to trigger external overdue notification:', externalError);
      }

    } catch (error) {
      console.error('Error creating task overdue notification:', error)
    }
  }

  /**
   * Notify user of task completion
   */
  static async notifyTaskCompleted(
    companyId: string,
    userId: string,
    task: GeneratedTask,
    groupId?: string | null
  ): Promise<void> {
    console.log(`Notifying user ${userId} that task ${task.title} has been completed`)

    try {
      await this.createNotification(companyId, userId, {
        type: 'task_completed',
        title: 'Task Completed',
        message: `Task "${task.title}" has been marked as completed`,
        userId,
        companyId,
        taskId: task.id,
        templateId: task.templateId,
        positionId: task.positionId,
        priority: 'low',
        isRead: false,
        actionRequired: false,
        actionUrl: `/projects/${task.projectId}/tasks/${task.id}`,
        metadata: {
          completedAt: task.completedAt,
          actualHours: task.actualHours,
        },
      }, groupId)

      // ------------------------------------------------------------------------
      // External Notifications (Email/WhatsApp) - Non-Blocking
      // ------------------------------------------------------------------------
      try {
        const { ExternalNotificationService } = await import('@/lib/services/external-notifications/external-notification-service');

        // Determine who completed it
        let completedByName = 'User'
        const completerId = (task as any).completedBy || task.assignedUserId
        if (completerId) {
          const userSegs = companySubcollectionPathSegments(groupId || companyId, companyId, 'users')
          const userSnap = await getDoc(doc(db, userSegs[0], ...userSegs.slice(1), completerId))
          if (userSnap.exists()) {
            completedByName = userSnap.data()?.name || 'User'
          }
        }

        ExternalNotificationService.notifyTaskCompleted(
          companyId,
          userId,
          task.title,
          completedByName,
          task.projectId,
          task.id,
          groupId
        ).catch(e => console.error('⚠️ External completed notification failed:', e));
      } catch (externalError) {
        console.error('⚠️ Failed to trigger external completed notification:', externalError);
      }

    } catch (error) {
      console.error('Error creating task completion notification:', error)
    }
  }

  /**
   * Notify user of approval requirement
   */
  static async notifyApprovalRequired(
    companyId: string,
    userId: string,
    task: GeneratedTask,
    approverId: string,
    groupId?: string | null,
    actionUrl?: string
  ): Promise<void> {
    console.log(`Notifying approver ${approverId} that task ${task.title} requires approval`)

    try {
      await this.createNotification(companyId, approverId, {
        type: 'approval_required',
        title: 'Approval Required',
        message: `Task "${task.title}" requires your approval`,
        userId: approverId,
        companyId,
        taskId: task.id,
        templateId: task.templateId,
        positionId: task.positionId,
        priority: 'high',
        isRead: false,
        actionRequired: true,
        actionUrl: actionUrl || `/projects/${task.projectId}/tasks/${task.id}?action=approve`,
        metadata: {
          requestedBy: userId,
          taskTitle: task.title,
        },
      }, groupId)

      // ------------------------------------------------------------------------
      // External Notifications (Email/WhatsApp) - Non-Blocking
      // ------------------------------------------------------------------------
      try {
        const { ExternalNotificationService } = await import('@/lib/services/external-notifications/external-notification-service');

        // Resolve requester name
        let requestedByName = 'Requester'
        if (userId) {
          try {
            const { UserService } = await import('@/lib/services/users/user-services');
            const requester = await UserService.getUser(companyId, userId, groupId);
            if (requester) {
              requestedByName = requester.name || requester.email?.split('@')[0] || 'Requester';
            }
          } catch (nameError) {
            console.error('⚠️ Failed to resolve requester name via UserService:', nameError)
          }
        }

        // Format task display name - Use only title as requested
        const taskDisplayId = task.title;

        ExternalNotificationService.notifyApprovalRequired(
          companyId,
          approverId,
          taskDisplayId,
          requestedByName,
          task.projectId,
          task.id,
          groupId,
          actionUrl
        ).catch(e => console.error('⚠️ External approval notification failed:', e));
      } catch (externalError) {
        console.error('⚠️ Failed to trigger external approval notification:', externalError);
      }

    } catch (error) {
      console.error('Error creating approval required notification:', error)
    }
  }

  /**
   * Notify user of workflow completion
   */
  static async notifyWorkflowCompleted(
    companyId: string,
    userId: string,
    workflowName: string,
    resourceType: string,
    resourceName: string,
    actionUrl?: string,
    groupId?: string | null
  ): Promise<void> {
    console.log(`Notifying user ${userId} that workflow ${workflowName} has been completed`)

    try {
      await this.createNotification(companyId, userId, {
        type: 'workflow_completed',
        title: 'Workflow Completed',
        message: `The workflow "${workflowName}" has been finished successfully`,
        userId,
        companyId,
        priority: 'medium',
        isRead: false,
        actionRequired: false,
        actionUrl,
        metadata: { workflowName, resourceType, resourceName }
      }, groupId)

      // External Notification
      try {
        const { ExternalNotificationService } = await import('@/lib/services/external-notifications/external-notification-service')
        await ExternalNotificationService.notifyWorkflowCompleted(
          companyId,
          userId,
          workflowName,
          resourceType,
          resourceName,
          actionUrl,
          groupId
        )
      } catch (externalError) {
        console.error('⚠️ Failed to trigger external workflow completion notification:', externalError)
      }
    } catch (error) {
      console.error('Error creating workflow completion notification:', error)
    }
  }

  /**
   * Notify user of approval rejection
   */
  static async notifyApprovalRejected(
    companyId: string,
    userId: string,
    workflowName: string,
    resourceType: string,
    resourceName: string,
    rejectedBy: string,
    rejectionReason?: string,
    actionUrl?: string,
    groupId?: string | null,
    taskId?: string,
    projectId?: string
  ): Promise<void> {
    console.log(`Notifying user ${userId} that ${resourceType} "${resourceName}" was rejected`)

    try {
      const message = rejectionReason
        ? `Your ${resourceType} "${resourceName}" was rejected: ${rejectionReason}`
        : `Your ${resourceType} "${resourceName}" was rejected by ${rejectedBy}`

      console.log(`[notifyApprovalRejected] Creating notification with actionUrl: ${actionUrl}, taskId: ${taskId}, projectId: ${projectId}`)

      await this.createNotification(companyId, userId, {
        type: 'approval_rejected',
        title: 'Approval Rejected',
        message,
        userId,
        companyId,
        taskId,
        projectId,
        priority: 'high',
        isRead: false,
        actionRequired: true,
        actionUrl,
        metadata: { workflowName, resourceType, resourceName, rejectedBy, rejectionReason, taskId, projectId }
      }, groupId)

      // External Notification (WhatsApp/Email)
      try {
        const { ExternalNotificationService } = await import('@/lib/services/external-notifications/external-notification-service')
        await ExternalNotificationService.notifyApprovalRejected(
          companyId,
          userId,
          resourceName,
          rejectedBy,
          rejectionReason,
          actionUrl,
          groupId
        )
      } catch (externalError) {
        console.error('⚠️ Failed to trigger external approval rejection notification:', externalError)
      }
    } catch (error) {
      console.error('Error creating approval rejection notification:', error)
    }
  }

  /**
   * Notify user of task escalation
   */
  static async notifyTaskEscalated(
    companyId: string,
    userId: string,
    notificationData: {
      title: string;
      message: string;
      taskId: string;
      projectId: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      actionUrl?: string;
    },
    groupId?: string | null
  ): Promise<void> {
    console.log(`Notifying user ${userId} of task escalation: ${notificationData.title}`)

    try {
      // 1. Create In-App Notification
      await this.createNotification(companyId, userId, {
        type: 'task_overdue',
        title: notificationData.title,
        message: notificationData.message,
        userId,
        companyId,
        priority: notificationData.priority || 'urgent',
        isRead: false,
        actionRequired: true,
        actionUrl: notificationData.actionUrl,
        taskId: notificationData.taskId,
      }, groupId)

      // 2. Trigger External Notification
      try {
        const { ExternalNotificationService } = await import('@/lib/services/external-notifications/external-notification-service')

        // Use triggerNotification directly since there isn't a specific escalation method yet, 
        // but 'task_overdue' is the closest match for which templates exist.
        await ExternalNotificationService.triggerNotification(
          companyId,
          userId,
          'task_overdue',
          {
            subject: notificationData.title,
            messageBody: notificationData.message,
            actionUrl: notificationData.actionUrl,
            metadata: {
              taskId: notificationData.taskId,
              projectId: notificationData.projectId,
              objectTitle: notificationData.title // fallback for template vars
            }
          },
          groupId
        )
      } catch (externalError) {
        console.error('⚠️ Failed to trigger external escalation notification:', externalError)
      }
    } catch (error) {
      console.error('Error in notifyTaskEscalated:', error)
    }
  }

  // ============================================================================
  // NOTIFICATION MANAGEMENT
  // ============================================================================

  /**
   * Get notifications for a user
   */
  static async getUserNotifications(
    companyId: string,
    userId: string,
    filters?: {
      isRead?: boolean
      type?: string
      limit?: number
    },
    groupId?: string | null
  ): Promise<TaskNotification[]> {
    const notificationsRef = groupId
      ? collection(db, ...companyCollectionPathSegments(groupId, companyId, 'notifications'))
      : collection(db, 'companies', companyId, 'notifications')
    let q = query(
      notificationsRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    )

    if (filters?.isRead !== undefined) {
      q = query(q, where('isRead', '==', filters.isRead))
    }
    if (filters?.type) {
      q = query(q, where('type', '==', filters.type))
    }
    if (filters?.limit) {
      q = query(q, limit(filters.limit))
    }

    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskNotification))
  }

  /**
   * Mark notification as read
   */
  static async markNotificationAsRead(
    companyId: string,
    notificationId: string,
    groupId?: string | null
  ): Promise<void> {
    const notificationRef = groupId
      ? doc(db, ...companyCollectionPathSegments(groupId, companyId, 'notifications'), notificationId)
      : doc(db, 'companies', companyId, 'notifications', notificationId)
    await updateDoc(notificationRef, {
      isRead: true,
      updatedAt: new Date().toISOString(),
    })
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllNotificationsAsRead(
    companyId: string,
    userId: string,
    groupId?: string | null
  ): Promise<void> {
    const notifications = await this.getUserNotifications(companyId, userId, { isRead: false }, groupId)

    const updatePromises = notifications.map(notification =>
      this.markNotificationAsRead(companyId, notification.id, groupId)
    )

    await Promise.all(updatePromises)
  }

  /**
   * Get unread notification count for a user
   */
  static async getUnreadNotificationCount(
    companyId: string,
    userId: string,
    groupId?: string | null
  ): Promise<number> {
    const unreadNotifications = await this.getUserNotifications(companyId, userId, {
      isRead: false
    }, groupId)
    return unreadNotifications.length
  }

  // ============================================================================
  // NOTIFICATION PREFERENCES
  // ============================================================================

  /**
   * Get user notification preferences
   */
  static async getNotificationPreferences(
    companyId: string,
    userId: string,
    groupId?: string | null
  ): Promise<NotificationPreferences | null> {
    const preferencesRef = groupId
      ? doc(db, ...companyCollectionPathSegments(groupId, companyId, 'notificationPreferences'), userId)
      : doc(db, 'companies', companyId, 'notificationPreferences', userId)
    const preferencesSnap = await getDoc(preferencesRef)

    if (!preferencesSnap.exists()) {
      return null
    }

    return { id: preferencesSnap.id, ...preferencesSnap.data() } as NotificationPreferences
  }

  /**
   * Update user notification preferences
   */
  static async updateNotificationPreferences(
    companyId: string,
    userId: string,
    preferences: Partial<NotificationPreferences>,
    groupId?: string | null
  ): Promise<void> {
    const preferencesRef = groupId
      ? doc(db, ...companyCollectionPathSegments(groupId, companyId, 'notificationPreferences'), userId)
      : doc(db, 'companies', companyId, 'notificationPreferences', userId)
    await updateDoc(preferencesRef, {
      ...preferences,
      updatedAt: new Date().toISOString(),
    })
  }

  /**
   * Create default notification preferences for a user
   */
  static async createDefaultNotificationPreferences(
    companyId: string,
    userId: string,
    groupId?: string | null
  ): Promise<void> {
    const preferencesRef = groupId
      ? collection(db, ...companyCollectionPathSegments(groupId, companyId, 'notificationPreferences'))
      : collection(db, 'companies', companyId, 'notificationPreferences')
    const now = new Date().toISOString()

    const defaultPreferences = {
      companyId,
      userId,
      emailNotifications: true,
      pushNotifications: true,
      taskAssigned: true,
      taskDueSoon: true,
      taskOverdue: true,
      taskCompleted: false,
      approvalRequired: true,
      dueSoonHours: 24,
      digestFrequency: 'daily',
      quietHours: {
        enabled: true,
        startTime: '22:00',
        endTime: '08:00',
        timezone: 'UTC',
      },
      createdAt: now,
      updatedAt: now,
    }

    await addDoc(preferencesRef, defaultPreferences)
  }

  // ============================================================================
  // AUTOMATED NOTIFICATION TRIGGERS
  // ============================================================================

  /**
   * Set up automated notification monitoring
   * This should be called when the app starts
   */
  static setupNotificationMonitoring(companyId: string): () => void {
    console.log('[TaskNotificationService] Real-time monitoring disabled to prevent duplicate notifications. Handled by services/cloud functions.')

    // No-op cleanup function
    return () => { }
  }

  /**
   * Check for overdue tasks and send notifications
   * This should be called periodically (e.g., every hour)
   */
  static async checkOverdueTasks(companyId: string): Promise<void> {
    console.log('Checking for overdue tasks and due date alerts')

    try {
      const now = new Date()
      const tasksQuery = query(
        collection(db, 'companies', companyId, 'tasks'),
        where('status', 'in', ['assigned', 'in_progress'])
      )

      const tasksSnapshot = await getDocs(tasksQuery)

      for (const taskDoc of tasksSnapshot.docs) {
        const task = taskDoc.data() as GeneratedTask
        if (!task.dueDate) continue

        const dueDate = new Date(task.dueDate)
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        const hoursUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60))

        if (daysOverdue > 0) {
          // Task is overdue - send escalation alert
          await this.notifyTaskOverdue(companyId, task.assignedUserId, task, daysOverdue)
        } else if (hoursUntilDue > 0 && hoursUntilDue <= 25 && hoursUntilDue > 23) {
          // Task is due EXACTLY tomorrow (24 hour window)
          // We use a small window (23-25h) to catch it during a daily or hourly run
          await this.notifyDueDateReminder(companyId, task.assignedUserId, task)
        } else if (daysOverdue === 0 || (hoursUntilDue > 0 && hoursUntilDue <= 48)) {
          // Task is due soon (within 48 hours) - send due date alert
          await this.notifyTaskDueSoon(companyId, task.assignedUserId, task, hoursUntilDue)
        }
      }
    } catch (error) {
      console.error('Error checking overdue tasks:', error)
    }
  }

  // ============================================================================
  // EMAIL NOTIFICATIONS
  // ============================================================================

  /**
   * Send email notification (placeholder for email service integration)
   */
  private static async sendEmailNotification(
    companyId: string,
    userId: string,
    type: string,
    data: Record<string, any>
  ): Promise<void> {
    // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
    console.log(`Sending email notification to user ${userId} for ${type}:`, data)
  }

  /**
   * Notify workspace SPOCs/Admins of a ghost task
   */
  static async notifyGhostTask(
    companyId: string,
    workspaceId: string,
    config: { id: string; title: string; reason?: string },
    groupId?: string | null
  ): Promise<void> {
    try {
      if (!companyId || !workspaceId) return

      // Get workspace to find owners/admins (use enterprise path for Firestore rules)
      const effectiveGroupId = groupId || companyId
      const workspaceSegments = companySubcollectionPathSegments(effectiveGroupId, companyId, 'workspaces') as [string, ...string[]]
      const workspaceRef = doc(db, ...workspaceSegments, workspaceId)
      const workspaceSnap = await getDoc(workspaceRef)

      if (!workspaceSnap.exists()) return

      const workspaceData = workspaceSnap.data() as any

      const { WorkspaceService } = await import('../workspaces/workspace-service');
      const recipients = await WorkspaceService.resolveWorkspaceStakeholders(groupId || companyId, companyId, workspaceId);

      console.log(`Ghost task notifications targeting ${recipients.length} restricted recipients (owners/admins) for ${config.title}`)

      // Delegate strictly to ExternalNotificationService for both In-App and External channels
      // This allows centralized preference management and avoids duplicates
      try {
        const { ExternalNotificationService } = await import('@/lib/services/external-notifications/external-notification-service');
        await ExternalNotificationService.notifyGhostTaskAlert(
          companyId,
          recipients as string[],
          config.id,
          config.title,
          (config.reason as any) || 'permission_denied',
          workspaceData.name,
          groupId
        );
      } catch (externalError) {
        console.error('⚠️ Failed to trigger external ghost task notification:', externalError);
      }
    } catch (error) {
      console.error('Error sending ghost task notifications:', error)
    }
  }
}
