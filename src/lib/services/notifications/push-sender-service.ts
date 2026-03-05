// Push Notification Sender Service
// Sends FCM push notifications for various scenarios

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc
} from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import { TaskNotificationService } from '../tasks/task-notification-service'
import type { GeneratedTask } from '@/types/task-template-schema'
import type { FCMToken } from '@/types/notifications'
import { formatDate } from '@/lib/utils/date-utils'

interface PushNotificationPayload {
  title: string
  body: string
  data?: Record<string, any>
  imageUrl?: string
  clickAction?: string
}

/**
 * Get all active FCM tokens for a user
 */
async function getUserFCMTokens(companyId: string, userId: string, groupId: string): Promise<FCMToken[]> {
  try {
    const { companySubcollectionPathSegments } = await import('../../firestore-paths')
    const tokensRef = collection(db, ...companySubcollectionPathSegments(groupId, companyId, 'fcmTokens'))
    const q = query(
      tokensRef,
      where('userId', '==', userId),
      where('isActive', '==', true)
    )

    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as FCMToken))
  } catch (error) {
    console.error('Error getting user FCM tokens:', error)
    return []
  }
}

/**
 * Send push notification via Firebase Cloud Functions
 * This calls a Cloud Function that sends the actual FCM message
 * [DEPRECATED] Consolidated into Cloud Function triggers in NotificationGatewayService
 */
async function sendPushNotificationViaFunction(
  companyId: string,
  userId: string,
  payload: PushNotificationPayload,
  groupId: string
): Promise<void> {
  // Logic removed to prevent client-side "Insufficient Permissions" errors when fetching other users' tokens.
  // Push notifications are now handled by backend triggers in NotificationGatewayService.
  console.log(`[PushSender] Skipping client-side push for user ${userId} - handled by backend triggers.`);
  return;
}

/**
 * Send push notification when task is assigned
 */
export async function sendTaskAssignedPushNotification(
  companyId: string,
  userId: string,
  task: GeneratedTask,
  isDelegated: boolean = false,
  groupId?: string | null,
  delegatorName?: string
): Promise<void> {
  try {
    const templateName = task.templateId ? 'Task' : task.title

    // NOTE: We do NOT call TaskNotificationService.notifyTaskAssigned() here anymore
    // because it is already called by the task-assignment-service and task-notification-service.
    // This function should ONLY handle FCM push notifications to avoid duplicate in-app notifications.

    // Prepare push notification payload
    const title = isDelegated
      ? `Task Delegated: ${task.title}`
      : `New Task Assigned: ${task.title}`

    const body = isDelegated && delegatorName
      ? `${delegatorName} delegated this task to you`
      : `You have been assigned a new task${task.dueDate ? ` (Due: ${formatDate(task.dueDate)})` : ''}`

    await sendPushNotificationViaFunction(companyId, userId, {
      title,
      body,
      data: {
        type: 'task_assigned',
        taskId: task.id,
        companyId,
        actionUrl: `/my-tasks?task=${task.id}`,
        isDelegated: isDelegated.toString(),
        priority: task.priority || 'medium',
      },
      clickAction: `/my-tasks?task=${task.id}`,
    }, groupId as string)

    console.log(`Push notification sent for task assignment: ${task.id} to user ${userId}`)
  } catch (error) {
    console.error('Error sending task assigned push notification:', error)
  }
}


/**
 * Send push notification when task is delegated to a position
 */
export async function sendTaskDelegatedPushNotification(
  companyId: string,
  userId: string,
  task: GeneratedTask,
  delegatorName: string,
  delegatorPosition: string,
  groupId: string
): Promise<void> {
  try {
    // Create in-app notification
    await TaskNotificationService.createNotification(companyId, userId, {
      type: 'task_assigned',
      title: 'Task Delegated',
      message: `${delegatorName} (${delegatorPosition}) delegated task "${task.title}" to you`,
      userId,
      companyId,
      taskId: task.id,
      positionId: task.positionId,
      priority: task.priority || 'medium',
      isRead: false,
      actionRequired: true,
      actionUrl: `/my-tasks?task=${task.id}`,
      metadata: {
        isDelegated: true,
        delegatorName,
        delegatorPosition,
      },
    })

    // Send push notification
    await sendPushNotificationViaFunction(companyId, userId, {
      title: `Task Delegated: ${task.title}`,
      body: `${delegatorName} delegated this task to you`,
      data: {
        type: 'task_delegated',
        taskId: task.id,
        companyId,
        actionUrl: `/my-tasks?task=${task.id}`,
        delegatorName,
        delegatorPosition,
        priority: task.priority || 'medium',
      },
      clickAction: `/my-tasks?task=${task.id}`,
    }, groupId)

    console.log(`Push notification sent for task delegation: ${task.id} to user ${userId}`)
  } catch (error) {
    console.error('Error sending task delegated push notification:', error)
  }
}

/**
 * Send push notification for due date alert
 */
export async function sendDueDateAlertPushNotification(
  companyId: string,
  userId: string,
  task: GeneratedTask,
  hoursUntilDue: number,
  groupId: string
): Promise<void> {
  try {
    // Create in-app notification
    await TaskNotificationService.notifyTaskDueSoon(companyId, userId, task, hoursUntilDue)

    const isUrgent = hoursUntilDue <= 2
    const urgencyText = hoursUntilDue <= 2
      ? 'URGENT'
      : hoursUntilDue <= 24
        ? 'Due Soon'
        : 'Upcoming'

    // Send push notification
    await sendPushNotificationViaFunction(companyId, userId, {
      title: `${urgencyText}: ${task.title}`,
      body: `Task is due in ${hoursUntilDue} hour${hoursUntilDue !== 1 ? 's' : ''}`,
      data: {
        type: 'task_due_soon',
        taskId: task.id,
        companyId,
        actionUrl: `/my-tasks?task=${task.id}`,
        hoursUntilDue: hoursUntilDue.toString(),
        priority: isUrgent ? 'urgent' : 'high',
      },
      clickAction: `/my-tasks?task=${task.id}`,
    }, groupId)

    console.log(`Due date alert push notification sent for task ${task.id} to user ${userId}`)
  } catch (error) {
    console.error('Error sending due date alert push notification:', error)
  }
}

/**
 * Send push notification for escalation (overdue task)
 */
export async function sendEscalationAlertPushNotification(
  companyId: string,
  userId: string,
  task: GeneratedTask,
  daysOverdue: number,
  groupId: string,
  escalateTo?: { userId: string; name: string; position: string }
): Promise<void> {
  try {
    // Create in-app notification for the assignee
    await TaskNotificationService.notifyTaskOverdue(companyId, userId, task, daysOverdue)

    // Send push notification to assignee
    await sendPushNotificationViaFunction(companyId, userId, {
      title: `⚠️ OVERDUE: ${task.title}`,
      body: `Task is ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue. Action required!`,
      data: {
        type: 'task_overdue',
        taskId: task.id,
        companyId,
        actionUrl: `/my-tasks?task=${task.id}`,
        daysOverdue: daysOverdue.toString(),
        priority: 'urgent',
      },
      clickAction: `/my-tasks?task=${task.id}`,
    }, groupId)

    // If escalated, also notify the escalation target
    if (escalateTo) {
      await TaskNotificationService.createNotification(companyId, escalateTo.userId, {
        type: 'task_overdue',
        title: 'Task Escalation',
        message: `Task "${task.title}" assigned to ${userId} is ${daysOverdue} days overdue and requires your attention`,
        userId: escalateTo.userId,
        companyId,
        taskId: task.id,
        positionId: task.positionId,
        priority: 'urgent',
        isRead: false,
        actionRequired: true,
        actionUrl: `/my-tasks?task=${task.id}`,
        metadata: {
          escalated: true,
          originalAssignee: userId,
          daysOverdue,
        },
      })

      await sendPushNotificationViaFunction(companyId, escalateTo.userId, {
        title: `🚨 Escalation: ${task.title}`,
        body: `Task is ${daysOverdue} days overdue and requires your attention`,
        data: {
          type: 'task_escalated',
          taskId: task.id,
          companyId,
          actionUrl: `/my-tasks?task=${task.id}`,
          daysOverdue: daysOverdue.toString(),
          priority: 'urgent',
        },
        clickAction: `/my-tasks?task=${task.id}`,
      }, groupId)
    }

    console.log(`Escalation alert push notification sent for task ${task.id}`)
  } catch (error) {
    console.error('Error sending escalation alert push notification:', error)
  }
}

/**
 * Batch send push notifications for multiple tasks
 */
export async function sendBatchTaskAssignedPushNotifications(
  companyId: string,
  userId: string,
  tasks: GeneratedTask[],
  groupId: string
): Promise<void> {
  if (tasks.length === 0) return

  try {
    // Create in-app notification
    await TaskNotificationService.createNotification(companyId, userId, {
      type: 'task_assigned',
      title: 'Multiple Tasks Assigned',
      message: `You have been assigned ${tasks.length} new task${tasks.length > 1 ? 's' : ''}`,
      userId,
      companyId,
      priority: 'medium',
      isRead: false,
      actionRequired: true,
      actionUrl: '/my-tasks',
      metadata: {
        taskIds: tasks.map(t => t.id),
        taskCount: tasks.length,
      },
    })

    // Send push notification
    await sendPushNotificationViaFunction(companyId, userId, {
      title: `${tasks.length} New Task${tasks.length > 1 ? 's' : ''} Assigned`,
      body: `You have ${tasks.length} new task${tasks.length > 1 ? 's' : ''} to complete`,
      data: {
        type: 'tasks_assigned',
        companyId,
        actionUrl: '/my-tasks',
        taskCount: tasks.length.toString(),
      },
      clickAction: '/my-tasks',
    }, groupId)

    console.log(`Batch push notification sent for ${tasks.length} tasks to user ${userId}`)
  } catch (error) {
    console.error('Error sending batch task assigned push notifications:', error)
  }
}

