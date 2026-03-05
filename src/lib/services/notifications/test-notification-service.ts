// Test Notification Service
// Utility functions to send test notifications for development/testing

import {
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc
} from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import { TaskNotificationService } from '../tasks/task-notification-service'

/**
 * Send a test notification to the current user
 */
export async function sendTestNotification(
  companyId: string,
  userId: string,
  options?: {
    type?:
    | 'task_assigned'
    | 'task_due_soon'
    | 'task_overdue'
    | 'task_completed'
    | 'task_updated'
    | 'approval_required'
    | 'approval_approved'
    | 'approval_rejected'
    title?: string
    message?: string
    priority?: 'low' | 'medium' | 'high' | 'urgent'
  }
): Promise<string | null> {
  try {
    const notificationType = options?.type || 'task_assigned'
    const title = options?.title || 'Test Notification'
    const message = options?.message || 'This is a test notification to verify the notification system is working correctly.'
    const priority = options?.priority || 'medium'

    const notificationId = await TaskNotificationService.createNotification(companyId, userId, {
      type: notificationType,
      title,
      message,
      userId,
      companyId,
      priority,
      isRead: false,
      actionRequired: false,
      actionUrl: '/notifications',
      metadata: {
        isTest: true,
        createdAt: new Date().toISOString()
      }
    })

    console.log('Test notification created:', notificationId)
    return notificationId
  } catch (error) {
    console.error('Error sending test notification:', error)
    throw error
  }
}

/**
 * Send multiple test notifications
 */
export async function sendMultipleTestNotifications(
  companyId: string,
  userId: string,
  count: number = 5
): Promise<string[]> {
  const notificationIds: string[] = []

  const testNotifications = [
    { type: 'task_assigned' as const, title: 'Task Assigned', message: 'You have been assigned a new task' },
    { type: 'task_due_soon' as const, title: 'Task Due Soon', message: 'Task "Complete Design Review" is due in 2 hours', priority: 'high' as const },
    { type: 'task_updated' as const, title: 'Task Updated', message: 'Your task has been updated' },
    { type: 'approval_required' as const, title: 'Approval Required', message: 'Task "Quality Check" requires your approval', priority: 'high' as const },
    { type: 'task_completed' as const, title: 'Task Completed', message: 'A task you are following was completed' },
  ]

  for (let i = 0; i < Math.min(count, testNotifications.length); i++) {
    try {
      const notification = testNotifications[i]
      const notificationId = await sendTestNotification(companyId, userId, notification)
      if (notificationId) {
        notificationIds.push(notificationId)
      }
      // Add small delay between notifications
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      console.error(`Error sending test notification ${i + 1}:`, error)
    }
  }

  return notificationIds
}

/**
 * Send a test push notification via Firebase Cloud Messaging
 * This requires the user to have granted permission and have a valid FCM token
 */
export async function sendTestPushNotification(
  companyId: string,
  userId: string,
  title: string = 'Test Push Notification',
  body: string = 'This is a test push notification'
): Promise<void> {
  try {
    // First, create a Firestore notification
    await sendTestNotification(companyId, userId, {
      type: 'task_assigned',
      title,
      message: body,
      priority: 'medium'
    })

    // Note: Actual push notification sending would typically be done via Firebase Cloud Functions
    // For now, this creates the notification document which can trigger push if properly configured
    console.log('Test push notification created (actual push requires Cloud Functions setup)')
  } catch (error) {
    console.error('Error sending test push notification:', error)
    throw error
  }
}

/**
 * Send test notifications with different priorities
 */
export async function sendPriorityTestNotifications(
  companyId: string,
  userId: string
): Promise<void> {
  const priorities: Array<'low' | 'medium' | 'high' | 'urgent'> = ['low', 'medium', 'high', 'urgent']

  for (const priority of priorities) {
    await sendTestNotification(companyId, userId, {
      type: 'task_updated',
      title: `Test ${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority`,
      message: `This is a test notification with ${priority} priority`,
      priority
    })
    await new Promise(resolve => setTimeout(resolve, 200))
  }
}

/**
 * Mark all test notifications as read
 */
export async function markAllTestNotificationsAsRead(
  companyId: string,
  userId: string
): Promise<void> {
  try {
    // This would need to be implemented in the notification service
    // For now, we'll use the existing service
    await TaskNotificationService.markAllNotificationsAsRead(companyId, userId)
    console.log('All test notifications marked as read')
  } catch (error) {
    console.error('Error marking test notifications as read:', error)
    throw error
  }
}

/**
 * Send a test external notification (Email/WhatsApp)
 */
export async function sendExternalTestNotification(
  companyId: string,
  userId: string,
  type:
    | 'task_overdue'
    | 'task_completed'
    | 'approval_required'
    | 'ghost_task_alert'
    | 'recurring_task_generated'
    | 'recurring_config_updated'
): Promise<void> {
  try {
    const { ExternalNotificationService } = await import('../external-notifications/external-notification-service');

    // Mock data for testing
    const taskTitle = "Test Task for Verification";
    const date = new Date().toISOString().split('T')[0] || new Date().toISOString().substring(0, 10);

    switch (type) {
      case 'task_overdue':
        await ExternalNotificationService.notifyTaskOverdue(companyId, userId, taskTitle, 3, date);
        break;
      case 'task_completed':
        await ExternalNotificationService.notifyTaskCompleted(companyId, userId, taskTitle, 'Test User');
        break;
      case 'approval_required':
        await ExternalNotificationService.notifyApprovalRequired(companyId, userId, taskTitle, 'Requester ID');
        break;
      case 'ghost_task_alert':
        // Sending to self as admin for test
        await ExternalNotificationService.notifyGhostTaskAlert(
          companyId,
          [userId],
          'config-123',
          'Ghost Task Test',
          'position_vacant',
          'Test Workspace'
        );
        break;
      case 'recurring_task_generated':
        await ExternalNotificationService.notifyRecurringTaskGenerated(
          companyId, userId, "Recurring Test Task", date, date, 'config-123'
        );
        break;
      case 'recurring_config_updated':
        await ExternalNotificationService.notifyRecurringConfigUpdated(
          companyId, [userId], "Recurring Config Test", ['schedule', 'assignment'], "Test Admin", "test-config-123"
        );
        break;
    }

    console.log(`Test external notification (${type}) sent via ExternalNotificationService`);
  } catch (error) {
    console.error('Error sending external test notification:', error);
    throw error;
  }
}
