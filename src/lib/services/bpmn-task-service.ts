/**
 * BPMN Task Service
 *
 * Handles task operations that need to communicate with Flowable BPMN engine.
 * Uses the outbox pattern for reliable async processing.
 *
 * IMPORTANT: This service is SEPARATE from TaskApprovalService.
 * - TaskApprovalService: Direct execution (no Flowable)
 * - BpmnTaskService: Flowable-backed BPMN workflow tasks
 *
 * @module lib/services/bpmn-task-service
 * @version 1.0.0
 * @since Stage 3 - Task Completion Bridge
 */

import {
  collection,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  query,
  where,
  getDocs
} from 'firebase/firestore'
import { db } from '../firebase'
import { getBpmnFlags, isBpmnFeatureEnabled } from '../bpmn/feature-flags'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result of a BPMN task operation
 */
export interface BpmnTaskOperationResult {
  success: boolean
  error?: string
  taskId?: string
  flowableTaskId?: string
}

/**
 * Outbox event for task operations
 */
interface BpmnOutboxEvent {
  companyId: string
  eventType: string
  payload: Record<string, any>
  status: 'pending' | 'processing' | 'completed' | 'failed'
  retryCount: number
  maxRetries: number
  createdAt: string
  correlationId: string
}

/**
 * Task completion options
 */
export interface TaskCompletionOptions {
  variables?: Record<string, any>
  comments?: string
  outcome?: string
}

/**
 * Task claim options
 */
export interface TaskClaimOptions {
  reason?: string
}

/**
 * Task delegation options
 */
export interface TaskDelegationOptions {
  delegateUserId: string
  reason?: string
  keepOriginalAssignee?: boolean
}

// =============================================================================
// BPMN TASK SERVICE
// =============================================================================

/**
 * BpmnTaskService
 *
 * Handles BPMN workflow task operations with Flowable integration.
 * All operations use the outbox pattern for reliability.
 */
export class BpmnTaskService {
  /**
   * Complete a BPMN task
   *
   * Flow:
   * 1. Updates Firestore task immediately (optimistic update)
   * 2. Writes to outbox for async Flowable completion
   * 3. Flowable advances workflow to next step via webhook
   *
   * @param companyId - Company ID
   * @param taskId - Firestore task ID
   * @param userId - User completing the task
   * @param options - Completion options (variables, comments, outcome)
   */
  static async completeTask(
    companyId: string,
    taskId: string,
    userId: string,
    options: TaskCompletionOptions = {}
  ): Promise<BpmnTaskOperationResult> {
    try {
      // 1. Get the task
      const taskRef = doc(db, 'companies', companyId, 'tasks', taskId)
      const taskSnap = await getDoc(taskRef)

      if (!taskSnap.exists()) {
        return { success: false, error: 'Task not found' }
      }

      const task = taskSnap.data()

      // 2. Verify this is a BPMN task
      if (!this.isBpmnTaskData(task)) {
        return { success: false, error: 'Not a BPMN workflow task' }
      }

      // 3. Check feature flag
      const flags = await getBpmnFlags(companyId)
      if (!isBpmnFeatureEnabled(flags, companyId, 'enableTaskCompletionBridge')) {
        console.warn('[BpmnTaskService] Task completion bridge disabled for company', companyId)
        return { success: false, error: 'BPMN task completion not enabled' }
      }

      // 4. Update Firestore immediately (optimistic update for instant UI feedback)
      const now = new Date().toISOString()
      await updateDoc(taskRef, {
        status: 'completed',
        completedAt: now,
        completedBy: userId,
        completionComments: options.comments || null,
        completionOutcome: options.outcome || null,
        outputVariables: options.variables || {},
        updatedAt: now,
        // Track Flowable sync status
        flowableSyncStatus: 'pending'
      })

      // 5. Write to outbox for async Flowable completion
      await this.writeToOutbox(companyId, {
        eventType: 'COMPLETE_TASK',
        payload: {
          taskId,
          flowableTaskId: task.flowableTaskId,
          variables: {
            ...options.variables,
            completedBy: userId,
            completedAt: now,
            comments: options.comments,
            outcome: options.outcome
          }
        },
        correlationId: `complete_${taskId}_${Date.now()}`
      })

      console.log('[BpmnTaskService] Task completion queued', {
        taskId,
        flowableTaskId: task.flowableTaskId,
        userId
      })

      return {
        success: true,
        taskId,
        flowableTaskId: task.flowableTaskId
      }

    } catch (error) {
      console.error('[BpmnTaskService] Error completing task', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Claim a BPMN task (assign to self from candidate list)
   *
   * @param companyId - Company ID
   * @param taskId - Firestore task ID
   * @param userId - User claiming the task
   * @param options - Claim options
   */
  static async claimTask(
    companyId: string,
    taskId: string,
    userId: string,
    options: TaskClaimOptions = {}
  ): Promise<BpmnTaskOperationResult> {
    try {
      const taskRef = doc(db, 'companies', companyId, 'tasks', taskId)
      const taskSnap = await getDoc(taskRef)

      if (!taskSnap.exists()) {
        return { success: false, error: 'Task not found' }
      }

      const task = taskSnap.data()

      if (!this.isBpmnTaskData(task)) {
        return { success: false, error: 'Not a BPMN workflow task' }
      }

      // Verify user is authorized to claim
      const canClaim = this.canUserClaimTask(task, userId)
      if (!canClaim) {
        return { success: false, error: 'User not authorized to claim this task' }
      }

      const now = new Date().toISOString()

      // Update Firestore
      await updateDoc(taskRef, {
        status: 'assigned',
        assignedUserId: userId,
        claimedAt: now,
        claimReason: options.reason || null,
        updatedAt: now
      })

      // Write to outbox
      await this.writeToOutbox(companyId, {
        eventType: 'CLAIM_TASK',
        payload: {
          taskId,
          flowableTaskId: task.flowableTaskId,
          userId
        },
        correlationId: `claim_${taskId}_${Date.now()}`
      })

      console.log('[BpmnTaskService] Task claim queued', {
        taskId,
        flowableTaskId: task.flowableTaskId,
        userId
      })

      return {
        success: true,
        taskId,
        flowableTaskId: task.flowableTaskId
      }

    } catch (error) {
      console.error('[BpmnTaskService] Error claiming task', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Unclaim a BPMN task (release back to candidate pool)
   *
   * @param companyId - Company ID
   * @param taskId - Firestore task ID
   * @param userId - User unclaiming the task
   */
  static async unclaimTask(
    companyId: string,
    taskId: string,
    userId: string
  ): Promise<BpmnTaskOperationResult> {
    try {
      const taskRef = doc(db, 'companies', companyId, 'tasks', taskId)
      const taskSnap = await getDoc(taskRef)

      if (!taskSnap.exists()) {
        return { success: false, error: 'Task not found' }
      }

      const task = taskSnap.data()

      if (!this.isBpmnTaskData(task)) {
        return { success: false, error: 'Not a BPMN workflow task' }
      }

      // Verify user is the current assignee
      if (task.assignedUserId !== userId) {
        return { success: false, error: 'Only the assigned user can unclaim the task' }
      }

      const now = new Date().toISOString()

      // Update Firestore
      await updateDoc(taskRef, {
        status: 'open',
        assignedUserId: null,
        unclaimedAt: now,
        unclaimedBy: userId,
        updatedAt: now
      })

      // Write to outbox
      await this.writeToOutbox(companyId, {
        eventType: 'UNCLAIM_TASK',
        payload: {
          taskId,
          flowableTaskId: task.flowableTaskId
        },
        correlationId: `unclaim_${taskId}_${Date.now()}`
      })

      return {
        success: true,
        taskId,
        flowableTaskId: task.flowableTaskId
      }

    } catch (error) {
      console.error('[BpmnTaskService] Error unclaiming task', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Delegate a BPMN task to another user
   *
   * @param companyId - Company ID
   * @param taskId - Firestore task ID
   * @param userId - User delegating the task
   * @param options - Delegation options
   */
  static async delegateTask(
    companyId: string,
    taskId: string,
    userId: string,
    options: TaskDelegationOptions
  ): Promise<BpmnTaskOperationResult> {
    try {
      const taskRef = doc(db, 'companies', companyId, 'tasks', taskId)
      const taskSnap = await getDoc(taskRef)

      if (!taskSnap.exists()) {
        return { success: false, error: 'Task not found' }
      }

      const task = taskSnap.data()

      if (!this.isBpmnTaskData(task)) {
        return { success: false, error: 'Not a BPMN workflow task' }
      }

      // Verify user is the current assignee or has delegation rights
      if (task.assignedUserId !== userId) {
        return { success: false, error: 'Only the assigned user can delegate the task' }
      }

      const now = new Date().toISOString()

      // Update Firestore
      await updateDoc(taskRef, {
        assignedUserId: options.delegateUserId,
        delegatedBy: userId,
        delegatedAt: now,
        delegationReason: options.reason || null,
        originalAssignee: options.keepOriginalAssignee ? userId : null,
        updatedAt: now
      })

      // Write to outbox
      await this.writeToOutbox(companyId, {
        eventType: 'DELEGATE_TASK',
        payload: {
          taskId,
          flowableTaskId: task.flowableTaskId,
          delegateUserId: options.delegateUserId,
          originalUserId: userId
        },
        correlationId: `delegate_${taskId}_${Date.now()}`
      })

      return {
        success: true,
        taskId,
        flowableTaskId: task.flowableTaskId
      }

    } catch (error) {
      console.error('[BpmnTaskService] Error delegating task', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Add a comment to a BPMN task
   *
   * @param companyId - Company ID
   * @param taskId - Firestore task ID
   * @param userId - User adding the comment
   * @param comment - Comment text
   */
  static async addComment(
    companyId: string,
    taskId: string,
    userId: string,
    comment: string
  ): Promise<BpmnTaskOperationResult> {
    try {
      const taskRef = doc(db, 'companies', companyId, 'tasks', taskId)
      const taskSnap = await getDoc(taskRef)

      if (!taskSnap.exists()) {
        return { success: false, error: 'Task not found' }
      }

      const task = taskSnap.data()

      if (!this.isBpmnTaskData(task)) {
        return { success: false, error: 'Not a BPMN workflow task' }
      }

      const now = new Date().toISOString()
      const commentId = `comment_${Date.now()}`

      // Add comment to task's comments array
      const comments = task.comments || []
      comments.push({
        id: commentId,
        userId,
        text: comment,
        createdAt: now
      })

      await updateDoc(taskRef, {
        comments,
        updatedAt: now
      })

      // Write to outbox for Flowable sync
      await this.writeToOutbox(companyId, {
        eventType: 'ADD_COMMENT',
        payload: {
          taskId,
          flowableTaskId: task.flowableTaskId,
          userId,
          comment,
          commentId
        },
        correlationId: `comment_${taskId}_${Date.now()}`
      })

      return { success: true, taskId }

    } catch (error) {
      console.error('[BpmnTaskService] Error adding comment', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Set variables on a BPMN task
   *
   * @param companyId - Company ID
   * @param taskId - Firestore task ID
   * @param variables - Variables to set
   */
  static async setTaskVariables(
    companyId: string,
    taskId: string,
    variables: Record<string, any>
  ): Promise<BpmnTaskOperationResult> {
    try {
      const taskRef = doc(db, 'companies', companyId, 'tasks', taskId)
      const taskSnap = await getDoc(taskRef)

      if (!taskSnap.exists()) {
        return { success: false, error: 'Task not found' }
      }

      const task = taskSnap.data()

      if (!this.isBpmnTaskData(task)) {
        return { success: false, error: 'Not a BPMN workflow task' }
      }

      const now = new Date().toISOString()

      // Update task variables in Firestore
      const existingVariables = task.variables || {}
      await updateDoc(taskRef, {
        variables: { ...existingVariables, ...variables },
        updatedAt: now
      })

      // Write to outbox for Flowable sync
      await this.writeToOutbox(companyId, {
        eventType: 'UPDATE_VARIABLES',
        payload: {
          taskId,
          flowableTaskId: task.flowableTaskId,
          variables
        },
        correlationId: `vars_${taskId}_${Date.now()}`
      })

      return { success: true, taskId }

    } catch (error) {
      console.error('[BpmnTaskService] Error setting task variables', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // ===========================================================================
  // QUERY METHODS
  // ===========================================================================

  /**
   * Check if a task is a BPMN workflow task
   */
  static async isBpmnTask(
    companyId: string,
    taskId: string
  ): Promise<boolean> {
    try {
      const taskRef = doc(db, 'companies', companyId, 'tasks', taskId)
      const taskSnap = await getDoc(taskRef)

      if (!taskSnap.exists()) return false

      return this.isBpmnTaskData(taskSnap.data())

    } catch (error) {
      console.error('[BpmnTaskService] Error checking task type', error)
      return false
    }
  }

  /**
   * Get pending BPMN tasks for a user
   */
  static async getPendingTasksForUser(
    companyId: string,
    userId: string
  ): Promise<any[]> {
    try {
      const tasksRef = collection(db, 'companies', companyId, 'tasks')

      // Get tasks assigned to user
      const assignedQuery = query(
        tasksRef,
        where('category', '==', 'bpmn_workflow'),
        where('assignedUserId', '==', userId),
        where('status', 'in', ['assigned', 'open'])
      )

      const assignedSnap = await getDocs(assignedQuery)

      // Get tasks where user is in candidate list
      const candidateQuery = query(
        tasksRef,
        where('category', '==', 'bpmn_workflow'),
        where('candidateUserIds', 'array-contains', userId),
        where('status', '==', 'open')
      )

      const candidateSnap = await getDocs(candidateQuery)

      // Combine and deduplicate
      const taskMap = new Map()

      assignedSnap.docs.forEach(doc => {
        taskMap.set(doc.id, { id: doc.id, ...doc.data() })
      })

      candidateSnap.docs.forEach(doc => {
        if (!taskMap.has(doc.id)) {
          taskMap.set(doc.id, { id: doc.id, ...doc.data() })
        }
      })

      return Array.from(taskMap.values())

    } catch (error) {
      console.error('[BpmnTaskService] Error getting pending tasks', error)
      return []
    }
  }

  /**
   * Get tasks by workflow instance
   */
  static async getTasksByWorkflowInstance(
    companyId: string,
    workflowInstanceId: string
  ): Promise<any[]> {
    try {
      const tasksRef = collection(db, 'companies', companyId, 'tasks')
      const q = query(
        tasksRef,
        where('workflowInstanceId', '==', workflowInstanceId),
        where('category', '==', 'bpmn_workflow')
      )

      const snapshot = await getDocs(q)
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

    } catch (error) {
      console.error('[BpmnTaskService] Error getting workflow tasks', error)
      return []
    }
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Check if task data indicates a BPMN task
   */
  private static isBpmnTaskData(task: any): boolean {
    return task?.category === 'bpmn_workflow' && !!task?.flowableTaskId
  }

  /**
   * Check if user can claim the task
   */
  private static canUserClaimTask(task: any, userId: string): boolean {
    // Already assigned to user
    if (task.assignedUserId === userId) return true

    // User is in candidate list
    if (task.candidateUserIds?.includes(userId)) return true

    // Task is unassigned and user has general access
    if (!task.assignedUserId && task.status === 'open') return true

    return false
  }

  /**
   * Write event to outbox collection
   */
  private static async writeToOutbox(
    companyId: string,
    eventData: {
      eventType: string
      payload: Record<string, any>
      correlationId: string
    }
  ): Promise<void> {
    const outboxRef = collection(db, 'companies', companyId, 'bpmnOutbox')
    const now = new Date().toISOString()

    const outboxEvent: BpmnOutboxEvent = {
      companyId,
      eventType: eventData.eventType,
      payload: eventData.payload,
      status: 'pending',
      retryCount: 0,
      maxRetries: 3,
      createdAt: now,
      correlationId: eventData.correlationId
    }

    await addDoc(outboxRef, outboxEvent)
  }
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

export const completeBpmnTask = BpmnTaskService.completeTask.bind(BpmnTaskService)
export const claimBpmnTask = BpmnTaskService.claimTask.bind(BpmnTaskService)
export const unclaimBpmnTask = BpmnTaskService.unclaimTask.bind(BpmnTaskService)
export const delegateBpmnTask = BpmnTaskService.delegateTask.bind(BpmnTaskService)
export const isBpmnTask = BpmnTaskService.isBpmnTask.bind(BpmnTaskService)
