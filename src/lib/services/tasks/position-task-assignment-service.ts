// Position-Based Task Assignment Service
// Handles automatic task generation when users are assigned to positions

import {
  collection,
  doc,
  getDocs,
  query,
  where,
  onSnapshot,
  runTransaction,
  addDoc,
  updateDoc,
  getDoc
} from 'firebase/firestore'
import { db } from '../../firebase'
import { companyCollectionPathSegments, companySubcollectionPathSegments } from '../../firestore-paths'
import { TaskTemplateService } from './task-template-service'
import { getCurrentAssignment, getCurrentAssignmentForUser } from '../org/org-services'
import { TaskNotificationService } from './task-notification-service'
import { sendTaskAssignedPushNotification, sendTaskDelegatedPushNotification } from '../notifications/push-sender-service'
import type {
  PositionTaskTemplate,
  GeneratedTask,
  TaskTemplate
} from '@/types/task-template-schema'

export class PositionTaskAssignmentService {

  // ============================================================================
  // AUTOMATIC TASK GENERATION ON POSITION ASSIGNMENT
  // ============================================================================

  /**
   * Generate tasks when a user is assigned to a position
   * This should be called whenever a position assignment is created
   */
  static async generateTasksOnPositionAssignment(
    companyId: string,
    positionId: string,
    userId: string,
    assignmentType: 'permanent' | 'temporary' | 'acting' = 'permanent',
    groupId?: string
  ): Promise<GeneratedTask[]> {
    console.log(`Generating tasks for user ${userId} assigned to position ${positionId}`)

    try {
      // Get all active template assignments for this position
      const positionAssignments = await TaskTemplateService.getPositionTaskTemplates(
        companyId,
        positionId,
        groupId
      )

      const tasks: GeneratedTask[] = []

      for (const assignment of positionAssignments) {
        // Check if task should be generated based on assignment mode
        const shouldGenerate = await this.shouldGenerateTaskForAssignment(
          assignment,
          assignmentType
        )

        if (shouldGenerate) {
          const template = await TaskTemplateService.getTaskTemplate(
            companyId,
            assignment.templateId,
            groupId
          )

          if (template) {
            const task = await this.createTaskFromTemplate(
              companyId,
              template,
              assignment,
              userId,
              positionId,
              'assignment',
              groupId
            )
            tasks.push(task)
          }
        }
      }

      console.log(`Generated ${tasks.length} tasks for position assignment`)
      return tasks

    } catch (error) {
      console.error('Error generating tasks on position assignment:', error)
      throw error
    }
  }

  /**
   * Generate tasks when a user logs in (for immediate assignment mode)
   */
  static async generateTasksOnUserLogin(
    companyId: string,
    userId: string,
    groupId?: string
  ): Promise<GeneratedTask[]> {
    console.log(`Generating tasks for user login: ${userId}`)

    try {
      // Get current position assignment for user
      const currentAssignment = await getCurrentAssignmentForUser(companyId, userId, groupId)

      if (!currentAssignment) {
        console.log(`No current position assignment found for user ${userId}`)
        return []
      }

      // Generate tasks for the current position
      return await this.generateTasksOnPositionAssignment(
        companyId,
        currentAssignment.positionId,
        userId,
        currentAssignment.assignmentType as any,
        groupId
      )

    } catch (error) {
      console.error('Error generating tasks on user login:', error)
      throw error
    }
  }

  /**
   * Generate tasks for all users in a position (bulk operation)
   * Useful for when new templates are assigned to positions
   */
  static async generateTasksForAllPositionUsers(
    companyId: string,
    positionId: string,
    groupId?: string
  ): Promise<GeneratedTask[]> {
    console.log(`Generating tasks for all users in position ${positionId}`)

    try {
      // Get all current assignments for this position
      const assignmentsQuery = query(
        collection(db, ...companyCollectionPathSegments(groupId || companyId, companyId, 'positionAssignments')),
        where('positionId', '==', positionId),
        where('status', '==', 'active')
      )

      const assignmentsSnapshot = await getDocs(assignmentsQuery)
      const allTasks: GeneratedTask[] = []

      for (const assignmentDoc of assignmentsSnapshot.docs) {
        const assignment = assignmentDoc.data()
        const tasks = await this.generateTasksOnPositionAssignment(
          companyId,
          positionId,
          assignment.userId,
          assignment.assignmentType,
          groupId
        )
        allTasks.push(...tasks)
      }

      console.log(`Generated ${allTasks.length} tasks for all users in position`)
      return allTasks

    } catch (error) {
      console.error('Error generating tasks for all position users:', error)
      throw error
    }
  }

  // ============================================================================
  // TEMPLATE ASSIGNMENT TO POSITIONS
  // ============================================================================

  /**
   * Assign a task template to a position and optionally generate tasks for current users
   */
  static async assignTemplateToPosition(
    companyId: string,
    positionId: string,
    templateId: string,
    assignmentConfig: {
      assignmentMode: 'immediate' | 'on_assignment' | 'scheduled' | 'conditional'
      assignmentDate?: string
      customDueDateOffset?: number
      customPriority?: 'low' | 'medium' | 'high' | 'urgent'
      customInstructions?: string
      generateForCurrentUsers?: boolean
    },
    groupId?: string
  ): Promise<{ assignmentId: string; tasks: GeneratedTask[] }> {
    console.log(`Assigning template ${templateId} to position ${positionId}`)

    try {
      // Create the position-template assignment
      const { generateForCurrentUsers, ...templateAssignmentConfig } = assignmentConfig
      const assignmentId = await TaskTemplateService.assignTemplateToPosition(
        companyId,
        positionId,
        templateId,
        templateAssignmentConfig,
        groupId
      )

      let tasks: GeneratedTask[] = []

      // Generate tasks for current users if requested
      if (assignmentConfig.generateForCurrentUsers) {
        tasks = await this.generateTasksForAllPositionUsers(
          companyId,
          positionId,
          groupId
        )
      }

      return { assignmentId, tasks }

    } catch (error) {
      console.error('Error assigning template to position:', error)
      throw error
    }
  }

  /**
   * Remove template assignment from position
   */
  static async removeTemplateFromPosition(
    companyId: string,
    positionId: string,
    templateId: string,
    groupId?: string
  ): Promise<void> {
    console.log(`Removing template ${templateId} from position ${positionId}`)

    try {
      await TaskTemplateService.removeTemplateFromPosition(
        companyId,
        positionId,
        templateId,
        groupId
      )

      // Optionally cancel pending tasks from this template
      // This would be a separate operation depending on business rules

    } catch (error) {
      console.error('Error removing template from position:', error)
      throw error
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Check if a task should be generated based on assignment rules
   */
  private static async shouldGenerateTaskForAssignment(
    assignment: PositionTaskTemplate,
    assignmentType: string
  ): Promise<boolean> {
    switch (assignment.assignmentMode) {
      case 'immediate':
        // Generate immediately for any assignment type
        return true

      case 'on_assignment':
        // Generate only for permanent assignments
        return assignmentType === 'permanent'

      case 'scheduled':
        // Generate only if assignment date matches
        if (!assignment.assignmentDate) return false
        const assignmentDate = new Date(assignment.assignmentDate)
        const today = new Date()
        return assignmentDate.toDateString() === today.toDateString()

      case 'conditional':
        // TODO: Implement conditional logic based on assignmentConditions
        // For now, generate for permanent assignments only
        return assignmentType === 'permanent'

      default:
        return false
    }
  }

  /**
   * Create a task from a template with position-specific customization
   */
  private static async createTaskFromTemplate(
    companyId: string,
    template: TaskTemplate,
    assignment: PositionTaskTemplate,
    userId: string,
    positionId: string,
    triggerType: string,
    groupId?: string
  ): Promise<GeneratedTask> {
    const taskRef = collection(db, ...companyCollectionPathSegments(groupId || companyId, companyId, 'tasks'))
    const now = new Date().toISOString()

    // Calculate due date with position-specific offset
    const dueDateOffset = assignment.customDueDateOffset || template.dueDateOffset
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + dueDateOffset)

    // Use position-specific priority if set
    const priority = assignment.customPriority || template.priority

    const taskDataToSave = {
      templateId: template.id,
      positionId,
      assignedUserId: userId,
      projectId: '',
      title: template.name,
      description: template.description + (assignment.customInstructions ? `\n\n${assignment.customInstructions}` : ''),
      priority,
      estimatedHours: template.estimatedHours,
      dueDate: dueDate.toISOString(),
      assignmentType: 'template_generated' as const,
      assignmentReason: `Generated from template: ${template.name} (${triggerType})`,
      assignedBy: 'system', // TODO: Get actual user ID
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

    // Save to Firestore
    const docRef = await addDoc(taskRef, taskDataToSave)
    const task: GeneratedTask = {
      ...taskDataToSave,
      id: docRef.id,
    }

    // Update template usage count
    await TaskTemplateService.updateTaskTemplate(companyId, template.id, {
      usageCount: template.usageCount + 1,
      lastUsedAt: now,
    }, groupId)

    // Update assignment count (use enterprise path to match rules)
    const effectiveGroupId = groupId || companyId
    const assignmentSegments = companySubcollectionPathSegments(effectiveGroupId, companyId, 'positionTaskTemplates')
    const assignmentRef = doc(db, assignmentSegments[0], ...assignmentSegments.slice(1), assignment.id)
    await updateDoc(assignmentRef, {
      assignmentCount: assignment.assignmentCount + 1,
      lastAssignedAt: now,
      updatedAt: now,
    })

    console.log(`Created task ${task.id} from template ${template.name}`)

    // Notify user and send push notification
    try {
      await TaskNotificationService.notifyTaskAssigned(companyId, userId, task)
      await sendTaskAssignedPushNotification(companyId, userId, task, false)
    } catch (error) {
      console.error('Error sending task assignment notifications:', error)
      // Don't fail task creation if notification fails
    }

    return task
  }

  // ============================================================================
  // MONITORING AND AUDIT
  // ============================================================================

  /**
   * Get task generation statistics for a position
   */
  static async getPositionTaskStats(
    companyId: string,
    positionId: string,
    groupId?: string
  ): Promise<{
    totalTemplates: number
    totalTasksGenerated: number
    pendingTasks: number
    completedTasks: number
    overdueTasks: number
    averageCompletionTime: number
  }> {
    try {
      // Get position template assignments
      const positionAssignments = await TaskTemplateService.getPositionTaskTemplates(
        companyId,
        positionId
      )

      // Get all generated tasks for this position
      const tasksQuery = query(
        collection(db, ...companyCollectionPathSegments(groupId || companyId, companyId, 'tasks')),
        where('positionId', '==', positionId)
      )

      const tasksSnapshot = await getDocs(tasksQuery)
      const allTasks = tasksSnapshot.docs.map(doc => doc.data())

      const pendingTasks = allTasks.filter(t => t.status === 'assigned' || t.status === 'in_progress').length
      const completedTasks = allTasks.filter(t => t.status === 'completed').length
      const overdueTasks = allTasks.filter(t => {
        const dueDate = new Date(t.dueDate)
        const now = new Date()
        return dueDate < now && t.status !== 'completed'
      }).length

      // Calculate average completion time
      const completedTasksWithTime = allTasks.filter(t =>
        t.status === 'completed' && t.startedAt && t.completedAt
      )
      const averageCompletionTime = completedTasksWithTime.length > 0
        ? completedTasksWithTime.reduce((sum, task) => {
          const start = new Date(task.startedAt)
          const end = new Date(task.completedAt)
          return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60) // hours
        }, 0) / completedTasksWithTime.length
        : 0

      return {
        totalTemplates: positionAssignments.length,
        totalTasksGenerated: allTasks.length,
        pendingTasks,
        completedTasks,
        overdueTasks,
        averageCompletionTime,
      }

    } catch (error) {
      console.error('Error getting position task stats:', error)
      throw error
    }
  }

  /**
   * Set up real-time monitoring for position assignments
   * This will automatically generate tasks when new assignments are created
   */
  static setupPositionAssignmentMonitoring(companyId: string, groupId?: string): () => void {
    console.log('Setting up position assignment monitoring')

    const assignmentsQuery = query(
      collection(db, ...companyCollectionPathSegments(groupId || companyId, companyId, 'positionAssignments')),
      where('status', '==', 'active')
    )

    const unsubscribe = onSnapshot(assignmentsQuery, async (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const assignment = change.doc.data()
          console.log(`New position assignment detected: ${assignment.userId} -> ${assignment.positionId}`)

          // Generate tasks for the new assignment
          try {
            await this.generateTasksOnPositionAssignment(
              companyId,
              assignment.positionId,
              assignment.userId,
              assignment.assignmentType
            )
          } catch (error) {
            console.error('Error generating tasks for new assignment:', error)
          }
        }
      })
    })

    return unsubscribe
  }
}
