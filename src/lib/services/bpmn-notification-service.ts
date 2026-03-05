/**
 * BPMN Notification Service
 *
 * Integrates BPMN workflow events with the notification system.
 * Sends in-app, email, and push notifications for BPMN workflow events.
 *
 * @module lib/services/bpmn-notification-service
 * @version 1.0.0
 * @since Stage 6 - Notification Integration
 */

import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { NotificationType, NotificationPriority, Notification } from '@/types/notifications'

// =============================================================================
// TYPES
// =============================================================================

/**
 * BPMN notification event types
 */
export type BpmnNotificationType =
  | 'bpmn_task_created'
  | 'bpmn_task_assigned'
  | 'bpmn_task_claimed'
  | 'bpmn_task_delegated'
  | 'bpmn_task_due_soon'
  | 'bpmn_task_overdue'
  | 'bpmn_task_completed'
  | 'bpmn_task_escalated'
  | 'bpmn_process_started'
  | 'bpmn_process_completed'
  | 'bpmn_process_cancelled'
  | 'bpmn_process_error'
  | 'bpmn_approval_required'
  | 'bpmn_approval_approved'
  | 'bpmn_approval_rejected'
  | 'bpmn_step_reminder'
  | 'bpmn_step_escalated'

/**
 * BPMN notification payload
 */
export interface BpmnNotificationPayload {
  companyId: string
  userId: string
  type: BpmnNotificationType
  title: string
  message: string
  priority?: NotificationPriority
  taskId?: string
  taskName?: string
  workflowInstanceId?: string
  workflowName?: string
  processDefinitionId?: string
  stepId?: string
  stepName?: string
  assignedBy?: string
  dueDate?: string
  escalationLevel?: number
  actionUrl?: string
  metadata?: Record<string, any>
}

/**
 * Notification channel configuration
 */
export interface NotificationChannels {
  inApp: boolean
  email: boolean
  push: boolean
}

/**
 * Notification template
 */
export interface BpmnNotificationTemplate {
  type: BpmnNotificationType
  titleTemplate: string
  messageTemplate: string
  defaultPriority: NotificationPriority
  channels: NotificationChannels
}

// =============================================================================
// NOTIFICATION TEMPLATES
// =============================================================================

/**
 * Default notification templates for BPMN events
 */
const BPMN_NOTIFICATION_TEMPLATES: Record<BpmnNotificationType, BpmnNotificationTemplate> = {
  bpmn_task_created: {
    type: 'bpmn_task_created',
    titleTemplate: 'New Task: {{taskName}}',
    messageTemplate: 'A new task "{{taskName}}" has been created in workflow "{{workflowName}}".',
    defaultPriority: 'medium',
    channels: { inApp: true, email: false, push: false }
  },
  bpmn_task_assigned: {
    type: 'bpmn_task_assigned',
    titleTemplate: 'Task Assigned: {{taskName}}',
    messageTemplate: 'You have been assigned the task "{{taskName}}" in workflow "{{workflowName}}". {{#if dueDate}}Due: {{dueDate}}{{/if}}',
    defaultPriority: 'high',
    channels: { inApp: true, email: true, push: true }
  },
  bpmn_task_claimed: {
    type: 'bpmn_task_claimed',
    titleTemplate: 'Task Claimed: {{taskName}}',
    messageTemplate: 'You have claimed the task "{{taskName}}".',
    defaultPriority: 'low',
    channels: { inApp: true, email: false, push: false }
  },
  bpmn_task_delegated: {
    type: 'bpmn_task_delegated',
    titleTemplate: 'Task Delegated: {{taskName}}',
    messageTemplate: 'The task "{{taskName}}" has been delegated to you by {{assignedBy}}.',
    defaultPriority: 'high',
    channels: { inApp: true, email: true, push: true }
  },
  bpmn_task_due_soon: {
    type: 'bpmn_task_due_soon',
    titleTemplate: 'Task Due Soon: {{taskName}}',
    messageTemplate: 'The task "{{taskName}}" is due {{dueDate}}. Please complete it on time.',
    defaultPriority: 'high',
    channels: { inApp: true, email: true, push: true }
  },
  bpmn_task_overdue: {
    type: 'bpmn_task_overdue',
    titleTemplate: 'Task Overdue: {{taskName}}',
    messageTemplate: 'The task "{{taskName}}" was due {{dueDate}} and is now overdue. Please take action immediately.',
    defaultPriority: 'urgent',
    channels: { inApp: true, email: true, push: true }
  },
  bpmn_task_completed: {
    type: 'bpmn_task_completed',
    titleTemplate: 'Task Completed: {{taskName}}',
    messageTemplate: 'The task "{{taskName}}" has been completed.',
    defaultPriority: 'low',
    channels: { inApp: true, email: false, push: false }
  },
  bpmn_task_escalated: {
    type: 'bpmn_task_escalated',
    titleTemplate: 'Task Escalated: {{taskName}}',
    messageTemplate: 'The task "{{taskName}}" has been escalated (Level {{escalationLevel}}). Please review.',
    defaultPriority: 'urgent',
    channels: { inApp: true, email: true, push: true }
  },
  bpmn_process_started: {
    type: 'bpmn_process_started',
    titleTemplate: 'Workflow Started: {{workflowName}}',
    messageTemplate: 'The workflow "{{workflowName}}" has been started.',
    defaultPriority: 'low',
    channels: { inApp: true, email: false, push: false }
  },
  bpmn_process_completed: {
    type: 'bpmn_process_completed',
    titleTemplate: 'Workflow Completed: {{workflowName}}',
    messageTemplate: 'The workflow "{{workflowName}}" has been completed successfully.',
    defaultPriority: 'medium',
    channels: { inApp: true, email: true, push: false }
  },
  bpmn_process_cancelled: {
    type: 'bpmn_process_cancelled',
    titleTemplate: 'Workflow Cancelled: {{workflowName}}',
    messageTemplate: 'The workflow "{{workflowName}}" has been cancelled.',
    defaultPriority: 'medium',
    channels: { inApp: true, email: true, push: false }
  },
  bpmn_process_error: {
    type: 'bpmn_process_error',
    titleTemplate: 'Workflow Error: {{workflowName}}',
    messageTemplate: 'An error occurred in the workflow "{{workflowName}}". Please contact support.',
    defaultPriority: 'urgent',
    channels: { inApp: true, email: true, push: true }
  },
  bpmn_approval_required: {
    type: 'bpmn_approval_required',
    titleTemplate: 'Approval Required: {{taskName}}',
    messageTemplate: 'Your approval is required for "{{taskName}}" in workflow "{{workflowName}}".',
    defaultPriority: 'high',
    channels: { inApp: true, email: true, push: true }
  },
  bpmn_approval_approved: {
    type: 'bpmn_approval_approved',
    titleTemplate: 'Approved: {{taskName}}',
    messageTemplate: 'The task "{{taskName}}" has been approved.',
    defaultPriority: 'medium',
    channels: { inApp: true, email: true, push: false }
  },
  bpmn_approval_rejected: {
    type: 'bpmn_approval_rejected',
    titleTemplate: 'Rejected: {{taskName}}',
    messageTemplate: 'The task "{{taskName}}" has been rejected. Please review and take action.',
    defaultPriority: 'high',
    channels: { inApp: true, email: true, push: true }
  },
  bpmn_step_reminder: {
    type: 'bpmn_step_reminder',
    titleTemplate: 'Reminder: {{taskName}}',
    messageTemplate: 'This is a reminder for the task "{{taskName}}" due {{dueDate}}.',
    defaultPriority: 'medium',
    channels: { inApp: true, email: true, push: true }
  },
  bpmn_step_escalated: {
    type: 'bpmn_step_escalated',
    titleTemplate: 'Step Escalated: {{stepName}}',
    messageTemplate: 'The step "{{stepName}}" in workflow "{{workflowName}}" has been escalated to you.',
    defaultPriority: 'urgent',
    channels: { inApp: true, email: true, push: true }
  }
}

// =============================================================================
// TEMPLATE RENDERING
// =============================================================================

/**
 * Simple template rendering with {{variable}} syntax
 */
function renderTemplate(template: string, variables: Record<string, any>): string {
  let result = template

  // Handle conditional blocks {{#if variable}}...{{/if}}
  // Use [\s\S] instead of . with s flag for ES2017 compatibility
  const conditionalPattern = /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g
  result = result.replace(conditionalPattern, (_, varName, content) => {
    return variables[varName] ? content : ''
  })

  // Replace simple variables {{variable}}
  const variablePattern = /\{\{(\w+)\}\}/g
  result = result.replace(variablePattern, (_, varName) => {
    return variables[varName] ?? ''
  })

  return result.trim()
}

// =============================================================================
// BPMN NOTIFICATION SERVICE
// =============================================================================

/**
 * BpmnNotificationService
 *
 * Handles sending notifications for BPMN workflow events
 */
export class BpmnNotificationService {

  /**
   * Send a BPMN notification
   */
  static async sendNotification(payload: BpmnNotificationPayload): Promise<string> {
    const template = BPMN_NOTIFICATION_TEMPLATES[payload.type]

    if (!template) {
      throw new Error(`Unknown BPMN notification type: ${payload.type}`)
    }

    // Build template variables
    const variables: Record<string, any> = {
      taskName: payload.taskName || 'Task',
      workflowName: payload.workflowName || 'Workflow',
      stepName: payload.stepName || 'Step',
      dueDate: payload.dueDate,
      assignedBy: payload.assignedBy,
      escalationLevel: payload.escalationLevel
    }

    // Render title and message from templates or use provided values
    const title = payload.title || renderTemplate(template.titleTemplate, variables)
    const message = payload.message || renderTemplate(template.messageTemplate, variables)
    const priority = payload.priority || template.defaultPriority

    // Create in-app notification
    const notificationId = await this.createInAppNotification({
      companyId: payload.companyId,
      userId: payload.userId,
      type: this.mapBpmnTypeToNotificationType(payload.type),
      title,
      message,
      priority,
      taskId: payload.taskId,
      workflowInstanceId: payload.workflowInstanceId,
      actionUrl: payload.actionUrl,
      metadata: {
        ...payload.metadata,
        bpmnNotificationType: payload.type,
        workflowName: payload.workflowName,
        stepName: payload.stepName,
        processDefinitionId: payload.processDefinitionId
      }
    })

    // Log notification sent
    console.log('[BpmnNotificationService] Notification sent', {
      notificationId,
      type: payload.type,
      userId: payload.userId,
      taskId: payload.taskId
    })

    return notificationId
  }

  /**
   * Create in-app notification in Firestore
   */
  private static async createInAppNotification(params: {
    companyId: string
    userId: string
    type: NotificationType
    title: string
    message: string
    priority: NotificationPriority
    taskId?: string
    workflowInstanceId?: string
    actionUrl?: string
    metadata?: Record<string, any>
  }): Promise<string> {
    const notificationsRef = collection(db, 'companies', params.companyId, 'notifications')

    const notification: Partial<Notification> = {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      priority: params.priority,
      isRead: false,
      actionRequired: params.priority === 'urgent' || params.priority === 'high',
      taskId: params.taskId,
      metadata: params.metadata
    }

    if (params.actionUrl) {
      notification.actionUrl = params.actionUrl
    }

    const docRef = await addDoc(notificationsRef, {
      ...notification,
      createdAt: serverTimestamp()
    })

    return docRef.id
  }

  /**
   * Map BPMN notification type to standard notification type
   */
  private static mapBpmnTypeToNotificationType(bpmnType: BpmnNotificationType): NotificationType {
    const typeMap: Record<BpmnNotificationType, NotificationType> = {
      bpmn_task_created: 'task_assigned',
      bpmn_task_assigned: 'task_assigned',
      bpmn_task_claimed: 'task_updated',
      bpmn_task_delegated: 'task_assigned',
      bpmn_task_due_soon: 'task_due_soon',
      bpmn_task_overdue: 'task_overdue',
      bpmn_task_completed: 'task_completed',
      bpmn_task_escalated: 'task_overdue',
      bpmn_process_started: 'system_announcement',
      bpmn_process_completed: 'system_announcement',
      bpmn_process_cancelled: 'system_announcement',
      bpmn_process_error: 'quality_alert',
      bpmn_approval_required: 'approval_required',
      bpmn_approval_approved: 'approval_approved',
      bpmn_approval_rejected: 'approval_rejected',
      bpmn_step_reminder: 'task_due_soon',
      bpmn_step_escalated: 'task_overdue'
    }

    return typeMap[bpmnType] || 'system_announcement'
  }

  /**
   * Send task assigned notification
   */
  static async notifyTaskAssigned(params: {
    companyId: string
    userId: string
    taskId: string
    taskName: string
    workflowName?: string
    assignedBy?: string
    dueDate?: string
    actionUrl?: string
  }): Promise<string> {
    return this.sendNotification({
      companyId: params.companyId,
      userId: params.userId,
      type: 'bpmn_task_assigned',
      title: `Task Assigned: ${params.taskName}`,
      message: `You have been assigned the task "${params.taskName}"${params.workflowName ? ` in workflow "${params.workflowName}"` : ''}.${params.dueDate ? ` Due: ${params.dueDate}` : ''}`,
      taskId: params.taskId,
      taskName: params.taskName,
      workflowName: params.workflowName,
      assignedBy: params.assignedBy,
      dueDate: params.dueDate,
      actionUrl: params.actionUrl,
      priority: 'high'
    })
  }

  /**
   * Send task due soon notification
   */
  static async notifyTaskDueSoon(params: {
    companyId: string
    userId: string
    taskId: string
    taskName: string
    dueDate: string
    workflowName?: string
    actionUrl?: string
  }): Promise<string> {
    return this.sendNotification({
      companyId: params.companyId,
      userId: params.userId,
      type: 'bpmn_task_due_soon',
      title: `Task Due Soon: ${params.taskName}`,
      message: `The task "${params.taskName}" is due ${params.dueDate}. Please complete it on time.`,
      taskId: params.taskId,
      taskName: params.taskName,
      workflowName: params.workflowName,
      dueDate: params.dueDate,
      actionUrl: params.actionUrl,
      priority: 'high'
    })
  }

  /**
   * Send task overdue notification
   */
  static async notifyTaskOverdue(params: {
    companyId: string
    userId: string
    taskId: string
    taskName: string
    dueDate: string
    workflowName?: string
    actionUrl?: string
  }): Promise<string> {
    return this.sendNotification({
      companyId: params.companyId,
      userId: params.userId,
      type: 'bpmn_task_overdue',
      title: `Task Overdue: ${params.taskName}`,
      message: `The task "${params.taskName}" was due ${params.dueDate} and is now overdue.`,
      taskId: params.taskId,
      taskName: params.taskName,
      workflowName: params.workflowName,
      dueDate: params.dueDate,
      actionUrl: params.actionUrl,
      priority: 'urgent'
    })
  }

  /**
   * Send task escalated notification
   */
  static async notifyTaskEscalated(params: {
    companyId: string
    userId: string
    taskId: string
    taskName: string
    escalationLevel: number
    workflowName?: string
    escalatedFrom?: string
    actionUrl?: string
  }): Promise<string> {
    return this.sendNotification({
      companyId: params.companyId,
      userId: params.userId,
      type: 'bpmn_task_escalated',
      title: `Task Escalated: ${params.taskName}`,
      message: `The task "${params.taskName}" has been escalated (Level ${params.escalationLevel}). Please review and take action.`,
      taskId: params.taskId,
      taskName: params.taskName,
      workflowName: params.workflowName,
      escalationLevel: params.escalationLevel,
      actionUrl: params.actionUrl,
      priority: 'urgent',
      metadata: { escalatedFrom: params.escalatedFrom }
    })
  }

  /**
   * Send approval required notification
   */
  static async notifyApprovalRequired(params: {
    companyId: string
    userId: string
    taskId: string
    taskName: string
    workflowName?: string
    requestedBy?: string
    actionUrl?: string
  }): Promise<string> {
    return this.sendNotification({
      companyId: params.companyId,
      userId: params.userId,
      type: 'bpmn_approval_required',
      title: `Approval Required: ${params.taskName}`,
      message: `Your approval is required for "${params.taskName}"${params.workflowName ? ` in workflow "${params.workflowName}"` : ''}.`,
      taskId: params.taskId,
      taskName: params.taskName,
      workflowName: params.workflowName,
      actionUrl: params.actionUrl,
      priority: 'high',
      metadata: { requestedBy: params.requestedBy }
    })
  }

  /**
   * Send approval decision notification (approved/rejected)
   */
  static async notifyApprovalDecision(params: {
    companyId: string
    userId: string
    taskId: string
    taskName: string
    decision: 'approved' | 'rejected'
    approvedBy?: string
    comments?: string
    workflowName?: string
    actionUrl?: string
  }): Promise<string> {
    const type = params.decision === 'approved' ? 'bpmn_approval_approved' : 'bpmn_approval_rejected'
    const priority = params.decision === 'approved' ? 'medium' : 'high'

    return this.sendNotification({
      companyId: params.companyId,
      userId: params.userId,
      type,
      title: `${params.decision === 'approved' ? 'Approved' : 'Rejected'}: ${params.taskName}`,
      message: `The task "${params.taskName}" has been ${params.decision}.${params.comments ? ` Comments: ${params.comments}` : ''}`,
      taskId: params.taskId,
      taskName: params.taskName,
      workflowName: params.workflowName,
      actionUrl: params.actionUrl,
      priority,
      metadata: { approvedBy: params.approvedBy, comments: params.comments }
    })
  }

  /**
   * Send process started notification
   */
  static async notifyProcessStarted(params: {
    companyId: string
    userId: string
    workflowInstanceId: string
    workflowName: string
    processDefinitionId?: string
    actionUrl?: string
  }): Promise<string> {
    return this.sendNotification({
      companyId: params.companyId,
      userId: params.userId,
      type: 'bpmn_process_started',
      title: `Workflow Started: ${params.workflowName}`,
      message: `The workflow "${params.workflowName}" has been started.`,
      workflowInstanceId: params.workflowInstanceId,
      workflowName: params.workflowName,
      processDefinitionId: params.processDefinitionId,
      actionUrl: params.actionUrl,
      priority: 'low'
    })
  }

  /**
   * Send process completed notification
   */
  static async notifyProcessCompleted(params: {
    companyId: string
    userId: string
    workflowInstanceId: string
    workflowName: string
    processDefinitionId?: string
    actionUrl?: string
  }): Promise<string> {
    return this.sendNotification({
      companyId: params.companyId,
      userId: params.userId,
      type: 'bpmn_process_completed',
      title: `Workflow Completed: ${params.workflowName}`,
      message: `The workflow "${params.workflowName}" has been completed successfully.`,
      workflowInstanceId: params.workflowInstanceId,
      workflowName: params.workflowName,
      processDefinitionId: params.processDefinitionId,
      actionUrl: params.actionUrl,
      priority: 'medium'
    })
  }

  /**
   * Send process error notification
   */
  static async notifyProcessError(params: {
    companyId: string
    userId: string
    workflowInstanceId: string
    workflowName: string
    errorMessage: string
    processDefinitionId?: string
    actionUrl?: string
  }): Promise<string> {
    return this.sendNotification({
      companyId: params.companyId,
      userId: params.userId,
      type: 'bpmn_process_error',
      title: `Workflow Error: ${params.workflowName}`,
      message: `An error occurred in the workflow "${params.workflowName}": ${params.errorMessage}`,
      workflowInstanceId: params.workflowInstanceId,
      workflowName: params.workflowName,
      processDefinitionId: params.processDefinitionId,
      actionUrl: params.actionUrl,
      priority: 'urgent',
      metadata: { errorMessage: params.errorMessage }
    })
  }

  /**
   * Send step reminder notification
   */
  static async notifyStepReminder(params: {
    companyId: string
    userId: string
    taskId: string
    taskName: string
    stepName?: string
    dueDate?: string
    workflowName?: string
    reminderNumber?: number
    actionUrl?: string
  }): Promise<string> {
    return this.sendNotification({
      companyId: params.companyId,
      userId: params.userId,
      type: 'bpmn_step_reminder',
      title: `Reminder: ${params.taskName}`,
      message: `This is a reminder for the task "${params.taskName}"${params.dueDate ? ` due ${params.dueDate}` : ''}.`,
      taskId: params.taskId,
      taskName: params.taskName,
      stepName: params.stepName,
      workflowName: params.workflowName,
      dueDate: params.dueDate,
      actionUrl: params.actionUrl,
      priority: 'medium',
      metadata: { reminderNumber: params.reminderNumber }
    })
  }

  /**
   * Send bulk notifications to multiple users
   */
  static async sendBulkNotifications(
    notifications: BpmnNotificationPayload[]
  ): Promise<string[]> {
    const results: string[] = []

    for (const notification of notifications) {
      try {
        const id = await this.sendNotification(notification)
        results.push(id)
      } catch (error) {
        console.error('[BpmnNotificationService] Error sending bulk notification', {
          userId: notification.userId,
          type: notification.type,
          error
        })
      }
    }

    return results
  }

  /**
   * Get notification template for a BPMN event type
   */
  static getNotificationTemplate(type: BpmnNotificationType): BpmnNotificationTemplate | undefined {
    return BPMN_NOTIFICATION_TEMPLATES[type]
  }

  /**
   * Get all notification templates
   */
  static getAllTemplates(): Record<BpmnNotificationType, BpmnNotificationTemplate> {
    return { ...BPMN_NOTIFICATION_TEMPLATES }
  }

  /**
   * Render a notification preview
   */
  static previewNotification(
    type: BpmnNotificationType,
    variables: Record<string, any>
  ): { title: string; message: string } {
    const template = BPMN_NOTIFICATION_TEMPLATES[type]

    if (!template) {
      throw new Error(`Unknown BPMN notification type: ${type}`)
    }

    return {
      title: renderTemplate(template.titleTemplate, variables),
      message: renderTemplate(template.messageTemplate, variables)
    }
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  BPMN_NOTIFICATION_TEMPLATES,
  renderTemplate
}
