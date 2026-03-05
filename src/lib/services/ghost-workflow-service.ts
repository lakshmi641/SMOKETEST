/**
 * Ghost Workflow Service
 *
 * Detects and manages "ghost" workflows - tasks that have approval lines
 * or escalation paths with positions that have been removed or are now vacant.
 *
 * Ghost issues occur when:
 * - A position in the approval line is deleted
 * - A position in the escalation path is deleted
 * - A user is removed from a position
 * - A user becomes inactive
 * - An approval line or escalation path is deleted
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { companySubcollectionPathSegments } from '@/lib/firestore-paths'
import { generateId } from '@/lib/utils'

// Types
import type { GeneratedTask, GhostWorkflowInfo, GhostPositionInfo, GhostReasonType, GhostResolutionMethod } from '@/types/task-template-schema'
import type { ValidationIssue, ValidationResult } from '@/types/workflow-validation-schema'

// Services
import { validateApprovalLine, validateEscalationPath } from './workflow-validation-service'
import { getApprovalLine } from './approval-line-service'
import { getEscalationPath } from './escalation-path-service'

// ============================================================================
// GHOST DETECTION
// ============================================================================

export interface GhostDetectionResult {
  taskId: string
  taskTitle: string
  projectId: string
  hasGhostIssue: boolean
  ghostInfo?: GhostWorkflowInfo
  approvalValidation?: ValidationResult
  escalationValidation?: ValidationResult
}

/**
 * Detect ghost issues for a single task
 */
export async function detectGhostForTask(
  companyId: string,
  task: GeneratedTask,
  groupId?: string
): Promise<GhostDetectionResult> {
  const result: GhostDetectionResult = {
    taskId: task.id,
    taskTitle: task.title,
    projectId: task.projectId,
    hasGhostIssue: false,
  }

  let hasGhostApproval = false
  let hasGhostEscalation = false
  let approvalGhostReason: GhostReasonType | undefined
  let escalationGhostReason: GhostReasonType | undefined
  const affectedApprovalStages: string[] = []
  const affectedApprovalPositions: GhostPositionInfo[] = []
  const affectedEscalationRules: string[] = []
  const affectedEscalationPositions: GhostPositionInfo[] = []

  // Check approval line if assigned
  if (task.workflowDefinitionId) {
    const validation = await validateApprovalLine(companyId, task.workflowDefinitionId, groupId)
    result.approvalValidation = validation

    if (validation.status !== 'valid') {
      // Check if approval line was deleted
      const approvalLine = await getApprovalLine(companyId, task.workflowDefinitionId, groupId)
      if (!approvalLine) {
        hasGhostApproval = true
        approvalGhostReason = 'approval_line_deleted'
      } else {
        // Check for ALL validation issues (errors and warnings)
        for (const issue of validation.issues) {
          // Handle ERRORS: position_missing, position_vacant, user_missing, hierarchy_broken
          if (issue.severity === 'error') {
            hasGhostApproval = true

            // Set the correct reason based on issue type
            if (issue.type === 'position_missing') {
              approvalGhostReason = approvalGhostReason || 'position_missing'
            } else if (issue.type === 'position_vacant') {
              approvalGhostReason = approvalGhostReason || 'position_vacant'
            } else if (issue.type === 'user_missing') {
              approvalGhostReason = approvalGhostReason || 'user_missing'
            } else if (issue.type === 'hierarchy_broken') {
              approvalGhostReason = approvalGhostReason || 'position_missing'
            }

            if (issue.stageId) {
              affectedApprovalStages.push(issue.stageId)
            }

            // Track affected positions or users
            if (issue.positionId) {
              affectedApprovalPositions.push({
                positionId: issue.positionId,
                positionTitle: issue.positionTitle,
                reason: issue.type as GhostReasonType,
                stageId: issue.stageId,
                stageName: issue.stageName,
              })
            } else if (issue.userId) {
              // Track user issues too (for user_missing)
              affectedApprovalPositions.push({
                positionId: issue.userId, // Use userId as identifier
                positionTitle: issue.userName || 'Deleted User',
                reason: issue.type as GhostReasonType,
                stageId: issue.stageId,
                stageName: issue.stageName,
              })
            }
          }
          // Handle WARNINGS: user_inactive
          else if (issue.severity === 'warning') {
            if (issue.type === 'user_inactive') {
              hasGhostApproval = true
              approvalGhostReason = approvalGhostReason || 'user_inactive'

              if (issue.stageId) {
                affectedApprovalStages.push(issue.stageId)
              }

              if (issue.positionId || issue.userId) {
                affectedApprovalPositions.push({
                  positionId: issue.positionId || issue.userId || '',
                  positionTitle: issue.positionTitle || issue.userName || 'Inactive User',
                  reason: issue.type as GhostReasonType,
                  stageId: issue.stageId,
                  stageName: issue.stageName,
                })
              }
            }
          }
        }
      }
    }
  }

  // Check escalation path if assigned
  if (task.escalationPolicyId) {
    const validation = await validateEscalationPath(companyId, task.escalationPolicyId, groupId)
    result.escalationValidation = validation

    if (validation.status !== 'valid') {
      // Check if escalation path was deleted
      const escalationPath = await getEscalationPath(companyId, task.escalationPolicyId, groupId)
      if (!escalationPath) {
        hasGhostEscalation = true
        escalationGhostReason = 'escalation_path_deleted'
      } else {
        // Check for ALL validation issues
        for (const issue of validation.issues) {
          if (issue.severity === 'error') {
            hasGhostEscalation = true

            // Set the correct reason based on issue type
            if (issue.type === 'position_missing') {
              escalationGhostReason = escalationGhostReason || 'position_missing'
            } else if (issue.type === 'position_vacant') {
              escalationGhostReason = escalationGhostReason || 'position_vacant'
            } else if (issue.type === 'user_missing') {
              escalationGhostReason = escalationGhostReason || 'user_missing'
            } else if (issue.type === 'hierarchy_broken') {
              escalationGhostReason = escalationGhostReason || 'position_missing'
            }

            if (issue.ruleId) {
              affectedEscalationRules.push(issue.ruleId)
            }

            // Track affected positions or users
            if (issue.positionId) {
              affectedEscalationPositions.push({
                positionId: issue.positionId,
                positionTitle: issue.positionTitle,
                reason: issue.type as GhostReasonType,
                ruleId: issue.ruleId,
                ruleName: issue.ruleName,
              })
            } else if (issue.userId) {
              // Track user issues too (for user_missing)
              affectedEscalationPositions.push({
                positionId: issue.userId,
                positionTitle: issue.userName || 'Deleted User',
                reason: issue.type as GhostReasonType,
                ruleId: issue.ruleId,
                ruleName: issue.ruleName,
              })
            }
          }
          // Handle WARNINGS: user_inactive
          else if (issue.severity === 'warning') {
            if (issue.type === 'user_inactive') {
              hasGhostEscalation = true
              escalationGhostReason = escalationGhostReason || 'user_inactive'

              if (issue.ruleId) {
                affectedEscalationRules.push(issue.ruleId)
              }

              if (issue.positionId || issue.userId) {
                affectedEscalationPositions.push({
                  positionId: issue.positionId || issue.userId || '',
                  positionTitle: issue.positionTitle || issue.userName || 'Inactive User',
                  reason: issue.type as GhostReasonType,
                  ruleId: issue.ruleId,
                  ruleName: issue.ruleName,
                })
              }
            }
          }
        }
      }
    }
  }

  // Build ghost info if there are issues
  if (hasGhostApproval || hasGhostEscalation) {
    result.hasGhostIssue = true
    result.ghostInfo = {
      hasGhostApproval,
      hasGhostEscalation,
      approvalGhostReason,
      affectedApprovalStages: [...new Set(affectedApprovalStages)],
      affectedApprovalPositions,
      escalationGhostReason,
      affectedEscalationRules: [...new Set(affectedEscalationRules)],
      affectedEscalationPositions,
      detectedAt: new Date().toISOString(),
      detectedBy: 'system',
    }
  }

  return result
}

/**
 * Detect ghost issues for all active tasks in a project
 */
export async function detectGhostsForProject(
  companyId: string,
  projectId: string
): Promise<GhostDetectionResult[]> {
  try {
    const tasksRef = collection(db, 'companies', companyId, 'tasks')
    const q = query(
      tasksRef,
      where('projectId', '==', projectId),
      where('status', 'in', ['open', 'assigned', 'in_progress', 'on_hold'])
    )

    const snapshot = await getDocs(q)
    const results: GhostDetectionResult[] = []

    for (const doc of snapshot.docs) {
      const task = { id: doc.id, ...doc.data() } as GeneratedTask

      // Only check tasks with workflows assigned
      if (task.workflowDefinitionId || task.escalationPolicyId) {
        const result = await detectGhostForTask(companyId, task)
        results.push(result)
      }
    }

    return results
  } catch (error) {
    console.error('[GhostWorkflow] Error detecting ghosts for project:', error)
    return []
  }
}

/**
 * Detect ghost issues for all active tasks in a company
 */
export async function detectGhostsForCompany(
  companyId: string
): Promise<GhostDetectionResult[]> {
  try {
    const tasksRef = collection(db, 'companies', companyId, 'tasks')
    const q = query(
      tasksRef,
      where('status', 'in', ['open', 'assigned', 'in_progress', 'on_hold'])
    )

    const snapshot = await getDocs(q)
    const results: GhostDetectionResult[] = []

    for (const doc of snapshot.docs) {
      const task = { id: doc.id, ...doc.data() } as GeneratedTask

      // Only check tasks with workflows assigned
      if (task.workflowDefinitionId || task.escalationPolicyId) {
        const result = await detectGhostForTask(companyId, task)
        if (result.hasGhostIssue) {
          results.push(result)
        }
      }
    }

    return results
  } catch (error) {
    console.error('[GhostWorkflow] Error detecting ghosts for company:', error)
    return []
  }
}

// ============================================================================
// GHOST UPDATE & RESOLUTION
// ============================================================================

/**
 * Update task with ghost info
 */
export async function updateTaskGhostInfo(
  companyId: string,
  taskId: string,
  ghostInfo: GhostWorkflowInfo | null,
  groupId?: string
): Promise<void> {
  try {
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
    const taskRef = doc(db, ...segments, taskId)

    await updateDoc(taskRef, {
      ghostInfo: ghostInfo,
      hasGhostIssue: ghostInfo !== null,
      lastGhostCheckAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[GhostWorkflow] Error updating task ghost info:', error)
    throw error
  }
}

/**
 * Resolve ghost issue for a task
 */
export async function resolveGhostIssue(
  companyId: string,
  taskId: string,
  resolution: {
    method: GhostResolutionMethod
    resolvedBy: string
    notes?: string
    newWorkflowDefinitionId?: string
    newEscalationPolicyId?: string
  }
): Promise<void> {
  try {
    const taskRef = doc(db, 'companies', companyId, 'tasks', taskId)
    const taskSnap = await getDoc(taskRef)

    if (!taskSnap.exists()) {
      throw new Error('Task not found')
    }

    const task = taskSnap.data() as GeneratedTask
    const now = new Date().toISOString()

    const updates: Record<string, unknown> = {
      updatedAt: now,
      lastGhostCheckAt: now,
    }

    // If changing workflow
    if (resolution.method === 'workflow_changed') {
      if (resolution.newWorkflowDefinitionId) {
        updates.workflowDefinitionId = resolution.newWorkflowDefinitionId
      }
      if (resolution.newEscalationPolicyId) {
        updates.escalationPolicyId = resolution.newEscalationPolicyId
      }
    }

    // Update ghost info with resolution
    if (task.ghostInfo) {
      updates.ghostInfo = {
        ...task.ghostInfo,
        resolvedAt: now,
        resolvedBy: resolution.resolvedBy,
        resolutionMethod: resolution.method,
        resolutionNotes: resolution.notes,
      }
    }

    // Clear ghost flag if resolved
    if (resolution.method !== 'manual_override') {
      updates.hasGhostIssue = false
    }

    await updateDoc(taskRef, updates)
  } catch (error) {
    console.error('[GhostWorkflow] Error resolving ghost issue:', error)
    throw error
  }
}

/**
 * Clear ghost info for a task (after positions are filled)
 */
export async function clearGhostInfo(
  companyId: string,
  taskId: string,
  clearedBy: string
): Promise<void> {
  try {
    const taskRef = doc(db, 'companies', companyId, 'tasks', taskId)
    const taskSnap = await getDoc(taskRef)

    if (!taskSnap.exists()) {
      throw new Error('Task not found')
    }

    const task = taskSnap.data() as GeneratedTask
    const now = new Date().toISOString()

    await updateDoc(taskRef, {
      ghostInfo: task.ghostInfo ? {
        ...task.ghostInfo,
        resolvedAt: now,
        resolvedBy: clearedBy,
        resolutionMethod: 'auto_resolved',
      } : null,
      hasGhostIssue: false,
      lastGhostCheckAt: now,
      updatedAt: now,
    })
  } catch (error) {
    console.error('[GhostWorkflow] Error clearing ghost info:', error)
    throw error
  }
}

// ============================================================================
// GHOST QUERIES
// ============================================================================

/**
 * Get all tasks with ghost issues in a project
 */
export async function getTasksWithGhostIssues(
  companyId: string,
  projectId?: string
): Promise<GeneratedTask[]> {
  try {
    const tasksRef = collection(db, 'companies', companyId, 'tasks')

    let q
    if (projectId) {
      q = query(
        tasksRef,
        where('projectId', '==', projectId),
        where('hasGhostIssue', '==', true)
      )
    } else {
      q = query(
        tasksRef,
        where('hasGhostIssue', '==', true)
      )
    }

    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GeneratedTask))
  } catch (error) {
    console.error('[GhostWorkflow] Error getting tasks with ghost issues:', error)
    return []
  }
}

/**
 * Get ghost issue count for a project
 */
export async function getGhostIssueCount(
  companyId: string,
  projectId?: string
): Promise<number> {
  try {
    const tasks = await getTasksWithGhostIssues(companyId, projectId)
    return tasks.length
  } catch (error) {
    console.error('[GhostWorkflow] Error getting ghost issue count:', error)
    return 0
  }
}

// ============================================================================
// BATCH GHOST CHECK
// ============================================================================

/**
 * Run ghost detection for all tasks and update their ghost info
 */
export async function runGhostDetectionBatch(
  companyId: string,
  projectId?: string
): Promise<{
  checked: number
  ghostsFound: number
  ghostsCleared: number
}> {
  const result = {
    checked: 0,
    ghostsFound: 0,
    ghostsCleared: 0,
  }

  try {
    const tasksRef = collection(db, 'companies', companyId, 'tasks')

    let q
    if (projectId) {
      q = query(
        tasksRef,
        where('projectId', '==', projectId),
        where('status', 'in', ['open', 'assigned', 'in_progress', 'on_hold'])
      )
    } else {
      q = query(
        tasksRef,
        where('status', 'in', ['open', 'assigned', 'in_progress', 'on_hold'])
      )
    }

    const snapshot = await getDocs(q)

    for (const docSnap of snapshot.docs) {
      const task = { id: docSnap.id, ...docSnap.data() } as GeneratedTask

      // Only check tasks with workflows assigned
      if (task.workflowDefinitionId || task.escalationPolicyId) {
        result.checked++

        const detection = await detectGhostForTask(companyId, task)

        if (detection.hasGhostIssue) {
          // New ghost found
          if (!task.hasGhostIssue) {
            result.ghostsFound++
          }
          await updateTaskGhostInfo(companyId, task.id, detection.ghostInfo!)
        } else if (task.hasGhostIssue) {
          // Ghost was cleared
          result.ghostsCleared++
          await clearGhostInfo(companyId, task.id, 'system')
        }
      }
    }
  } catch (error) {
    console.error('[GhostWorkflow] Error running batch detection:', error)
  }

  return result
}

// ============================================================================
// GHOST SUMMARY
// ============================================================================

export interface GhostSummary {
  companyId: string
  projectId?: string
  totalTasksWithGhosts: number
  ghostsByType: {
    position_missing: number
    position_vacant: number
    user_inactive: number
    approval_line_deleted: number
    escalation_path_deleted: number
  }
  affectedProjects: string[]
  lastCheckedAt: string
}

/**
 * Get ghost summary for company or project
 */
export async function getGhostSummary(
  companyId: string,
  projectId?: string
): Promise<GhostSummary> {
  const tasks = await getTasksWithGhostIssues(companyId, projectId)

  const ghostsByType: Record<GhostReasonType, number> = {
    position_missing: 0,
    position_vacant: 0,
    user_missing: 0,
    user_inactive: 0,
    approval_line_deleted: 0,
    escalation_path_deleted: 0,
  }

  const affectedProjects = new Set<string>()

  for (const task of tasks) {
    affectedProjects.add(task.projectId)

    if (task.ghostInfo) {
      if (task.ghostInfo.approvalGhostReason) {
        ghostsByType[task.ghostInfo.approvalGhostReason]++
      }
      if (task.ghostInfo.escalationGhostReason) {
        ghostsByType[task.ghostInfo.escalationGhostReason]++
      }
    }
  }

  return {
    companyId,
    projectId,
    totalTasksWithGhosts: tasks.length,
    ghostsByType,
    affectedProjects: Array.from(affectedProjects),
    lastCheckedAt: new Date().toISOString(),
  }
}
