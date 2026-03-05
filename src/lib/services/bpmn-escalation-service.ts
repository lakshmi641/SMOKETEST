/**
 * BPMN Escalation Service
 *
 * Handles escalation logic for BPMN workflow tasks.
 * Works alongside existing TaskEscalationService for direct tasks.
 *
 * Key Differences from Direct Escalation:
 * - Uses workflow step escalation configurations
 * - Integrates with BPMN workflow instance state
 * - Supports step-specific escalation paths
 *
 * @module lib/services/bpmn-escalation-service
 * @version 1.0.0
 * @since Stage 4 - BPMN Step Escalation
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  query,
  where,
  Timestamp
} from 'firebase/firestore'
import { db } from '../firebase'
import { getBpmnFlags, isBpmnFeatureEnabled } from '../bpmn/feature-flags'

// =============================================================================
// TYPES
// =============================================================================

/**
 * BPMN task for escalation
 */
export interface BpmnEscalationTask {
  id: string
  companyId: string
  title: string
  status: string
  category: string
  flowableTaskId: string
  flowableProcessInstanceId?: string
  workflowInstanceId: string
  taskDefinitionKey?: string
  assignedUserId?: string | null
  candidateUserIds?: string[]
  escalationPolicyId?: string | null
  currentEscalationLevel: number
  dueDate: string
  createdAt: string
  variables?: Record<string, any>
}

/**
 * Escalation path configuration
 */
export interface EscalationPath {
  id: string
  name: string
  rules: EscalationRule[]
}

/**
 * Escalation rule
 */
export interface EscalationRule {
  id: string
  name: string
  level: number
  triggerAfterMinutes: number
  actions: EscalationAction[]
  conditions?: EscalationCondition[]
}

/**
 * Escalation action types
 */
export type EscalationActionType =
  | 'notify'
  | 'remind'
  | 'escalate'
  | 'reassign'
  | 'add_approver'
  | 'auto_approve'
  | 'auto_reject'
  | 'cancel'

/**
 * Escalation action
 */
export interface EscalationAction {
  type: EscalationActionType
  target?: string // userId, positionId, or 'manager'
  targetType?: 'user' | 'position' | 'role' | 'manager'
  notificationTemplate?: string
  message?: string
}

/**
 * Escalation condition
 */
export interface EscalationCondition {
  field: string
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains'
  value: any
}

/**
 * Escalation processing result
 */
export interface EscalationProcessingResult {
  taskId: string
  escalated: boolean
  actionsExecuted: string[]
  newLevel: number
  error?: string
}

// =============================================================================
// BPMN ESCALATION SERVICE
// =============================================================================

/**
 * BpmnEscalationService
 *
 * Handles escalation for BPMN workflow tasks.
 */
export class BpmnEscalationService {
  /**
   * Get overdue BPMN tasks for a company
   *
   * @param companyId - Company ID
   * @returns Array of overdue BPMN tasks
   */
  static async getOverdueBpmnTasks(companyId: string): Promise<BpmnEscalationTask[]> {
    try {
      const now = new Date().toISOString()
      const tasksRef = collection(db, 'companies', companyId, 'tasks')

      const q = query(
        tasksRef,
        where('category', '==', 'bpmn_workflow'),
        where('status', 'in', ['open', 'assigned', 'in_progress']),
        where('dueDate', '<=', now)
      )

      const snapshot = await getDocs(q)

      return snapshot.docs.map(doc => ({
        id: doc.id,
        companyId,
        ...doc.data()
      })) as BpmnEscalationTask[]

    } catch (error) {
      console.error('[BpmnEscalationService] Error getting overdue tasks', error)
      return []
    }
  }

  /**
   * Get BPMN tasks pending escalation check
   *
   * @param companyId - Company ID
   * @returns Tasks that need escalation evaluation
   */
  static async getTasksPendingEscalation(companyId: string): Promise<BpmnEscalationTask[]> {
    try {
      const tasksRef = collection(db, 'companies', companyId, 'tasks')

      // Get tasks with escalation policy that are active
      const q = query(
        tasksRef,
        where('category', '==', 'bpmn_workflow'),
        where('status', 'in', ['open', 'assigned', 'in_progress']),
        where('escalationPolicyId', '!=', null)
      )

      const snapshot = await getDocs(q)
      const tasks: BpmnEscalationTask[] = []

      for (const doc of snapshot.docs) {
        const task = { id: doc.id, companyId, ...doc.data() } as BpmnEscalationTask

        // Check if task is due for escalation
        if (await this.isTaskDueForEscalation(task)) {
          tasks.push(task)
        }
      }

      return tasks

    } catch (error) {
      console.error('[BpmnEscalationService] Error getting tasks pending escalation', error)
      return []
    }
  }

  /**
   * Check if a task is due for escalation
   *
   * @param task - BPMN task
   * @returns Whether the task needs escalation
   */
  static async isTaskDueForEscalation(task: BpmnEscalationTask): Promise<boolean> {
    if (!task.escalationPolicyId) return false

    const escalationPath = await this.getEscalationPath(task.companyId, task.escalationPolicyId)
    if (!escalationPath) return false

    const currentLevel = task.currentEscalationLevel || 0
    const nextRule = escalationPath.rules.find(r => r.level === currentLevel + 1)

    if (!nextRule) return false // Already at max level

    // Calculate time since task was created or last escalated
    const taskCreatedAt = new Date(task.createdAt)
    const now = new Date()
    const minutesSinceCreation = (now.getTime() - taskCreatedAt.getTime()) / (1000 * 60)

    return minutesSinceCreation >= nextRule.triggerAfterMinutes
  }

  /**
   * Process escalation for a single task
   *
   * @param companyId - Company ID
   * @param task - BPMN task to escalate
   * @returns Processing result
   */
  static async processTaskEscalation(
    companyId: string,
    task: BpmnEscalationTask
  ): Promise<EscalationProcessingResult> {
    const result: EscalationProcessingResult = {
      taskId: task.id,
      escalated: false,
      actionsExecuted: [],
      newLevel: task.currentEscalationLevel || 0
    }

    try {
      // Check feature flag
      const flags = await getBpmnFlags(companyId)
      if (!isBpmnFeatureEnabled(flags, companyId, 'enableBpmnEscalation')) {
        console.log('[BpmnEscalationService] BPMN escalation disabled', { taskId: task.id })
        return result
      }

      if (!task.escalationPolicyId) {
        console.log('[BpmnEscalationService] No escalation policy', { taskId: task.id })
        return result
      }

      // Get escalation path
      const escalationPath = await this.getEscalationPath(companyId, task.escalationPolicyId)
      if (!escalationPath) {
        result.error = 'Escalation path not found'
        return result
      }

      // Get next escalation rule
      const currentLevel = task.currentEscalationLevel || 0
      const nextRule = escalationPath.rules.find(r => r.level === currentLevel + 1)

      if (!nextRule) {
        console.log('[BpmnEscalationService] No next escalation rule', {
          taskId: task.id,
          currentLevel
        })
        return result
      }

      // Check if time threshold is met
      const taskCreatedAt = new Date(task.createdAt)
      const now = new Date()
      const minutesSinceCreation = (now.getTime() - taskCreatedAt.getTime()) / (1000 * 60)

      if (minutesSinceCreation < nextRule.triggerAfterMinutes) {
        console.log('[BpmnEscalationService] Time threshold not met', {
          taskId: task.id,
          minutesSinceCreation,
          threshold: nextRule.triggerAfterMinutes
        })
        return result
      }

      // Check conditions if any
      if (nextRule.conditions && nextRule.conditions.length > 0) {
        const conditionsMet = this.evaluateConditions(nextRule.conditions, task)
        if (!conditionsMet) {
          console.log('[BpmnEscalationService] Conditions not met', { taskId: task.id })
          return result
        }
      }

      // Execute actions
      console.log('[BpmnEscalationService] Executing escalation', {
        taskId: task.id,
        level: nextRule.level,
        actions: nextRule.actions.map(a => a.type)
      })

      for (const action of nextRule.actions) {
        const actionResult = await this.executeAction(companyId, task, action)
        result.actionsExecuted.push(`${action.type}:${actionResult ? 'success' : 'failed'}`)
      }

      // Update task escalation level
      await this.updateTaskEscalationLevel(companyId, task.id, nextRule.level)

      result.escalated = true
      result.newLevel = nextRule.level

      // Log escalation event
      await this.logEscalationEvent(companyId, task.id, {
        level: nextRule.level,
        ruleName: nextRule.name,
        actionsExecuted: result.actionsExecuted
      })

      console.log('[BpmnEscalationService] Escalation completed', {
        taskId: task.id,
        newLevel: result.newLevel,
        actionsExecuted: result.actionsExecuted
      })

      return result

    } catch (error) {
      console.error('[BpmnEscalationService] Error processing escalation', {
        taskId: task.id,
        error
      })
      result.error = error instanceof Error ? error.message : 'Unknown error'
      return result
    }
  }

  /**
   * Execute an escalation action
   */
  private static async executeAction(
    companyId: string,
    task: BpmnEscalationTask,
    action: EscalationAction
  ): Promise<boolean> {
    try {
      switch (action.type) {
        case 'notify':
          return await this.executeNotifyAction(companyId, task, action)

        case 'remind':
          return await this.executeRemindAction(companyId, task, action)

        case 'escalate':
          return await this.executeEscalateAction(companyId, task, action)

        case 'reassign':
          return await this.executeReassignAction(companyId, task, action)

        case 'add_approver':
          return await this.executeAddApproverAction(companyId, task, action)

        case 'auto_approve':
          return await this.executeAutoApproveAction(companyId, task)

        case 'auto_reject':
          return await this.executeAutoRejectAction(companyId, task)

        case 'cancel':
          return await this.executeCancelAction(companyId, task)

        default:
          console.warn('[BpmnEscalationService] Unknown action type', { type: action.type })
          return false
      }
    } catch (error) {
      console.error('[BpmnEscalationService] Error executing action', {
        action: action.type,
        error
      })
      return false
    }
  }

  /**
   * Execute notify action
   */
  private static async executeNotifyAction(
    companyId: string,
    task: BpmnEscalationTask,
    action: EscalationAction
  ): Promise<boolean> {
    const targetUserId = await this.resolveTarget(companyId, task, action)
    if (!targetUserId) return false

    // Create notification
    const notificationsRef = collection(db, 'companies', companyId, 'notifications')
    await addDoc(notificationsRef, {
      userId: targetUserId,
      type: 'task_escalation',
      title: 'Task Escalation',
      message: action.message || `Task "${task.title}" has been escalated`,
      taskId: task.id,
      read: false,
      createdAt: new Date().toISOString()
    })

    return true
  }

  /**
   * Execute remind action
   */
  private static async executeRemindAction(
    companyId: string,
    task: BpmnEscalationTask,
    action: EscalationAction
  ): Promise<boolean> {
    const targetUserId = task.assignedUserId
    if (!targetUserId) return false

    // Create reminder notification
    const notificationsRef = collection(db, 'companies', companyId, 'notifications')
    await addDoc(notificationsRef, {
      userId: targetUserId,
      type: 'task_reminder',
      title: 'Task Reminder',
      message: action.message || `Reminder: Task "${task.title}" is awaiting your action`,
      taskId: task.id,
      read: false,
      createdAt: new Date().toISOString()
    })

    return true
  }

  /**
   * Execute escalate action (notify next level)
   */
  private static async executeEscalateAction(
    companyId: string,
    task: BpmnEscalationTask,
    action: EscalationAction
  ): Promise<boolean> {
    const targetUserId = await this.resolveTarget(companyId, task, action)
    if (!targetUserId) return false

    // Create escalation notification
    const notificationsRef = collection(db, 'companies', companyId, 'notifications')
    await addDoc(notificationsRef, {
      userId: targetUserId,
      type: 'task_escalation_escalation',
      title: 'Task Escalated',
      message: action.message || `Task "${task.title}" has been escalated to you`,
      taskId: task.id,
      read: false,
      createdAt: new Date().toISOString()
    })

    return true
  }

  /**
   * Execute reassign action
   */
  private static async executeReassignAction(
    companyId: string,
    task: BpmnEscalationTask,
    action: EscalationAction
  ): Promise<boolean> {
    const targetUserId = await this.resolveTarget(companyId, task, action)
    if (!targetUserId) return false

    // Update task assignment
    const taskRef = doc(db, 'companies', companyId, 'tasks', task.id)
    await updateDoc(taskRef, {
      assignedUserId: targetUserId,
      reassignedAt: new Date().toISOString(),
      reassignedBy: 'system_escalation',
      status: 'assigned'
    })

    // Write to BPMN outbox
    const outboxRef = collection(db, 'companies', companyId, 'bpmnOutbox')
    await addDoc(outboxRef, {
      companyId,
      eventType: 'ASSIGN_TASK',
      payload: {
        taskId: task.id,
        flowableTaskId: task.flowableTaskId,
        assignee: targetUserId
      },
      status: 'pending',
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date().toISOString(),
      correlationId: `escalation_reassign_${task.id}_${Date.now()}`
    })

    return true
  }

  /**
   * Execute add approver action
   */
  private static async executeAddApproverAction(
    companyId: string,
    task: BpmnEscalationTask,
    action: EscalationAction
  ): Promise<boolean> {
    const targetUserId = await this.resolveTarget(companyId, task, action)
    if (!targetUserId) return false

    // Add to candidate users
    const taskRef = doc(db, 'companies', companyId, 'tasks', task.id)
    const candidateUserIds = task.candidateUserIds || []

    if (!candidateUserIds.includes(targetUserId)) {
      candidateUserIds.push(targetUserId)

      await updateDoc(taskRef, {
        candidateUserIds,
        updatedAt: new Date().toISOString()
      })
    }

    // Notify the new approver
    const notificationsRef = collection(db, 'companies', companyId, 'notifications')
    await addDoc(notificationsRef, {
      userId: targetUserId,
      type: 'approval_required',
      title: 'Approval Required',
      message: `You have been added as an approver for task "${task.title}"`,
      taskId: task.id,
      read: false,
      createdAt: new Date().toISOString()
    })

    return true
  }

  /**
   * Execute auto approve action
   */
  private static async executeAutoApproveAction(
    companyId: string,
    task: BpmnEscalationTask
  ): Promise<boolean> {
    const taskRef = doc(db, 'companies', companyId, 'tasks', task.id)

    await updateDoc(taskRef, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      completedBy: 'system_auto_approve',
      completionReason: 'Auto-approved due to escalation policy',
      flowableSyncStatus: 'pending'
    })

    // Write to BPMN outbox
    const outboxRef = collection(db, 'companies', companyId, 'bpmnOutbox')
    await addDoc(outboxRef, {
      companyId,
      eventType: 'COMPLETE_TASK',
      payload: {
        taskId: task.id,
        flowableTaskId: task.flowableTaskId,
        variables: {
          outcome: 'auto_approved',
          completedBy: 'system',
          completionReason: 'Auto-approved due to escalation policy'
        }
      },
      status: 'pending',
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date().toISOString(),
      correlationId: `escalation_autoapprove_${task.id}_${Date.now()}`
    })

    return true
  }

  /**
   * Execute auto reject action
   */
  private static async executeAutoRejectAction(
    companyId: string,
    task: BpmnEscalationTask
  ): Promise<boolean> {
    const taskRef = doc(db, 'companies', companyId, 'tasks', task.id)

    await updateDoc(taskRef, {
      status: 'rejected',
      completedAt: new Date().toISOString(),
      completedBy: 'system_auto_reject',
      completionReason: 'Auto-rejected due to escalation policy',
      flowableSyncStatus: 'pending'
    })

    // Write to BPMN outbox
    const outboxRef = collection(db, 'companies', companyId, 'bpmnOutbox')
    await addDoc(outboxRef, {
      companyId,
      eventType: 'COMPLETE_TASK',
      payload: {
        taskId: task.id,
        flowableTaskId: task.flowableTaskId,
        variables: {
          outcome: 'auto_rejected',
          completedBy: 'system',
          completionReason: 'Auto-rejected due to escalation policy'
        }
      },
      status: 'pending',
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date().toISOString(),
      correlationId: `escalation_autoreject_${task.id}_${Date.now()}`
    })

    return true
  }

  /**
   * Execute cancel action
   */
  private static async executeCancelAction(
    companyId: string,
    task: BpmnEscalationTask
  ): Promise<boolean> {
    const taskRef = doc(db, 'companies', companyId, 'tasks', task.id)

    await updateDoc(taskRef, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancelledBy: 'system_escalation',
      cancellationReason: 'Cancelled due to escalation policy'
    })

    return true
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Get escalation path configuration
   */
  static async getEscalationPath(
    companyId: string,
    escalationPathId: string
  ): Promise<EscalationPath | null> {
    try {
      const pathRef = doc(db, 'companies', companyId, 'escalationPaths', escalationPathId)
      const pathSnap = await getDoc(pathRef)

      if (!pathSnap.exists()) return null

      return { id: pathSnap.id, ...pathSnap.data() } as EscalationPath

    } catch (error) {
      console.error('[BpmnEscalationService] Error getting escalation path', error)
      return null
    }
  }

  /**
   * Resolve target user for an action
   */
  private static async resolveTarget(
    companyId: string,
    task: BpmnEscalationTask,
    action: EscalationAction
  ): Promise<string | null> {
    if (action.target && action.targetType === 'user') {
      return action.target
    }

    if (action.targetType === 'manager' && task.assignedUserId) {
      // Get manager of assigned user
      return await this.getManagerOfUser(companyId, task.assignedUserId)
    }

    if (action.target && action.targetType === 'position') {
      // Get first user in position
      return await this.getFirstUserInPosition(companyId, action.target)
    }

    return null
  }

  /**
   * Get manager of a user
   */
  private static async getManagerOfUser(
    companyId: string,
    userId: string
  ): Promise<string | null> {
    try {
      // Get user's position assignment
      const assignmentsRef = collection(db, 'companies', companyId, 'positionAssignments')
      const q = query(
        assignmentsRef,
        where('userId', '==', userId),
        where('status', '==', 'active')
      )

      const snapshot = await getDocs(q)
      if (snapshot.empty || snapshot.docs.length === 0) return null

      const assignment = snapshot.docs[0]!.data()
      if (!assignment.positionId) return null

      // Get position
      const positionRef = doc(db, 'companies', companyId, 'positions', assignment.positionId)
      const positionSnap = await getDoc(positionRef)

      if (!positionSnap.exists()) return null

      const position = positionSnap.data()
      if (!position.reportsTo) return null

      // Get manager position holder
      return await this.getFirstUserInPosition(companyId, position.reportsTo)

    } catch (error) {
      console.error('[BpmnEscalationService] Error getting manager', error)
      return null
    }
  }

  /**
   * Get first user in a position
   */
  private static async getFirstUserInPosition(
    companyId: string,
    positionId: string
  ): Promise<string | null> {
    try {
      const assignmentsRef = collection(db, 'companies', companyId, 'positionAssignments')
      const q = query(
        assignmentsRef,
        where('positionId', '==', positionId),
        where('status', '==', 'active')
      )

      const snapshot = await getDocs(q)
      if (snapshot.empty || snapshot.docs.length === 0) return null

      return snapshot.docs[0]!.data().userId

    } catch (error) {
      console.error('[BpmnEscalationService] Error getting position user', error)
      return null
    }
  }

  /**
   * Evaluate escalation conditions
   */
  private static evaluateConditions(
    conditions: EscalationCondition[],
    task: BpmnEscalationTask
  ): boolean {
    for (const condition of conditions) {
      const fieldValue = (task as any)[condition.field] ?? task.variables?.[condition.field]

      if (!this.evaluateCondition(fieldValue, condition.operator, condition.value)) {
        return false
      }
    }

    return true
  }

  /**
   * Evaluate a single condition
   */
  private static evaluateCondition(
    fieldValue: any,
    operator: string,
    conditionValue: any
  ): boolean {
    switch (operator) {
      case 'eq':
        return fieldValue === conditionValue
      case 'ne':
        return fieldValue !== conditionValue
      case 'gt':
        return fieldValue > conditionValue
      case 'lt':
        return fieldValue < conditionValue
      case 'gte':
        return fieldValue >= conditionValue
      case 'lte':
        return fieldValue <= conditionValue
      case 'contains':
        return String(fieldValue).includes(String(conditionValue))
      default:
        return false
    }
  }

  /**
   * Update task escalation level
   */
  private static async updateTaskEscalationLevel(
    companyId: string,
    taskId: string,
    newLevel: number
  ): Promise<void> {
    const taskRef = doc(db, 'companies', companyId, 'tasks', taskId)
    await updateDoc(taskRef, {
      currentEscalationLevel: newLevel,
      lastEscalatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
  }

  /**
   * Log escalation event for audit
   */
  private static async logEscalationEvent(
    companyId: string,
    taskId: string,
    details: Record<string, any>
  ): Promise<void> {
    const eventsRef = collection(db, 'companies', companyId, 'escalationEvents')
    await addDoc(eventsRef, {
      taskId,
      taskType: 'bpmn_workflow',
      ...details,
      createdAt: new Date().toISOString()
    })
  }
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

export const processTaskEscalation = BpmnEscalationService.processTaskEscalation.bind(BpmnEscalationService)
export const getOverdueBpmnTasks = BpmnEscalationService.getOverdueBpmnTasks.bind(BpmnEscalationService)
export const getTasksPendingEscalation = BpmnEscalationService.getTasksPendingEscalation.bind(BpmnEscalationService)
