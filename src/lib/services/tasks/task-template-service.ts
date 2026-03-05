// Task Template Management Service
// Handles CRUD operations for task templates and position assignments

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  Timestamp
} from 'firebase/firestore'
import { db } from '../../firebase'
import type {
  TaskTemplate,
  PositionTaskTemplate,
  GeneratedTask,
  TaskLibraryStats,
  TaskAssignmentCondition,
  TaskDoDItem,
  TaskEscalationRule
} from '@/types/task-template-schema'
import { ExternalNotificationService } from '../external-notifications/external-notification-service'
import { TaskNotificationService } from './task-notification-service'
import { generateProjectCode } from '../../utils/project-utils'
import { StarredItemsService } from '../starred-items/starred-items-service'
import { detectGhostForTask, updateTaskGhostInfo } from '../ghost-workflow-service'
import { companySubcollectionPathSegments } from '../../firestore-paths'
import { isSystemReporterApprovalLine } from '@/lib/constants/system-approval-lines'

/* -------------------------------------------------------------------------- */
/*                    DEPENDENCY VALIDATION TYPES                             */
/* -------------------------------------------------------------------------- */

/**
 * Result of dependency validation check
 */
export interface DependencyValidationResult {
  /** Whether the status change is allowed */
  canProceed: boolean
  /** Whether there are blocking dependencies (for soft enforcement) */
  hasBlockingDependencies: boolean
  /** List of blocking predecessor tasks */
  blockingTasks: Array<{
    id: string
    title: string
    status: string
    dependencyType: string
    requiredStatus: string // What status the predecessor needs to be in
  }>
  /** User-friendly warning message */
  warningMessage?: string
}

export class TaskTemplateService {

  // ============================================================================
  // TASK TEMPLATE CRUD OPERATIONS
  // ============================================================================

  /**
   * Create a new task template
   */
  static async createTaskTemplate(
    companyId: string,
    templateData: Omit<TaskTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'lastUsedAt'>,
    groupId?: string
  ): Promise<string> {
    try {
      const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'taskTemplates')
      const templateRef = collection(db, segments[0], ...segments.slice(1))
      const now = new Date().toISOString()

      const templateDataToSave = {
        ...templateData,
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
      }

      const docRef = await addDoc(templateRef, templateDataToSave)
      return docRef.id
    } catch (error) {
      console.error('Error creating task template:', error)
      throw error
    }
  }

  /**
   * Get all task templates for a company
   */
  static async getTaskTemplates(
    companyId: string,
    filters?: {
      department?: string
      positionLevel?: number
      isActive?: boolean
      isSystemTemplate?: boolean
    },
    groupId?: string
  ): Promise<TaskTemplate[]> {
    try {
      const pathSegments = companySubcollectionPathSegments(groupId || companyId, companyId, 'taskTemplates')
      const templateCollection = collection(db, pathSegments[0], ...pathSegments.slice(1))
      let q = query(templateCollection)


      if (filters?.department) {
        q = query(q, where('department', 'array-contains', filters.department))
      }
      if (filters?.positionLevel) {
        q = query(q, where('positionLevel', 'array-contains', filters.positionLevel))
      }
      if (filters?.isActive !== undefined) {
        q = query(q, where('isActive', '==', filters.isActive))
      }
      if (filters?.isSystemTemplate !== undefined) {
        q = query(q, where('isSystemTemplate', '==', filters.isSystemTemplate))
      }

      q = query(q, orderBy('name'))

      const snapshot = await getDocs(q)
      return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as TaskTemplate))
    } catch (error) {
      console.error('Error getting task templates:', error)
      // Return empty array if collection doesn't exist or there's an error
      return []
    }
  }

  /**
   * Get a specific task template
   */
  static async getTaskTemplate(companyId: string, templateId: string, groupId?: string): Promise<TaskTemplate | null> {
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'taskTemplates')
    const fullPath = [...segments, templateId]
    const templateRef = doc(db, fullPath[0], ...fullPath.slice(1))
    const templateSnap = await getDoc(templateRef)

    if (!templateSnap.exists()) {
      return null
    }

    return { id: templateSnap.id, ...(templateSnap.data() as any) } as TaskTemplate
  }

  /**
   * Update a task template
   */
  static async updateTaskTemplate(
    companyId: string,
    templateId: string,
    updates: Partial<TaskTemplate>,
    groupId?: string
  ): Promise<void> {
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'taskTemplates')
    const fullPath = [...segments, templateId]
    const templateRef = doc(db, fullPath[0], ...fullPath.slice(1))
    await updateDoc(templateRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    })
  }

  /**
   * Delete a task template
   */
  static async deleteTaskTemplate(companyId: string, templateId: string, groupId?: string): Promise<void> {
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'taskTemplates')
    const fullPath = [...segments, templateId]
    const templateRef = doc(db, fullPath[0], ...fullPath.slice(1))
    await deleteDoc(templateRef)
  }

  // ============================================================================
  // POSITION-TEMPLATE ASSIGNMENT OPERATIONS
  // ============================================================================

  /**
   * Assign a task template to a position
   */
  static async assignTemplateToPosition(
    companyId: string,
    positionId: string,
    templateId: string,
    assignmentConfig: {
      assignmentMode: 'immediate' | 'on_assignment' | 'scheduled' | 'conditional'
      assignmentDate?: string
      assignmentConditions?: TaskAssignmentCondition[]
      customDueDateOffset?: number
      customPriority?: 'low' | 'medium' | 'high' | 'urgent'
      customInstructions?: string
    },
    groupId?: string
  ): Promise<string> {
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'positionTaskTemplates')
    const assignmentRef = collection(db, segments[0], ...segments.slice(1))
    const now = new Date().toISOString()

    const assignmentDataToSave: any = {
      companyId,
      positionId,
      templateId,
      assignmentMode: assignmentConfig.assignmentMode,
      customPriority: assignmentConfig.customPriority,
      isActive: true,
      assignmentCount: 0,
      createdAt: now,
      updatedAt: now,
    }

    // Only include customInstructions if it's provided
    if (assignmentConfig.customInstructions) {
      assignmentDataToSave.customInstructions = assignmentConfig.customInstructions
    }

    // Only include assignmentDate if it's provided
    if (assignmentConfig.assignmentDate) {
      assignmentDataToSave.assignmentDate = assignmentConfig.assignmentDate
    }

    // Only include customDueDateOffset if it's provided
    if (assignmentConfig.customDueDateOffset !== undefined) {
      assignmentDataToSave.customDueDateOffset = assignmentConfig.customDueDateOffset
    }

    // Only include assignmentConditions if they're provided
    if (assignmentConfig.assignmentConditions) {
      assignmentDataToSave.assignmentConditions = assignmentConfig.assignmentConditions
    }

    const docRef = await addDoc(assignmentRef, assignmentDataToSave)
    return docRef.id
  }

  /**
   * Get task templates assigned to a position
   */
  static async getPositionTaskTemplates(
    companyId: string,
    positionId: string,
    groupId?: string
  ): Promise<PositionTaskTemplate[]> {
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'positionTaskTemplates')
    const q = query(
      collection(db, segments[0], ...segments.slice(1)),
      where('positionId', '==', positionId),
      where('isActive', '==', true)
    )

    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PositionTaskTemplate))
  }

  /**
   * Get all position assignments for a template
   */
  static async getTemplatePositionAssignments(
    companyId: string,
    templateId: string,
    groupId?: string
  ): Promise<PositionTaskTemplate[]> {
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'positionTaskTemplates')
    const q = query(
      collection(db, segments[0], ...segments.slice(1)),
      where('templateId', '==', templateId),
      where('isActive', '==', true)
    )

    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PositionTaskTemplate))
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
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'positionTaskTemplates')
    const q = query(
      collection(db, segments[0], ...segments.slice(1)),
      where('positionId', '==', positionId),
      where('templateId', '==', templateId)
    )

    const snapshot = await getDocs(q)
    const batch = snapshot.docs.map(doc => deleteDoc(doc.ref))
    await Promise.all(batch)
  }

  // ============================================================================
  // TASK GENERATION OPERATIONS
  // ============================================================================

  /**
   * Generate tasks from templates for a user's position
   */
  static async generateTasksForUser(
    companyId: string,
    userId: string,
    positionId: string,
    triggerType: 'login' | 'assignment' | 'scheduled' | 'manual'
  ): Promise<GeneratedTask[]> {
    const tasks: GeneratedTask[] = []

    // Get all active template assignments for this position
    const positionAssignments = await this.getPositionTaskTemplates(companyId, positionId)

    for (const assignment of positionAssignments) {
      // Check if task should be generated based on assignment mode
      const shouldGenerate = await this.shouldGenerateTask(assignment, triggerType)

      if (shouldGenerate) {
        const template = await this.getTaskTemplate(companyId, assignment.templateId)
        if (template) {
          const task = await this.createTaskFromTemplate(
            companyId,
            template,
            assignment,
            userId,
            positionId,
            triggerType
          )
          tasks.push(task)
        }
      }
    }

    return tasks
  }

  /**
   * Create a task from a template
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
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
    const taskRef = collection(db, segments[0], ...segments.slice(1))
    const now = new Date().toISOString()

    // Calculate due date
    const dueDateOffset = assignment.customDueDateOffset || template.dueDateOffset
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + dueDateOffset)

    // Fetch user profile for denormalization
    let assignedToName = 'Unknown User'
    try {
      const userPath = groupId && groupId !== companyId
        ? ['enterpriseGroups', groupId, 'users', userId]
        : ['companies', companyId, 'users', userId]
      const userSnap = await getDoc(doc(db, ...(userPath as any)))
      if (userSnap.exists()) {
        const userData = userSnap.data() as any
        assignedToName = userData.name || userData.displayName || 'Unknown User'
      }
    } catch (err) {
      console.warn(`[TaskTemplateService] Failed to fetch user profile for ${userId}:`, err)
    }

    // Create task data without the 'id' field (Firestore will auto-generate it)
    const taskDataToSave: any = {
      templateId: template.id,
      positionId,
      assignedUserId: userId,
      assignedTo: userId, // Map to assignedUserId for dashboard compatibility
      assignedToName, // Denormalized name for dashboard display
      projectId: (assignment as any).projectId || '',
      title: template.name,
      description: template.description,

      priority: assignment.customPriority || template.priority,
      estimatedHours: template.estimatedHours,
      dueDate: dueDate.toISOString(),
      assignmentType: 'template_generated' as const,
      assignmentReason: `Generated from template: ${template.name}`,
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

    // --- WORKFLOW INHERITANCE ---
    if (taskDataToSave.projectId) {
      try {
        const { ProjectWorkflowAssignmentService } = await import('../projects/project-workflow-assignment-service')
        const assignments = await ProjectWorkflowAssignmentService.getProjectAssignments(companyId, taskDataToSave.projectId, groupId)

        const approvalDef = assignments.find(a => a.type === 'approval_line' && a.isActive)
        const escalationDef = assignments.find(a => a.type === 'escalation_path' && a.isActive)

        // Only inherit approval line if not already set
        // Check for undefined specifically - empty string means "None" was chosen
        if (approvalDef?.workflowDefinitionId && taskDataToSave.workflowDefinitionId === undefined) {
          taskDataToSave.workflowDefinitionId = approvalDef.workflowDefinitionId
        }
        // Only inherit escalation policy if not already set
        // Check for undefined specifically - empty string means "None" was chosen
        if (escalationDef?.escalationPolicyId && taskDataToSave.escalationPolicyId === undefined) {
          taskDataToSave.escalationPolicyId = escalationDef.escalationPolicyId
        }
      } catch (err) {
        console.warn('[TaskTemplateService] Failed to inherit project workflows for template task:', err)
      }
    }

    const docRef = await addDoc(taskRef, taskDataToSave)

    // Return the task with the ID set
    const task: GeneratedTask = {
      id: docRef.id,
      ...taskDataToSave,
    }

    // Update template usage count
    await this.updateTaskTemplate(companyId, template.id, {
      usageCount: template.usageCount + 1,
      lastUsedAt: now,
    })

    // Update assignment count
    const pathSegmentsAssignments = companySubcollectionPathSegments(groupId || companyId, companyId, 'positionTaskTemplates')
    const fullPathAssignments = [...pathSegmentsAssignments, assignment.id]
    const assignmentRef = doc(db, fullPathAssignments[0], ...fullPathAssignments.slice(1))
    await updateDoc(assignmentRef, {
      assignmentCount: assignment.assignmentCount + 1,
      lastAssignedAt: now,
      updatedAt: now,
    })

    // ✅ GHOST DETECTION: Check if task has workflow issues
    if (task.workflowDefinitionId || task.escalationPolicyId) {
      try {
        const ghostResult = await detectGhostForTask(companyId, task, groupId ?? undefined)
        if (ghostResult.hasGhostIssue && ghostResult.ghostInfo) {
          await updateTaskGhostInfo(companyId, task.id, ghostResult.ghostInfo, groupId ?? undefined)
          task.hasGhostIssue = true
          task.ghostInfo = ghostResult.ghostInfo
        }
      } catch (ghostError) {
        console.error('[TaskTemplateService] Error detecting ghost issues:', ghostError)
      }
    }

    return task
  }

  /**
   * Check if a task should be generated based on assignment rules
   */
  private static async shouldGenerateTask(
    assignment: PositionTaskTemplate,
    triggerType: string
  ): Promise<boolean> {
    switch (assignment.assignmentMode) {
      case 'immediate':
        return triggerType === 'assignment'
      case 'on_assignment':
        return triggerType === 'assignment'
      case 'scheduled':
        return triggerType === 'scheduled' && !!assignment.assignmentDate
      case 'conditional':
        // TODO: Implement conditional logic based on assignmentConditions
        return true
      default:
        return false
    }
  }

  // ============================================================================
  // USER TASK OPERATIONS
  // ============================================================================

  /**
   * Get all tasks for a user
   * Returns tasks where user is either the assignee OR the reporter
   */
  static async getUserTasks(
    companyId: string,
    userId: string,
    groupId?: string,
    filters?: {
      status?: string
      priority?: string
    }
  ): Promise<GeneratedTask[]> {
    try {
      // Construct the correct collection reference based on tenant mode
      const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
      const tasksRef = collection(db, segments[0], ...segments.slice(1))

      const taskCollection = tasksRef;

      // Firestore doesn't support 'OR' queries across different fields well
      // Fetch both sets and merge/deduplicate
      const [assignedSnapshot, reportedSnapshot] = await Promise.all([
        getDocs(query(taskCollection, where('assignedUserId', '==', userId))),
        getDocs(query(taskCollection, where('reporter', '==', userId)))
      ]);

      const allTasksMap = new Map<string, GeneratedTask>();

      const processDocs = (snapshot: any) => {
        snapshot.docs.forEach((doc: any) => {
          const data = doc.data();
          // Apply manual filters since we can't easily filter in one query with these ORs
          let matches = true;
          if (filters?.status && data.status !== filters.status) matches = false;
          if (filters?.priority && data.priority !== filters.priority) matches = false;

          if (matches) {
            allTasksMap.set(doc.id, { id: doc.id, ...data } as GeneratedTask);
          }
        });
      };

      processDocs(assignedSnapshot);
      processDocs(reportedSnapshot);

      const tasks = Array.from(allTasksMap.values());

      // Fetch and inject Project Codes (SEQUENTIAL ID SUPPORT)
      try {
        const projectIds = Array.from(new Set(tasks.map(t => t.projectId).filter(Boolean)));
        const projectCodes = new Map<string, string>();

        // Fetch projects in parallel to get their codes (use same path as tasks for rule consistency)
        const projectPathSegments = companySubcollectionPathSegments(groupId || companyId, companyId, 'projects');
        await Promise.all(projectIds.map(async (pid) => {
          try {
            const pDoc = await getDoc(doc(db, ...projectPathSegments, pid));
            if (pDoc.exists()) {
              projectCodes.set(pid, (pDoc.data() as any).projectCode);
            }
          } catch (e) {
            console.warn(`Failed to fetch project ${pid} for task list`, e);
          }
        }));

        // Inject projectCode into tasks
        tasks.forEach(task => {
          if (task.projectId && projectCodes.has(task.projectId)) {
            task.projectCode = projectCodes.get(task.projectId);
          }
        });
      } catch (err) {
        console.error('Error hydrating project codes:', err);
      }

      // Sort by dueDate
      return tasks.sort((a, b) => {
        const dateA = new Date(a.dueDate || 0).getTime();
        const dateB = new Date(b.dueDate || 0).getTime();
        return dateA - dateB;
      });
    } catch (error) {
      console.error('Error getting user tasks:', error);
      return [];
    }
  }

  /**
   * Record that a user has seen a task.
   * Updates the lastSeenBy map in the task document.
   */
  static async recordTaskSeen(
    companyId: string,
    taskId: string,
    userId: string,
    groupId?: string
  ): Promise<void> {
    if (!companyId || !taskId || !userId) return;

    try {
      const pathSegments = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
      const taskRef = doc(db, ...pathSegments, taskId)

      const now = new Date().toISOString();

      // Use a map update to avoid overwriting other users' seen timestamps
      await updateDoc(taskRef, {
        [`lastSeenBy.${userId}`]: now,
      });
    } catch (error) {
      console.error('[TaskTemplateService] Error recording task seen:', error);
    }
  }

  /* ========================================================================
   * DEPENDENCY VALIDATION FOR STATUS CHANGES
   * ======================================================================== */

  /**
   * Validates if a task's dependencies allow a status change.
   *
   * Enforces dependency rules based on type:
   * - FS (Finish-to-Start): Predecessor must be COMPLETED before successor can START
   * - SS (Start-to-Start): Predecessor must be STARTED before successor can START
   * - FF (Finish-to-Finish): Predecessor must be COMPLETED before successor can be COMPLETED
   * - SF (Start-to-Finish): Predecessor must be STARTED before successor can be COMPLETED
   *
   * @param companyId - Company ID
   * @param taskId - Task to validate
   * @param newStatus - The status the task is changing TO
   * @returns Validation result with blocking tasks if any
   */
  static async validateDependenciesForStatusChange(
    companyId: string,
    taskId: string,
    newStatus: GeneratedTask['status'],
    groupId?: string
  ): Promise<DependencyValidationResult> {
    try {
      // Get the task
      const pathSegments = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
      const taskRef = doc(db, ...pathSegments, taskId)
      const taskSnap = await getDoc(taskRef)

      if (!taskSnap.exists()) {
        return { canProceed: true, hasBlockingDependencies: false, blockingTasks: [] }
      }

      const task = taskSnap.data() as GeneratedTask
      const dependencies = task.dependencies || []

      // No dependencies = no blocking
      if (dependencies.length === 0) {
        return { canProceed: true, hasBlockingDependencies: false, blockingTasks: [] }
      }

      const blockingTasks: DependencyValidationResult['blockingTasks'] = []

      // Check each dependency
      for (const dep of dependencies) {
        const segmentsD = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
        const fullPathD = [...segmentsD, dep.targetTaskId]
        const predRef = doc(db, fullPathD[0], ...fullPathD.slice(1))
        const predSnap = await getDoc(predRef)

        if (!predSnap.exists()) continue // Skip if predecessor not found

        const predecessor = predSnap.data() as GeneratedTask
        const depType = (dep.type || 'FS').toUpperCase()

        let isBlocking = false
        let requiredStatus = ''

        // Check based on dependency type and the status we're trying to change TO
        switch (depType) {
          case 'FS': // Finish-to-Start
            // Predecessor must be COMPLETED before successor can START (in_progress)
            if (newStatus === 'in_progress' && predecessor.status !== 'completed') {
              isBlocking = true
              requiredStatus = 'completed'
            }
            break

          case 'SS': // Start-to-Start
            // Predecessor must be STARTED (in_progress or completed) before successor can START
            if (newStatus === 'in_progress' &&
              predecessor.status !== 'in_progress' &&
              predecessor.status !== 'completed') {
              isBlocking = true
              requiredStatus = 'in_progress (started)'
            }
            break

          case 'FF': // Finish-to-Finish
            // Predecessor must be COMPLETED before successor can be COMPLETED
            if (newStatus === 'completed' && predecessor.status !== 'completed') {
              isBlocking = true
              requiredStatus = 'completed'
            }
            break

          case 'SF': // Start-to-Finish
            // Predecessor must be STARTED before successor can be COMPLETED
            if (newStatus === 'completed' &&
              predecessor.status !== 'in_progress' &&
              predecessor.status !== 'completed') {
              isBlocking = true
              requiredStatus = 'in_progress (started)'
            }
            break
        }

        if (isBlocking) {
          blockingTasks.push({
            id: predecessor.id || dep.targetTaskId,
            title: predecessor.title || 'Unknown Task',
            status: predecessor.status,
            dependencyType: depType,
            requiredStatus
          })
        }
      }

      // Build warning message if there are blocking tasks
      let warningMessage: string | undefined
      if (blockingTasks.length > 0) {
        const taskList = blockingTasks
          .map(t => `• "${t.title}" (${t.dependencyType} dependency) - needs to be ${t.requiredStatus}, currently ${t.status}`)
          .join('\n')

        warningMessage = `This task has dependencies that are not yet satisfied:\n\n${taskList}\n\nProceeding may cause scheduling conflicts.`
      }

      return {
        canProceed: true, // Soft enforcement - always allow but warn
        hasBlockingDependencies: blockingTasks.length > 0,
        blockingTasks,
        warningMessage
      }
    } catch (error) {
      console.error('[TaskTemplateService] Error validating dependencies:', error)
      // On error, allow proceeding (fail open for soft enforcement)
      return { canProceed: true, hasBlockingDependencies: false, blockingTasks: [] }
    }
  }

  /**
   * Update task status
   * If the task is linked to a workflow and is being completed,
   * this will queue a COMPLETE_TASK event to advance the workflow
   *
   * @param skipDependencyCheck - If true, skips dependency validation (use after user confirms override)
   */
  static async updateTaskStatus(
    companyId: string,
    taskId: string,
    status: GeneratedTask['status'],
    updates?: Partial<GeneratedTask>,
    actorId?: string,
    skipDependencyCheck?: boolean,
    groupId?: string
  ): Promise<void> {
    if (!taskId || !companyId) {
      throw new Error('Cannot update task: missing task ID or company ID')
    }

    // Construct the correct collection reference based on tenant mode
    const segmentsS = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
    const fullPathS = [...segmentsS, taskId]
    const taskRef = doc(db, fullPathS[0], ...fullPathS.slice(1))

    const now = new Date().toISOString()

    const taskSnap = await getDoc(taskRef)
    if (!taskSnap.exists()) {
      throw new Error(`Task not found: ${taskId}`)
    }
    const currentTask = taskSnap.data() as GeneratedTask
    const previousStatus = currentTask.status

    // Status change restriction: Check if task needs to be started first
    // Only allow changing to 'in_progress' from 'assigned'; other changes require task to be started
    if (status !== 'in_progress' && status !== 'assigned' && previousStatus === 'assigned') {
      throw new Error('Cannot change status: Please start the task first by clicking "Start Task"')
    }

    // ═══════════════════════════════════════════════════════════════════════
    // REPORTER APPROVAL STATUS RESTRICTIONS
    // ═══════════════════════════════════════════════════════════════════════
    const hasReporterApproval = isSystemReporterApprovalLine(currentTask.workflowDefinitionId) ||
      currentTask.requiresReporterApproval === true

    // Skip validation if status is not actually changing
    const isStatusChanging = status !== previousStatus

    // RULE 1: Block direct completion if reporter approval is required
    if (isStatusChanging && status === 'completed' && hasReporterApproval && previousStatus !== 'approval_required') {
      throw new Error('Tasks with Reporter Approval cannot be directly completed. Please change status to "Approval Required" first.')
    }

    // RULE 2: approval_required status can only come from in_progress
    if (isStatusChanging && status === 'approval_required') {
      if (!hasReporterApproval) {
        throw new Error('Approval Required status is only available for tasks with Reporter Approval line selected.')
      }
      if (previousStatus !== 'in_progress') {
        throw new Error('Task must be in progress before submitting for approval.')
      }
    }

    const updateData: Partial<GeneratedTask> = {
      status,
      updatedAt: now,
      ...Object.fromEntries(
        Object.entries(updates || {}).filter(([_, v]) => v !== undefined)
      ),
    } as any

    // Ensure assignedTo and assignedUserId are always in sync in backend
    let isReassigned = false
    let newAssigneeId = ''

    if (updates?.assignedUserId && updates.assignedUserId !== currentTask.assignedUserId) {
      updateData.assignedTo = updates.assignedUserId
      isReassigned = true
      newAssigneeId = updates.assignedUserId
    } else if (updates?.assignedTo && (updates.assignedTo as string) !== currentTask.assignedUserId) {
      updateData.assignedUserId = updates.assignedTo as string
      isReassigned = true
      newAssigneeId = updates.assignedTo as string
    }

    // If reassigned, resolve new assignee name for denormalization and notifications
    let newAssigneeName = ''
    if (isReassigned && newAssigneeId) {
      try {
        const userPath = groupId && groupId !== companyId
          ? ['enterpriseGroups', groupId, 'users', newAssigneeId]
          : ['companies', companyId, 'users', newAssigneeId]
        const userSnap = await getDoc(doc(db, ...(userPath as any)))
        if (userSnap.exists()) {
          const userData = userSnap.data() as any
          newAssigneeName = userData.name || userData.displayName || 'Unknown User'
          updateData.assignedToName = newAssigneeName
        }
      } catch (err) {
        console.warn(`[TaskTemplateService] Failed to fetch new assignee name for ${newAssigneeId}:`, err)
      }
    }

    // Resolve reporterName when reporter is updated (denormalized for list/detail display)
    if (updates && 'reporter' in updates) {
      const reporterId = updates.reporter
      if (!reporterId || typeof reporterId !== 'string' || reporterId.trim() === '') {
        updateData.reporterName = undefined
      } else {
        const userPath = groupId && groupId !== companyId
          ? ['enterpriseGroups', groupId, 'users', reporterId]
          : ['companies', companyId, 'users', reporterId]
        const reporterSnap = await getDoc(doc(db, ...(userPath as any)))
        if (reporterSnap.exists()) {
          const reporterData = reporterSnap.data() as any
          updateData.reporterName = reporterData.name || reporterData.displayName || 'Unknown'
        } else {
          updateData.reporterName = 'Unknown'
        }
      }
    }

    // Set completion timestamp if task is completed
    if (status === 'completed' && !updates?.completedAt) {
      updateData.completedAt = now
    }

    // Set actual end date if task is completed
    if (status === 'completed' && !updates?.actualEndDate) {
      updateData.actualEndDate = now
    }

    // Set start timestamp if task is started
    if (status === 'in_progress' && !updates?.startedAt) {
      updateData.startedAt = now
    }

    // Set actual start date if task is started
    if (status === 'in_progress' && !updates?.actualStartDate) {
      updateData.actualStartDate = now
    }

    // ═══════════════════════════════════════════════════════════════════════
    // REPORTER APPROVAL: Handle approval_required status
    // ═══════════════════════════════════════════════════════════════════════
    if (status === 'approval_required' && hasReporterApproval) {
      updateData.reporterApprovalStatus = 'pending'
      // Clear previous rejection comments on resubmission
      if (currentTask.reporterApprovalStatus === 'rejected') {
        (updateData as any).reporterRejectionComments = deleteField()
      }
    }

    await updateDoc(taskRef, updateData)

    // Trigger Notification for Reassignment
    if (isReassigned && newAssigneeId) {
      try {
        await ExternalNotificationService.notifyTaskReassigned(
          companyId,
          newAssigneeId,
          currentTask.title || 'Untitled Task',
          currentTask.assignedToName || 'Previous Member',
          newAssigneeName || 'You',
          currentTask.projectId,
          taskId,
          groupId
        )
      } catch (notifError) {
        console.error('[TaskTemplateService] Failed to trigger reassignment notification:', notifError)
      }
    }

    // --- WORKFLOW & ESCALATION INTEGRATION ---
    try {
      // 1. Reporter Approval Integration (NEW)
      // Trigger when status changes to approval_required
      if (status === 'approval_required' && hasReporterApproval && previousStatus !== 'approval_required') {
        const { TaskApprovalService } = await import('./task-approval-service');
        await TaskApprovalService.triggerReporterApproval(companyId, taskId, actorId || 'system', groupId ?? undefined);
        console.log(`[TaskTemplateService] Reporter approval triggered for task ${taskId}`);
      }

      // 2. Standard Approval Integration (existing multi-stage approval lines)
      // Only trigger if status is changing TO completed AND no reporter approval
      if (status === 'completed' && !hasReporterApproval && (previousStatus !== 'completed' || updates?.status === 'completed')) {
        const { TaskApprovalService } = await import('./task-approval-service');
        await TaskApprovalService.triggerDirectApproval(companyId, taskId, actorId || 'system', groupId ?? undefined);
      }

      // 3. Escalation Integration
      const { TaskEscalationService } = await import('./task-escalation-service');
      if (status === 'in_progress') {
        await TaskEscalationService.registerForEscalation(companyId, taskId, groupId);
      } else if (status === 'completed' || status === 'cancelled') {
        await TaskEscalationService.cancelEscalation(companyId, taskId, groupId);
      }
    } catch (err) {
      console.error('[TaskTemplateService] Error in approval/escalation integration:', err);
    }

    // Log Activity
    if (actorId) {
      try {
        const { ActivityService } = await import('../activity-service');

        // We need the title for the log. If not in updates, fetch it.
        let taskTitle = updates?.title;
        if (!taskTitle) {
          const taskSnap = await getDoc(taskRef);
          taskTitle = taskSnap.exists() ? (taskSnap.data() as GeneratedTask).title : 'Task';
        }

        await ActivityService.logActivity(groupId || companyId, companyId, {
          actorId,
          type: status === 'completed' ? 'task_completed' : 'task_updated',
          entityId: taskId,
          entityType: 'task',
          entityName: taskTitle || 'Task',
          recipientId: updates?.assignedUserId // If reassigned captures the new assignee
        });
      } catch (err) {
        console.error('Failed to log task update activity:', err);
      }
    }

    // --- TASK ACTIVITY TIMELINE LOGGING (fire-and-forget) ---
    // Log lifecycle events to taskActivities collection for the Activity tab
    if (actorId) {
      void (async () => {
        try {
          // Resolve actor name from Firestore
          let actorName = 'Unknown User'
          try {
            const userPath = groupId && groupId !== companyId
              ? ['enterpriseGroups', groupId, 'users', actorId]
              : ['companies', companyId, 'users', actorId]
            const userSnap = await getDoc(doc(db, ...(userPath as [string, ...string[]])))
            if (userSnap.exists()) {
              const userData = userSnap.data() as { name?: string; displayName?: string }
              actorName = userData.name || userData.displayName || 'Unknown User'
            }
          } catch (e) {
            console.warn('[TaskActivity] Failed to resolve actor name:', e)
          }

          const projectId = currentTask.projectId || ''

          // Log status change if status actually changed
          if (status !== previousStatus) {
            const { logStatusChanged } = await import('../task-activity-service')
            await logStatusChanged(companyId, taskId, projectId, previousStatus, status, actorId, actorName, groupId)
          }
        } catch (e) {
          console.error('[TaskActivity] Failed to log lifecycle event:', e)
        }
      })()
    }

    // --- NOTIFICATION TRIGGERS ---
    try {
      if (status === 'completed') {
        const taskDoc = await getDoc(taskRef);
        if (taskDoc.exists()) {
          const taskData = taskDoc.data() as GeneratedTask;

          // Notify the Reporter (assignedBy or explicit reporter)
          const reporterId = taskData.reporter || taskData.assignedBy;

          // Don't notify if user is completing their own self-assigned task (unless configured otherwise)
          // But usually reporter wants to know even if they assigned it.
          // Let's notify if reporter exists.
          if (reporterId) {
            await ExternalNotificationService.notifyTaskCompleted(
              companyId,
              reporterId,
              taskData.title || 'Task',
              'the assignee', // completerName not easily available here
              taskData.projectId,
              taskId,
              groupId ?? undefined
            );
          }
        }
      }
    } catch (notifError) {
      console.error('[TaskTemplateService] Failed to trigger completion notification:', notifError);
    }
  }

  /**
   * Update task progress
   */
  static async updateTaskProgress(
    companyId: string,
    taskId: string,
    progress: number,
    notes?: string,
    groupId?: string
  ): Promise<void> {
    if (!taskId || !companyId) {
      throw new Error('Cannot update task progress: missing task ID or company ID')
    }

    // Construct the correct collection reference based on tenant mode
    const pathSegments = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks') as any
    const taskRef = doc(db, ...pathSegments, taskId)
    await updateDoc(taskRef, {
      progress,
      completionNotes: notes,
      updatedAt: new Date().toISOString(),
    })
  }

  /**
   * Batch-update the boardOrder field for multiple tasks within a column.
   * Used by the Kanban board after vertical drag-and-drop reordering.
   */
  static async updateBoardOrder(
    companyId: string,
    updates: Array<{ id: string; boardOrder: number }>,
    groupId?: string
  ): Promise<void> {
    if (!companyId || !updates.length) return

    try {
      const { writeBatch } = await import('firebase/firestore')
      const batch = writeBatch(db)
      const pathSegments = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')

      updates.forEach(({ id, boardOrder }) => {
        const ref = doc(db, ...(pathSegments as any), id)
        batch.update(ref, {
          boardOrder,
          updatedAt: new Date().toISOString(),
        })
      })

      await batch.commit()
    } catch (err) {
      console.error('[TaskTemplateService] Failed to update board order:', err)
      throw err
    }
  }

  /**
   * Update multiple task dates (Batch Operation)
   * Used by WBS Algorithm to persist schedule changes
   * 
   * Syncs dueDate with endDate to ensure consistency between WBS Gantt and task page displays.
   */
  static async updateMultipleTaskDates(
    companyId: string,
    updates: Array<{ id: string, startDate?: string, endDate?: string, dueDate?: string, dependencies?: GeneratedTask['dependencies'] }>,
    groupId?: string
  ): Promise<void> {
    try {
      const chunks = [];
      const batchSize = 400; // Safety margin
      for (let i = 0; i < updates.length; i += batchSize) {
        chunks.push(updates.slice(i, i + batchSize));
      }

      for (const chunk of chunks) {
        const { writeBatch } = await import('firebase/firestore');
        const batch = writeBatch(db);

        const pathSegmentsM = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
        chunk.forEach(update => {
          const ref = doc(db, ...(pathSegmentsM as any), update.id);
          const data: any = { updatedAt: new Date().toISOString() };
          if (update.startDate) data.startDate = update.startDate;
          if (update.endDate) {
            data.endDate = update.endDate;
            // Sync dueDate with endDate for consistency (unless dueDate is explicitly provided)
            if (update.dueDate !== undefined) {
              data.dueDate = update.dueDate;
            } else {
              data.dueDate = update.endDate;
            }
          } else if (update.dueDate !== undefined) {
            // If only dueDate is provided, use it
            data.dueDate = update.dueDate;
          }
          if (update.dependencies) data.dependencies = update.dependencies;

          batch.update(ref, data);
        });

        await batch.commit();
      }
    } catch (err) {
      console.error('Failed to batch update tasks:', err);
      throw err;
    }
  }

  /**
   * Get a single task by ID
   */
  static async getTask(
    companyId: string,
    taskId: string,
    groupId?: string
  ): Promise<GeneratedTask | null> {
    if (!companyId || !taskId) return null

    // Construct the correct collection reference based on tenant mode
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
    const fullPath = [...segments, taskId]
    const taskRef = doc(db, fullPath[0], ...fullPath.slice(1))

    const snapshot = await getDoc(taskRef)
    if (!snapshot.exists()) return null

    return { id: snapshot.id, ...(snapshot.data() as any) } as GeneratedTask
  }

  /**
   * Get multiple tasks by their IDs
   */
  static async getTasksByIds(
    companyId: string,
    taskIds: string[],
    groupId?: string
  ): Promise<GeneratedTask[]> {
    if (!companyId || !taskIds.length) return []

    try {
      // Fetch all tasks in parallel
      const taskPromises = taskIds.map(id => this.getTask(companyId, id, groupId))
      const tasks = await Promise.all(taskPromises)

      // Filter out nulls and return
      return tasks.filter((t): t is GeneratedTask => t !== null)
    } catch (error) {
      console.error('Error fetching tasks by IDs:', error)
      return []
    }
  }

  /**
   * Get all tasks for a given project (regardless of assignee)
   */
  static async getProjectTasks(
    companyId: string,
    projectId: string,
    groupId?: string,
    filters?: {
      status?: GeneratedTask['status']
      priority?: GeneratedTask['priority']
    }
  ): Promise<GeneratedTask[]> {
    if (!companyId || !projectId) return []

    // Construct the correct collection reference based on tenant mode
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
    const tasksRef = collection(db, segments[0], ...segments.slice(1))

    let q = query(
      tasksRef,
      where('projectId', '==', projectId)
    )

    if (filters?.status) {
      q = query(q, where('status', '==', filters.status))
    }
    if (filters?.priority) {
      q = query(q, where('priority', '==', filters.priority))
    }


    q = query(q, orderBy('createdAt', 'desc'))

    const snapshot = await getDocs(q)
    const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as GeneratedTask))

    // Enrich tasks with projectCode if missing (for older tasks)
    try {
      const projectSegments = companySubcollectionPathSegments(groupId || companyId, companyId, 'projects')
      const projectRef = doc(db, ...projectSegments, projectId)
      const projectSnap = await getDoc(projectRef)
      if (projectSnap.exists()) {
        const projectData = projectSnap.data() as any
        const projectCode = projectData.projectCode || generateProjectCode(projectData.name || '')
        tasks.forEach(task => {
          if (!task.projectCode) {
            task.projectCode = projectCode
          }
        })
      }
    } catch (err) {
      console.warn('[TaskTemplateService] Could not enrich projectCode:', err)
    }

    // Enrich reporterName when missing; use reporter → assignedBy → assignedUserId (assignee) as fallback
    const effectiveReporterId = (t: GeneratedTask) =>
      (t.reporter && String(t.reporter).trim()) ||
      (t.assignedBy && String(t.assignedBy).trim()) ||
      (t.assignedUserId && String(t.assignedUserId).trim()) ||
      ''
    const reporterIdsToResolve = [...new Set(
      tasks
        .filter(t => effectiveReporterId(t) && (!t.reporterName || t.reporterName.trim() === ''))
        .map(t => effectiveReporterId(t))
    )].filter(Boolean) as any
    if (reporterIdsToResolve.length > 0) {
      const reporterNamesMap = new Map<string, string>()
      await Promise.all(
        reporterIdsToResolve.map(async (reporterId: string) => {
          try {
            const userSnap = await getDoc(doc(db, 'companies', companyId, 'users', reporterId))
            if (userSnap.exists()) {
              const d = userSnap.data()
              reporterNamesMap.set(reporterId, d.name || d.displayName || 'Unknown')
              return
            }
            // Reporter ID might be a position ID (e.g. from import); resolve position holder's name
            try {
              const { getCurrentAssignments } = await import('../org/org-services')
              const assignments = await getCurrentAssignments(companyId, reporterId)
              const firstUserId = assignments[0]?.userId
              if (firstUserId) {
                const userPath = groupId && groupId !== companyId
                  ? ['enterpriseGroups', groupId, 'users', firstUserId]
                  : ['companies', companyId, 'users', firstUserId]
                const holderSnap = await getDoc(doc(db, ...userPath as any))
                if (holderSnap.exists()) {
                  const h = holderSnap.data() as any
                  reporterNamesMap.set(reporterId, h.name || h.displayName || 'Unknown')
                  return
                }
              }
            } catch {
              // ignore position resolution failure
            }
            reporterNamesMap.set(reporterId, 'Unknown')
          } catch {
            reporterNamesMap.set(reporterId, 'Unknown')
          }
        })
      )
      tasks.forEach(task => {
        const needReporterName = !task.reporterName || task.reporterName.trim() === ''
        const effectiveId = effectiveReporterId(task)
        if (effectiveId && needReporterName) {
          task.reporterName = reporterNamesMap.get(effectiveId) || 'Unknown'
          // So list/UI can show reporter: use creator/assignee when reporter was never set
          if (!task.reporter || String(task.reporter).trim() === '') {
            task.reporter = task.assignedBy || task.assignedUserId
          }
        }
      })
    }

    return tasks
  }

  /**
   * Get all milestones for a project
   */
  static async getProjectMilestones(
    companyId: string,
    projectId: string,
    groupId?: string
  ): Promise<GeneratedTask[]> {
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
    const q = query(
      collection(db, segments[0], ...segments.slice(1)),
      where('projectId', '==', projectId),
      where('isMilestone', '==', true),
      orderBy('targetDate', 'asc')
    )

    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as GeneratedTask))
  }

  // ============================================================================
  // SEQUENTIAL TASK ID GENERATION
  // ============================================================================

  /**
   * Get the next sequential task number for a project.
   * Uses Firestore transaction to ensure atomic increment - no duplicates even with concurrent requests.
   * Both parent tasks and subtasks share the same counter (PA-1, PA-2, PA-3...)
   */
  private static async getNextTaskNumber(
    companyId: string,
    projectId: string,
    groupId?: string | null
  ): Promise<number> {
    try {
      const collectionPath = companySubcollectionPathSegments(groupId || companyId, companyId, 'projects')
      const projectRef = doc(db, ...collectionPath, projectId)

      return await runTransaction(db, async (transaction) => {
        const projectSnap = await transaction.get(projectRef)

        if (!projectSnap.exists()) {
          console.warn(`Project ${projectId} not found, using fallback counter`)
          return Date.now() % 100000 // Fallback to timestamp-based number
        }

        const projectData = projectSnap.data() as any
        const currentCounter = projectData?.taskCounter || 0
        const nextNumber = currentCounter + 1

        // Atomically update the counter
        transaction.update(projectRef, {
          taskCounter: nextNumber,
          updatedAt: new Date().toISOString()
        })

        return nextNumber
      })
    } catch (error: any) {
      if (error?.code === 'permission-denied') {
        console.error('[TaskTemplateService] Permission denied while incrementing task counter. Ensure user has update access to the project document.', error)
        throw new Error('Missing or insufficient permissions to generate sequential task ID. Please contact your administrator.')
      }
      console.error('Error getting next task number:', error)
      throw error
    }
  }

  /**
   * Create a manual task.
   * When groupId is provided, task is created under enterpriseGroups/{groupId}/companies/{companyId}/tasks.
   */
  static async createManualTask(
    companyId: string,
    userId: string,
    taskData: {
      title: string
      description: string
      priority: GeneratedTask['priority']
      estimatedHours: number
      dueDate: string
      startDate?: string  // Optional start date for multi-day tasks
      endDate?: string    // Optional end date (defaults to dueDate if not provided)
      projectId: string
      assignee?: string
      assignedBy?: string
      positionId?: string
      assignedPositionId?: string
      assignedToName?: string
      reporter?: string
      reporterName?: string
      reporterPositionId?: string
      parentTaskId?: string
      orgUnitId?: string
      orgUnitName?: string
      team?: string
      taskType?: string
      requirementType?: string
      workflowId?: string
      workflowDefinitionId?: string
      escalationPolicyId?: string
      // New WBS Fields
      isMilestone?: boolean
      targetDate?: string
      dependencies?: GeneratedTask['dependencies']
    },
    groupId?: string | null
  ): Promise<GeneratedTask> {
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
    const taskCollectionRef = collection(db, segments[0], ...segments.slice(1))
    const now = new Date().toISOString()

    // Get the next sequential task number (same counter for tasks and subtasks)
    const taskNumber = await this.getNextTaskNumber(companyId, taskData.projectId, groupId)

    // Fetch user profile for denormalization
    const assigneeId = (taskData.assignee && taskData.assignee.trim().length > 0)
      ? taskData.assignee
      : userId

    let assignedToName = taskData.assignedToName || 'Unknown User'

    // Only fetch name if not provided by frontend (which provides combined format)
    if (!taskData.assignedToName) {
      try {
        const userRef = groupId
          ? doc(db, 'enterpriseGroups', groupId, 'users', assigneeId)
          : doc(db, 'companies', companyId, 'users', assigneeId)
        const userSnap = await getDoc(userRef)
        if (userSnap.exists()) {
          const userData = userSnap.data()
          assignedToName = userData.name || userData.displayName || 'Unknown User'
        }
      } catch (err) {
        console.warn(`[TaskTemplateService] Failed to fetch user profile for ${assigneeId}:`, err)
      }
    }

    // ✅ CRITICAL FIX: Resolve positionId from assignee's active position assignment
    // This is essential for approval line hierarchy resolution
    let resolvedPositionId = taskData.positionId || taskData.assignedPositionId || ''

    if (!resolvedPositionId) {
      console.log(`[TaskTemplateService] No positionId provided for manual task. Resolving from assignee ${assigneeId}...`)
      try {
        const { getCurrentAssignmentForUser } = await import('../org/org-services')
        const assignment = await getCurrentAssignmentForUser(companyId, assigneeId, groupId || undefined)
        if (assignment) {
          resolvedPositionId = assignment.positionId
          console.log(`[TaskTemplateService] ✓ Resolved positionId ${resolvedPositionId} for assignee ${assigneeId}`)
        } else {
          console.warn(`[TaskTemplateService] ⚠ No active position assignment found for assignee ${assigneeId}. Task will have empty positionId.`)
        }
      } catch (err) {
        console.error(`[TaskTemplateService] Error resolving position for assignee ${assigneeId}:`, err)
      }
    }

    // Create task data without the 'id' field (Firestore will auto-generate it)
    const taskDataToSave: Omit<GeneratedTask, 'id'> = {
      taskNumber, // ✅ Sequential task number for display (PA-1, PA-2, etc.)
      templateId: 'manual',
      positionId: resolvedPositionId,
      assignedPositionId: taskData.assignedPositionId || resolvedPositionId, // For display
      // Use explicit assignee if provided, otherwise fall back to the current user
      assignedUserId: assigneeId,
      assignedTo: assigneeId, // Map to assignedUserId for dashboard compatibility
      assignedToName, // Denormalized name for dashboard display
      projectId: taskData.projectId,
      title: taskData.title,
      description: taskData.description,

      priority: taskData.priority,
      estimatedHours: taskData.estimatedHours,
      dueDate: taskData.dueDate,
      assignmentType: 'manual' as const,
      assignmentReason: 'Manually created task',
      assignedBy: taskData.assignedBy || userId,
      status: 'assigned' as const,
      progress: 0,
      definitionOfDone: [],
      workflowId: taskData.workflowId || '',
      workflowDefinitionId: taskData.workflowDefinitionId || '',
      escalationPolicyId: taskData.escalationPolicyId || '',
      createdAt: now,
      updatedAt: now,
    }

    if (typeof taskData.reporter === 'string' && taskData.reporter.trim().length > 0) {
      taskDataToSave.reporter = taskData.reporter
      if (taskData.reporterPositionId) {
        taskDataToSave.reporterPositionId = taskData.reporterPositionId
      }
      // Resolve reporter display name for list/detail (denormalized like assignedToName)
      let reporterName = taskData.reporterName
      if (!reporterName) {
        try {
          const reporterRef = groupId
            ? doc(db, 'enterpriseGroups', groupId, 'users', taskData.reporter)
            : doc(db, 'companies', companyId, 'users', taskData.reporter)
          const reporterSnap = await getDoc(reporterRef)
          if (reporterSnap.exists()) {
            const reporterData = reporterSnap.data()
            reporterName = reporterData.name || reporterData.displayName || 'Unknown'
          } else {
            reporterName = 'Unknown'
          }
        } catch (err) {
          console.warn(`[TaskTemplateService] Failed to fetch reporter profile for ${taskData.reporter}:`, err)
          reporterName = 'Unknown'
        }
      }
      taskDataToSave.reporterName = reporterName
    } else {
      // Default reporter to creator so every task has a reporter (avoids "Unknown" in list)
      const creatorId = taskData.assignedBy || userId
      taskDataToSave.reporter = creatorId
      let creatorName = 'Unknown'
      try {
        const creatorRef = groupId
          ? doc(db, 'enterpriseGroups', groupId, 'users', creatorId)
          : doc(db, 'companies', companyId, 'users', creatorId)
        const creatorSnap = await getDoc(creatorRef)
        if (creatorSnap.exists()) {
          const d = creatorSnap.data()
          creatorName = d.name || d.displayName || 'Unknown'
        }
      } catch (err) {
        console.warn(`[TaskTemplateService] Failed to fetch creator profile for reporter:`, err)
      }
      taskDataToSave.reporterName = creatorName
    }

    if (typeof taskData.parentTaskId === 'string' && taskData.parentTaskId.trim().length > 0) {
      taskDataToSave.parentTaskId = taskData.parentTaskId
    }

    if (typeof taskData.orgUnitId === 'string' && taskData.orgUnitId.trim().length > 0) {
      taskDataToSave.orgUnitId = taskData.orgUnitId
    }

    if (typeof taskData.orgUnitName === 'string' && taskData.orgUnitName.trim().length > 0) {
      taskDataToSave.orgUnitName = taskData.orgUnitName
    }

    if (taskData.team) taskDataToSave.team = taskData.team
    if (taskData.taskType) taskDataToSave.taskType = taskData.taskType
    if (taskData.requirementType) taskDataToSave.requirementType = taskData.requirementType

    // WBS GANTT FIELDS (Optional)
    if (taskData.isMilestone) {
      taskDataToSave.isMilestone = true
      taskDataToSave.estimatedHours = 0
      if (taskData.targetDate) {
        taskDataToSave.targetDate = taskData.targetDate
        taskDataToSave.startDate = taskData.targetDate
        taskDataToSave.endDate = taskData.targetDate
      }
    } else {
      if (taskData.startDate) taskDataToSave.startDate = taskData.startDate
      if (taskData.endDate) taskDataToSave.endDate = taskData.endDate
    }

    if (taskData.dependencies && taskData.dependencies.length > 0) {
      taskDataToSave.dependencies = taskData.dependencies
    }

    // Start Date - Optional: For multi-day tasks in Timeline/Calendar
    if (typeof taskData.startDate === 'string' && taskData.startDate.trim().length > 0) {
      taskDataToSave.startDate = taskData.startDate
    }

    // End Date - Optional: Defaults to dueDate if startDate is set but endDate is not
    if (typeof taskData.endDate === 'string' && taskData.endDate.trim().length > 0) {
      taskDataToSave.endDate = taskData.endDate
    } else if (taskDataToSave.startDate) {
      // If startDate is set but endDate is not, default endDate to dueDate
      taskDataToSave.endDate = taskData.dueDate
    }

    // ✅ CRITICAL FIX: Fetch project to get projectCode for storage and display
    let projectCode: string | undefined
    try {
      // Use companySubcollectionPathSegments helper to ensure correct path structure
      // This handles both enterprise groups and legacy single-tenant paths
      const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'projects')
      const projectRef = doc(db, segments[0], ...segments.slice(1), taskData.projectId)
      const projectSnap = await getDoc(projectRef)
      if (projectSnap.exists()) {
        const projectData = projectSnap.data() as any
        // Get project code from project, or derive using smart logic
        projectCode = projectData.projectCode || generateProjectCode(projectData.name || '')
      }
    } catch (error) {
      console.error('Failed to fetch project for projectCode:', error)
      // Fallback to 'TASK' if project fetch fails
      projectCode = 'TASK'
    }

    // Include projectCode in the document stored in Firestore
    const taskDataToSaveWithCode = {
      ...taskDataToSave,
      projectCode: projectCode || 'TASK',
    }

    // --- WORKFLOW INHERITANCE ---
    try {
      const { ProjectWorkflowAssignmentService } = await import('../projects/project-workflow-assignment-service')
      const assignments = await ProjectWorkflowAssignmentService.getProjectAssignments(companyId, taskData.projectId, groupId ?? undefined)

      const approvalDef = assignments.find(a => a.type === 'approval_line' && a.isActive)
      const escalationDef = assignments.find(a => a.type === 'escalation_path' && a.isActive)

      // Only inherit approval line if user didn't explicitly set one
      // Check for undefined specifically - empty string means user chose "None"
      if (approvalDef?.workflowDefinitionId && taskDataToSaveWithCode.workflowDefinitionId === undefined) {
        taskDataToSaveWithCode.workflowDefinitionId = approvalDef.workflowDefinitionId
      }
      // Only inherit escalation policy if user didn't explicitly set one
      // Check for undefined specifically - empty string means user chose "None"
      if (escalationDef?.escalationPolicyId && taskDataToSaveWithCode.escalationPolicyId === undefined) {
        taskDataToSaveWithCode.escalationPolicyId = escalationDef.escalationPolicyId
      }
    } catch (err) {
      console.warn('[TaskTemplateService] Failed to inherit project workflows:', err)
    }

    // ═══════════════════════════════════════════════════════════════════════
    // REPORTER APPROVAL: Auto-set flag when system reporter approval line is selected
    // ═══════════════════════════════════════════════════════════════════════
    if (isSystemReporterApprovalLine(taskDataToSaveWithCode.workflowDefinitionId)) {
      (taskDataToSaveWithCode as any).requiresReporterApproval = true
      console.log('[TaskTemplateService] Reporter Approval line selected, setting requiresReporterApproval = true')
    }

    const docRef = await addDoc(taskCollectionRef, taskDataToSaveWithCode)

    // Return full task object so UI has access to generated fields (e.g. taskNumber, projectCode)
    const createdTask: GeneratedTask = {
      id: docRef.id,
      ...taskDataToSaveWithCode,
    } as GeneratedTask

    // Log activity (dashboard feed)
    try {
      const { ActivityService } = await import('../activity-service');
      await ActivityService.logActivity(groupId || companyId, companyId, {
        actorId: userId,
        type: 'task_created',
        entityId: docRef.id,
        entityType: 'task',
        entityName: taskData.title, // Use title as name for activity log
        metadata: {
          projectId: taskData.projectId,
          priority: taskData.priority,
          taskNumber
        },
        recipientId: taskDataToSave.assignedUserId
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }

    // Log to task activity timeline (fire-and-forget)
    void (async () => {
      try {
        console.log('[TaskActivity] Logging task creation for:', { taskId: docRef.id, title: taskData.title, userId, assignedToName })

        // Resolve creator name
        let creatorName = 'Unknown User'
        try {
          const userPath = groupId && groupId !== companyId
            ? ['enterpriseGroups', groupId, 'users', userId]
            : ['companies', companyId, 'users', userId]
          const userSnap = await getDoc(doc(db, ...(userPath as [string, ...string[]])))
          if (userSnap.exists()) {
            const userData = userSnap.data() as { name?: string; displayName?: string }
            creatorName = userData.name || userData.displayName || 'Unknown User'
          }
        } catch (e) {
          console.warn('[TaskActivity] Failed to resolve creator name:', e)
        }

        const { logTaskCreated } = await import('../task-activity-service')
        const result = await logTaskCreated(
          companyId,
          docRef.id,
          taskData.projectId,
          taskData.title,
          userId,
          creatorName,
          assignedToName, // assignee name
          groupId ?? undefined
        )
        console.log('[TaskActivity] Task creation logged successfully:', result?.id)
      } catch (e) {
        console.error('[TaskActivity] Failed to log task creation:', e)
      }
    })()

    // Trigger notification (fire & forget)
    if (taskDataToSave.assignedUserId) {
      TaskNotificationService.notifyTaskAssigned(
        companyId,
        taskDataToSave.assignedUserId,
        createdTask,
        groupId ?? undefined
      ).catch(err => console.error('Failed to trigger notification:', err))
    }

    // ✅ GHOST DETECTION: Check if task has workflow issues (vacant positions, etc.)
    // This runs AFTER task creation to detect and store any ghost issues
    if (createdTask.workflowDefinitionId || createdTask.escalationPolicyId) {
      try {
        const ghostResult = await detectGhostForTask(companyId, createdTask, groupId ?? undefined)
        if (ghostResult.hasGhostIssue && ghostResult.ghostInfo) {
          await updateTaskGhostInfo(companyId, createdTask.id, ghostResult.ghostInfo, groupId ?? undefined)
          // Update local task object to reflect ghost status
          createdTask.hasGhostIssue = true
          createdTask.ghostInfo = ghostResult.ghostInfo
          console.log(`[TaskTemplateService] ⚠ Ghost issue detected for task ${createdTask.id}:`, ghostResult.ghostInfo)
        }
      } catch (ghostError) {
        console.error('[TaskTemplateService] Error detecting ghost issues:', ghostError)
        // Don't fail task creation if ghost detection fails
      }
    }

    return createdTask
  }

  /**
   * Get all subtasks for a parent task
   */
  static async getSubtasks(
    companyId: string,
    parentTaskId: string,
    groupId?: string
  ): Promise<GeneratedTask[]> {
    if (!companyId || !parentTaskId) return []

    try {
      // Construct the correct collection reference based on tenant mode
      const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
      const tasksRef = collection(db, segments[0], ...segments.slice(1))

      const q = query(
        tasksRef,
        where('parentTaskId', '==', parentTaskId),
        orderBy('createdAt', 'asc')
      )

      const snapshot = await getDocs(q)
      return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as GeneratedTask))
    } catch (error: any) {
      // If index error, try without orderBy
      if (error?.code === 'failed-precondition') {
        console.warn('Firestore index missing for subtasks query, fetching without orderBy')
        const segmentsFallback = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
        const q = query(
          collection(db, segmentsFallback[0], ...segmentsFallback.slice(1)),
          where('parentTaskId', '==', parentTaskId)
        )
        const snapshot = await getDocs(q)
        const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as GeneratedTask))
        // Sort in memory
        return tasks.sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime()
          const dateB = new Date(b.createdAt).getTime()
          return dateA - dateB
        })
      }
      throw error
    }
  }

  /**
   * Update task title (inline edit)
   */
  static async updateTaskTitle(
    companyId: string,
    taskId: string,
    title: string,
    actorId?: string,
    groupId?: string
  ): Promise<void> {
    if (!taskId || !companyId) {
      throw new Error('Cannot update task title: missing task ID or company ID')
    }

    const segmentsT = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
    const fullPathT = [...segmentsT, taskId]
    const taskRef = doc(db, fullPathT[0], ...fullPathT.slice(1))

    await updateDoc(taskRef, {
      title,
      updatedAt: new Date().toISOString(),
    })

    if (actorId) {
      try {
        const { ActivityService } = await import('../activity-service');
        await ActivityService.logActivity(groupId || companyId, companyId, {
          actorId,
          type: 'task_updated',
          entityId: taskId,
          entityType: 'task',
          entityName: title // We know the new title
        });
      } catch (err) {
        console.error('Failed to log task title update:', err);
      }
    }
  }

  /**
   * Update task description (inline edit)
   */
  static async updateTaskDescription(
    companyId: string,
    taskId: string,
    description: string,
    groupId?: string
  ): Promise<void> {
    if (!taskId || !companyId) {
      throw new Error('Cannot update task description: missing task ID or company ID')
    }

    const segmentsD = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
    const fullPathD = [...segmentsD, taskId]
    const taskRef = doc(db, fullPathD[0], ...fullPathD.slice(1))

    await updateDoc(taskRef, {
      description,
      updatedAt: new Date().toISOString(),
    })
  }

  /**
   * Update task dates (Gantt chart drag-and-drop)
   */
  static async updateTaskDates(
    companyId: string,
    taskId: string,
    startDate: string,
    endDate: string,
    groupId?: string
  ): Promise<void> {
    if (!taskId || !companyId) {
      throw new Error('Cannot update task dates: missing task ID or company ID')
    }

    const segmentsDates = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
    const fullPathDates = [...segmentsDates, taskId]
    const taskRef = doc(db, fullPathDates[0], ...fullPathDates.slice(1))

    await updateDoc(taskRef, {
      startDate,
      endDate,
      dueDate: endDate, // Sink dueDate with endDate for consistency
      updatedAt: new Date().toISOString(),
    })
  }


  // ============================================================================
  // STATISTICS AND ANALYTICS
  // ============================================================================

  /**
   * Get task library statistics
   */
  static async getTaskLibraryStats(companyId: string, groupId?: string): Promise<TaskLibraryStats> {
    const templates = await this.getTaskTemplates(companyId, undefined, groupId)
    const activeTemplates = templates.filter(t => t.isActive)
    const systemTemplates = templates.filter(t => t.isSystemTemplate)
    const userTemplates = templates.filter(t => !t.isSystemTemplate)

    // Get task statistics
    const pathSegmentsTasks = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
    const tasksQuery = query(collection(db, pathSegmentsTasks[0], ...pathSegmentsTasks.slice(1)))
    const tasksSnapshot = await getDocs(tasksQuery)
    const allTasks = tasksSnapshot.docs
      .map(doc => doc.data())
      .filter((t): t is Record<string, any> => t !== undefined && t !== null)

    const completedTasks = allTasks.filter(t => t.status === 'completed').length
    const overdueTasks = allTasks.filter(t => {
      if (!t.dueDate) return false
      const dueDate = new Date(t.dueDate)
      const now = new Date()
      return dueDate < now && t.status !== 'completed'
    }).length

    const totalAssignments = allTasks.length

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

    // Get most used templates
    const templateUsage = templates.map(template => ({
      templateId: template.id,
      templateName: template.name,
      usageCount: template.usageCount,
    })).sort((a, b) => b.usageCount - a.usageCount).slice(0, 5)

    return {
      totalTemplates: templates.length,
      activeTemplates: activeTemplates.length,
      systemTemplates: systemTemplates.length,
      userTemplates: userTemplates.length,
      totalAssignments,
      completedTasks,
      overdueTasks,
      averageCompletionTime,
      mostUsedTemplates: templateUsage,
    }
  }

  // ============================================================================
  // DELETE OPERATIONS
  // ============================================================================

  /**
   * Delete a task permanently (hard delete)
   * This will delete the task and all its subtasks and comments
   * 
   * @param companyId - Company ID
   * @param taskId - Task ID to delete
   */
  static async deleteTask(
    companyId: string,
    taskId: string,
    groupId?: string
  ): Promise<void> {
    if (!taskId || !companyId) {
      throw new Error('Cannot delete task: missing task ID or company ID')
    }

    const segmentsDel = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
    const fullPathDel = [...segmentsDel, taskId]
    const taskRef = doc(db, fullPathDel[0], ...fullPathDel.slice(1))

    // Check if task exists
    const taskSnap = await getDoc(taskRef)
    if (!taskSnap.exists()) {
      throw new Error('Task not found')
    }

    // First, delete all subtasks recursively
    const subtasks = await this.getSubtasks(companyId, taskId, groupId)
    for (const subtask of subtasks) {
      await this.deleteTask(companyId, subtask.id, groupId)
    }

    // Delete all comments for this task
    try {
      const segmentsC = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
      const tasksRef = collection(db, segmentsC[0], ...segmentsC.slice(1))
      const commentsRef = collection(tasksRef, taskId, 'comments')
      const commentsSnap = await getDocs(commentsRef)
      const deleteCommentPromises = commentsSnap.docs.map(doc => deleteDoc(doc.ref))
      await Promise.all(deleteCommentPromises)
    } catch (error) {
      console.warn('Error deleting comments:', error)
      // Continue with task deletion even if comments fail
    }

    // Clean up starred entries BEFORE deleting the task
    // This allows firestore rules to check ownership of the task during cleanup
    try {
      await StarredItemsService.removeStarredEntity(companyId, companyId, 'task', taskId)
    } catch (error) {
      console.warn('Error cleaning up starred items:', error)
      // Continue, as task deletion is primary
    }

    // Finally, delete the task itself
    await deleteDoc(taskRef)
  }
}
