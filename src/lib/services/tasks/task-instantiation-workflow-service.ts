// Task Template Instantiation Workflow Service
// Handles the complete workflow from template selection to task creation

import {
  collection,
  doc,
  getDocs,
  query,
  where,
  addDoc,
  updateDoc,
  runTransaction,
  getDoc
} from 'firebase/firestore'
import { db } from '../../firebase'
import { TaskTemplateService } from './task-template-service'
import { PositionTaskAssignmentService } from './position-task-assignment-service'
import { getCurrentAssignment } from '../org/org-services'
import type {
  TaskTemplate,
  GeneratedTask,
  PositionTaskTemplate,
  TaskDoDProgress
} from '@/types/task-template-schema'

export interface TaskInstantiationRequest {
  id: string
  companyId: string
  templateId: string
  requestedBy: string
  requestedFor: string // User ID
  positionId?: string
  customizations?: {
    title?: string
    description?: string
    priority?: 'low' | 'medium' | 'high' | 'urgent'
    dueDateOffset?: number
    customInstructions?: string
  }
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  approvalRequired: boolean
  approvedBy?: string
  approvedAt?: string
  rejectionReason?: string
  createdAt: string
  updatedAt: string
}

export class TaskInstantiationWorkflowService {

  // ============================================================================
  // TEMPLATE INSTANTIATION WORKFLOW
  // ============================================================================

  /**
   * Create a task instantiation request
   * This is the entry point for creating tasks from templates
   */
  static async createInstantiationRequest(
    companyId: string,
    templateId: string,
    requestedBy: string,
    requestedFor: string,
    customizations?: TaskInstantiationRequest['customizations']
  ): Promise<string> {
    console.log(`Creating instantiation request for template ${templateId}`)

    try {
      const template = await TaskTemplateService.getTaskTemplate(companyId, templateId)
      if (!template) {
        throw new Error('Template not found')
      }

      // Get current position assignment for the target user
      const currentAssignment = await getCurrentAssignment(companyId, requestedFor)

      const requestRef = collection(db, 'companies', companyId, 'taskInstantiationRequests')
      const now = new Date().toISOString()

      const requestDataToSave = {
        companyId,
        templateId,
        requestedBy,
        requestedFor,
        positionId: currentAssignment?.positionId,
        customizations,
        status: 'pending' as const,
        approvalRequired: template.approvalRequired,
        createdAt: now,
        updatedAt: now,
      }

      const docRef = await addDoc(requestRef, requestDataToSave)
      const request: TaskInstantiationRequest = {
        ...requestDataToSave,
        id: docRef.id,
      }

      // If no approval required, automatically approve and create task
      if (!template.approvalRequired) {
        await this.approveInstantiationRequest(companyId, docRef.id, requestedBy)
      }

      return docRef.id

    } catch (error) {
      console.error('Error creating instantiation request:', error)
      throw error
    }
  }

  /**
   * Approve a task instantiation request
   */
  static async approveInstantiationRequest(
    companyId: string,
    requestId: string,
    approvedBy: string
  ): Promise<GeneratedTask> {
    console.log(`Approving instantiation request ${requestId}`)

    try {
      const requestRef = doc(db, 'companies', companyId, 'taskInstantiationRequests', requestId)
      const requestSnap = await getDoc(requestRef)

      if (!requestSnap.exists()) {
        throw new Error('Request not found')
      }

      const request = requestSnap.data() as TaskInstantiationRequest

      if (request.status !== 'pending') {
        throw new Error('Request is not pending')
      }

      // Create the task from template
      const task = await this.createTaskFromInstantiationRequest(companyId, request)

      // Update request status
      await updateDoc(requestRef, {
        status: 'approved',
        approvedBy,
        approvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      console.log(`Created task ${task.id} from approved request`)
      return task

    } catch (error) {
      console.error('Error approving instantiation request:', error)
      throw error
    }
  }

  /**
   * Reject a task instantiation request
   */
  static async rejectInstantiationRequest(
    companyId: string,
    requestId: string,
    rejectedBy: string,
    rejectionReason: string
  ): Promise<void> {
    console.log(`Rejecting instantiation request ${requestId}`)

    try {
      const requestRef = doc(db, 'companies', companyId, 'taskInstantiationRequests', requestId)
      await updateDoc(requestRef, {
        status: 'rejected',
        approvedBy: rejectedBy,
        approvedAt: new Date().toISOString(),
        rejectionReason,
        updatedAt: new Date().toISOString(),
      })

    } catch (error) {
      console.error('Error rejecting instantiation request:', error)
      throw error
    }
  }

  /**
   * Create a task from an approved instantiation request
   */
  private static async createTaskFromInstantiationRequest(
    companyId: string,
    request: TaskInstantiationRequest
  ): Promise<GeneratedTask> {
    const template = await TaskTemplateService.getTaskTemplate(companyId, request.templateId)
    if (!template) {
      throw new Error('Template not found')
    }

    const taskRef = collection(db, 'companies', companyId, 'tasks')
    const now = new Date().toISOString()

    // Calculate due date
    const dueDateOffset = request.customizations?.dueDateOffset || template.dueDateOffset
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + dueDateOffset)

    // Use customizations or template defaults
    const title = request.customizations?.title || template.name
    const description = request.customizations?.description || template.description
    const priority = request.customizations?.priority || template.priority

    const taskDataToSave = {
      templateId: template.id,
      positionId: request.positionId || '',
      assignedUserId: request.requestedFor,
      projectId: '',
      title,
      description: description + (request.customizations?.customInstructions ? `\n\n${request.customizations.customInstructions}` : ''),

      priority,
      estimatedHours: template.estimatedHours,
      dueDate: dueDate.toISOString(),
      assignmentType: 'manual' as const,
      assignmentReason: `Created from template: ${template.name} (Request: ${request.id})`,
      assignedBy: request.requestedBy,
      status: 'assigned' as const,
      progress: 0,
      definitionOfDone: template.definitionOfDone.map(dod => ({
        doDItemId: dod.id,
        text: dod.text,
        isRequired: dod.isRequired,
        isCompleted: false,
        order: dod.order,
      })),
      createdAt: now,
      updatedAt: now,
    }

    const docRef = await addDoc(taskRef, taskDataToSave)
    const task: GeneratedTask = {
      ...taskDataToSave,
      id: docRef.id,
    }

    // Update template usage count
    await TaskTemplateService.updateTaskTemplate(companyId, template.id, {
      usageCount: template.usageCount + 1,
      lastUsedAt: now,
    })

    return task
  }

  // ============================================================================
  // BULK INSTANTIATION
  // ============================================================================

  /**
   * Create tasks from template for multiple users
   */
  static async bulkInstantiateTasks(
    companyId: string,
    templateId: string,
    requestedBy: string,
    userIds: string[],
    customizations?: TaskInstantiationRequest['customizations']
  ): Promise<{ requestId: string; taskId?: string; error?: string }[]> {
    console.log(`Bulk instantiating template ${templateId} for ${userIds.length} users`)

    const results = await Promise.allSettled(
      userIds.map(async (userId) => {
        try {
          const requestId = await this.createInstantiationRequest(
            companyId,
            templateId,
            requestedBy,
            userId,
            customizations
          )

          // Check if task was created immediately (no approval required)
          const template = await TaskTemplateService.getTaskTemplate(companyId, templateId)
          if (template && !template.approvalRequired) {
            // Task was created immediately, get the task ID
            const tasks = await TaskTemplateService.getUserTasks(companyId, userId)
            const latestTask = tasks.find(t => t.templateId === templateId)
            return { requestId, taskId: latestTask?.id }
          }

          return { requestId }
        } catch (error) {
          return { requestId: '', error: error instanceof Error ? error.message : String(error) }
        }
      })
    )

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        return { requestId: '', error: result.reason?.message || 'Unknown error' }
      }
    })
  }

  /**
   * Create tasks from template for all users in a position
   */
  static async instantiateTasksForPosition(
    companyId: string,
    templateId: string,
    requestedBy: string,
    positionId: string,
    customizations?: TaskInstantiationRequest['customizations']
  ): Promise<{ requestId: string; taskId?: string; error?: string }[]> {
    console.log(`Instantiating template ${templateId} for all users in position ${positionId}`)

    try {
      // Get all current assignments for this position
      const assignmentsQuery = query(
        collection(db, 'companies', companyId, 'positionAssignments'),
        where('positionId', '==', positionId),
        where('status', '==', 'active')
      )

      const assignmentsSnapshot = await getDocs(assignmentsQuery)
      const userIds = assignmentsSnapshot.docs.map(doc => doc.data().userId)

      return await this.bulkInstantiateTasks(
        companyId,
        templateId,
        requestedBy,
        userIds,
        customizations
      )

    } catch (error) {
      console.error('Error instantiating tasks for position:', error)
      throw error
    }
  }

  // ============================================================================
  // REQUEST MANAGEMENT
  // ============================================================================

  /**
   * Get all instantiation requests for a company
   */
  static async getInstantiationRequests(
    companyId: string,
    filters?: {
      status?: string
      requestedBy?: string
      requestedFor?: string
    }
  ): Promise<TaskInstantiationRequest[]> {
    let q = query(collection(db, 'companies', companyId, 'taskInstantiationRequests'))

    if (filters?.status) {
      q = query(q, where('status', '==', filters.status))
    }
    if (filters?.requestedBy) {
      q = query(q, where('requestedBy', '==', filters.requestedBy))
    }
    if (filters?.requestedFor) {
      q = query(q, where('requestedFor', '==', filters.requestedFor))
    }

    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskInstantiationRequest))
  }

  /**
   * Get instantiation requests pending approval
   */
  static async getPendingApprovalRequests(companyId: string): Promise<TaskInstantiationRequest[]> {
    return await this.getInstantiationRequests(companyId, { status: 'pending' })
  }

  /**
   * Get instantiation requests for a specific user
   */
  static async getUserInstantiationRequests(
    companyId: string,
    userId: string
  ): Promise<TaskInstantiationRequest[]> {
    return await this.getInstantiationRequests(companyId, { requestedFor: userId })
  }

  // ============================================================================
  // TEMPLATE SELECTION HELPERS
  // ============================================================================

  /**
   * Get recommended templates for a position
   */
  static async getRecommendedTemplatesForPosition(
    companyId: string,
    positionId: string
  ): Promise<TaskTemplate[]> {
    try {
      // Get position details
      const positionRef = doc(db, 'companies', companyId, 'positions', positionId)
      const positionSnap = await getDoc(positionRef)

      if (!positionSnap.exists()) {
        return []
      }

      const position = positionSnap.data()

      // Get templates that match position criteria
      const templates = await TaskTemplateService.getTaskTemplates(companyId, {
        department: position.departmentId,
        positionLevel: position.level,
        isActive: true,
      })

      // Filter out templates already assigned to this position
      const assignedTemplates = await TaskTemplateService.getPositionTaskTemplates(
        companyId,
        positionId
      )
      const assignedTemplateIds = assignedTemplates.map(at => at.templateId)

      return templates.filter(template => !assignedTemplateIds.includes(template.id))

    } catch (error) {
      console.error('Error getting recommended templates for position:', error)
      return []
    }
  }

  /**
   * Get templates suitable for a user based on their current position
   */
  static async getRecommendedTemplatesForUser(
    companyId: string,
    userId: string
  ): Promise<TaskTemplate[]> {
    try {
      const currentAssignment = await getCurrentAssignment(companyId, userId)
      if (!currentAssignment) {
        return []
      }

      return await this.getRecommendedTemplatesForPosition(
        companyId,
        currentAssignment.positionId
      )

    } catch (error) {
      console.error('Error getting recommended templates for user:', error)
      return []
    }
  }
}
