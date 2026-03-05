/**
 * Task Activity Service
 *
 * Comprehensive activity logging for tasks including:
 * - Lifecycle events (created, started, completed, etc.)
 * - Approval stage progression (Stage 1 → 2 → 3)
 * - Escalation level tracking (Level 1 → 2 → 3)
 * - Status changes, assignments, comments
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { companyCollectionPathSegments } from '@/lib/firestore-paths'
import { generateId } from '@/lib/utils'

import type {
  TaskActivity,
  TaskActivityType,
  TaskActivityCategory,
  ActivityActorType,
  ApprovalActivityData,
  EscalationActivityData,
  ActivityChange,
  TaskActivityQuery,
  TaskActivityPage,
  TaskActivitySummary,
  CreateTaskActivityInput,
} from '@/types/task-activity-schema'

// ============================================================================
// COLLECTION HELPERS
// ============================================================================

/**
 * Get the taskActivities collection. Always uses enterprise path so Firestore rules apply.
 * When groupId is missing, uses companyId as groupId (single-tenant pattern).
 */
function getActivitiesCollection(companyId: string, groupId?: string) {
  const effectiveGroupId = groupId || companyId
  return collection(db, ...companyCollectionPathSegments(effectiveGroupId, companyId, 'taskActivities'))
}

// ============================================================================
// BASE ACTIVITY LOGGING
// ============================================================================

/**
 * Sanitize object to replace undefined values with null (Firestore doesn't accept undefined)
 */
function sanitizeForFirestore<T extends Record<string, any>>(obj: T): T {
  const result: Record<string, any> = {}
  for (const key of Object.keys(obj)) {
    const value = obj[key]
    if (value === undefined) {
      result[key] = null
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeForFirestore(value)
    } else {
      result[key] = value
    }
  }
  return result as T
}

/**
 * Log a task activity
 */
export async function logActivity(
  companyId: string,
  activity: CreateTaskActivityInput,
  groupId?: string
): Promise<TaskActivity> {
  try {
    const activitiesRef = getActivitiesCollection(companyId, groupId)

    const activityData = sanitizeForFirestore({
      ...activity,
      companyId,
      createdAt: new Date().toISOString(),
    })

    const docRef = await addDoc(activitiesRef, activityData)

    return {
      id: docRef.id,
      ...activityData,
    }
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code
    const isPermissionDenied = code === 'permission-denied' || (error as Error)?.message?.includes('insufficient permissions')
    if (isPermissionDenied) {
      console.warn('[TaskActivity] Activity log skipped (permissions): ensure user is a member of the enterprise group company.')
      return { id: '', ...activity, companyId, createdAt: new Date().toISOString() } as TaskActivity
    }
    console.error('[TaskActivity] Error logging activity:', error)
    throw error
  }
}

// ============================================================================
// LIFECYCLE ACTIVITIES
// ============================================================================

export async function logTaskCreated(
  companyId: string,
  taskId: string,
  projectId: string,
  taskTitle: string,
  actorId: string,
  actorName: string,
  assigneeName?: string,
  groupId?: string
): Promise<TaskActivity> {
  // Build description: "created task and assigned to [Name]" or just "created task"
  let description: string
  if (assigneeName && assigneeName !== actorName) {
    description = `created task and assigned to ${assigneeName}`
  } else if (assigneeName) {
    description = 'created task (self-assigned)'
  } else {
    description = 'created task'
  }

  return logActivity(companyId, {
    companyId,
    taskId,
    projectId,
    type: 'task_created',
    category: 'lifecycle',
    description,
    actorId,
    actorName,
    actorType: 'user',
  }, groupId)
}

/**
 * Format status for display
 */
function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'assigned': 'Assigned',
    'in_progress': 'In Progress',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
    'on_hold': 'On Hold',
    'pending': 'Pending',
    'blocked': 'Blocked',
  }
  return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')
}

/**
 * Log a status change on a task
 * Creates description like "changed status to In Progress"
 */
export async function logStatusChanged(
  companyId: string,
  taskId: string,
  projectId: string,
  previousStatus: string,
  newStatus: string,
  actorId: string,
  actorName: string,
  groupId?: string
): Promise<TaskActivity> {
  const formattedOldStatus = formatStatus(previousStatus)
  const formattedNewStatus = formatStatus(newStatus)

  return logActivity(companyId, {
    companyId,
    taskId,
    projectId,
    type: 'status_changed',
    category: 'lifecycle',
    description: `changed status from ${formattedOldStatus} to ${formattedNewStatus}`,
    actorId,
    actorName,
    actorType: 'user',
    changes: [{ field: 'status', oldValue: previousStatus, newValue: newStatus }],
  }, groupId)
}

export async function logTaskStarted(
  companyId: string,
  taskId: string,
  projectId: string,
  actorId: string,
  actorName: string,
  groupId?: string
): Promise<TaskActivity> {
  return logActivity(companyId, {
    companyId,
    taskId,
    projectId,
    type: 'task_started',
    category: 'lifecycle',
    description: 'changed status to In Progress',
    actorId,
    actorName,
    actorType: 'user',
  }, groupId)
}

export async function logTaskCompleted(
  companyId: string,
  taskId: string,
  projectId: string,
  actorId: string,
  actorName: string,
  groupId?: string
): Promise<TaskActivity> {
  return logActivity(companyId, {
    companyId,
    taskId,
    projectId,
    type: 'task_completed',
    category: 'lifecycle',
    description: 'changed status to Completed',
    actorId,
    actorName,
    actorType: 'user',
  }, groupId)
}

export async function logTaskCancelled(
  companyId: string,
  taskId: string,
  projectId: string,
  actorId: string,
  actorName: string,
  reason?: string,
  groupId?: string
): Promise<TaskActivity> {
  return logActivity(companyId, {
    companyId,
    taskId,
    projectId,
    type: 'task_cancelled',
    category: 'lifecycle',
    description: 'changed status to Cancelled',
    actorId,
    actorName,
    actorType: 'user',
  }, groupId)
}

export async function logStatusChange(
  companyId: string,
  taskId: string,
  projectId: string,
  oldStatus: string,
  newStatus: string,
  actorId: string,
  actorName: string,
  groupId?: string
): Promise<TaskActivity> {
  return logActivity(companyId, {
    companyId,
    taskId,
    projectId,
    type: 'status_changed',
    category: 'status',
    description: `changed status from "${oldStatus}" to "${newStatus}"`,
    actorId,
    actorName,
    actorType: 'user',
    changes: [{ field: 'status', oldValue: oldStatus, newValue: newStatus }],
  }, groupId)
}

export async function logTimeLogged(
  companyId: string,
  taskId: string,
  projectId: string,
  duration: number,
  actorId: string,
  actorName: string,
  notes?: string,
  groupId?: string
): Promise<TaskActivity> {
  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return logActivity(companyId, {
    companyId,
    taskId,
    projectId,
    type: 'time_logged',
    category: 'status',
    description: `logged ${duration}h on ${dateStr}${notes ? ` — ${notes}` : ''}`,
    actorId,
    actorName,
    actorType: 'user',
    metadata: { duration, notes }
  }, groupId)
}

// ============================================================================
// APPROVAL PROGRESSION ACTIVITIES
// ============================================================================

/**
 * Log when approval workflow starts
 */
export async function logApprovalWorkflowStarted(
  companyId: string,
  taskId: string,
  projectId: string,
  data: {
    instanceId: string
    workflowId: string
    workflowName: string
    totalStages: number
  },
  groupId?: string
): Promise<TaskActivity> {
  return logActivity(companyId, {
    companyId,
    taskId,
    projectId,
    type: 'approval_workflow_started',
    category: 'approval',
    description: `Approval workflow started: "${data.workflowName}" (${data.totalStages} stages)`,
    actorId: 'system',
    actorName: 'System',
    actorType: 'system',
    approvalData: {
      instanceId: data.instanceId,
      workflowId: data.workflowId,
      workflowName: data.workflowName,
      totalStages: data.totalStages,
      currentStageNumber: 0,
      stageId: '',
      stageName: '',
    },
  }, groupId)
}

/**
 * Log when entering a new approval stage
 */
export async function logApprovalStageEntered(
  companyId: string,
  taskId: string,
  projectId: string,
  data: {
    instanceId: string
    workflowId: string
    workflowName: string
    totalStages: number
    currentStageNumber: number
    stageId: string
    stageName: string
    pendingApproverId: string
    pendingApproverName: string
    pendingApproverPosition?: string
  },
  groupId?: string
): Promise<TaskActivity> {
  return logActivity(companyId, {
    companyId,
    taskId,
    projectId,
    type: 'approval_stage_entered',
    category: 'approval',
    description: `Entered Stage ${data.currentStageNumber} of ${data.totalStages}: ${data.stageName}`,
    actorId: 'system',
    actorName: 'System',
    actorType: 'system',
    approvalData: {
      instanceId: data.instanceId,
      workflowId: data.workflowId,
      workflowName: data.workflowName,
      totalStages: data.totalStages,
      currentStageNumber: data.currentStageNumber,
      stageId: data.stageId,
      stageName: data.stageName,
      pendingApproverId: data.pendingApproverId,
      pendingApproverName: data.pendingApproverName,
      pendingApproverPosition: data.pendingApproverPosition,
      stageEnteredAt: new Date().toISOString(),
    },
  }, groupId)
}

/**
 * Log when approver makes a decision (approve/reject)
 */
export async function logApprovalDecision(
  companyId: string,
  taskId: string,
  projectId: string,
  data: {
    instanceId: string
    workflowId: string
    workflowName: string
    totalStages: number
    currentStageNumber: number
    stageId: string
    stageName: string
    decision: 'approved' | 'rejected'
    comments?: string
    userId: string
    userName: string
    userPosition?: string
    stageEnteredAt?: string
  },
  groupId?: string
): Promise<TaskActivity> {
  const timeInStage = data.stageEnteredAt
    ? Date.now() - new Date(data.stageEnteredAt).getTime()
    : undefined

  const decisionText = data.decision === 'approved' ? 'APPROVED' : 'REJECTED'

  return logActivity(companyId, {
    companyId,
    taskId,
    projectId,
    type: 'approval_decision',
    category: 'approval',
    description: `Stage ${data.currentStageNumber} of ${data.totalStages}: ${data.stageName} - ${decisionText}`,
    actorId: data.userId,
    actorName: data.userName,
    actorType: 'user',
    actorPosition: data.userPosition,
    approvalData: {
      instanceId: data.instanceId,
      workflowId: data.workflowId,
      workflowName: data.workflowName,
      totalStages: data.totalStages,
      currentStageNumber: data.currentStageNumber,
      stageId: data.stageId,
      stageName: data.stageName,
      decision: data.decision,
      comments: data.comments,
      stageCompletedAt: new Date().toISOString(),
      timeInStage,
    },
  }, groupId)
}

/**
 * Log when all approval stages completed successfully
 */
export async function logApprovalWorkflowCompleted(
  companyId: string,
  taskId: string,
  projectId: string,
  data: {
    instanceId: string
    workflowId: string
    workflowName: string
    totalStages: number
  },
  groupId?: string
): Promise<TaskActivity> {
  return logActivity(companyId, {
    companyId,
    taskId,
    projectId,
    type: 'approval_workflow_completed',
    category: 'approval',
    description: `Approval workflow completed: All ${data.totalStages} stages approved`,
    actorId: 'system',
    actorName: 'System',
    actorType: 'system',
    approvalData: {
      instanceId: data.instanceId,
      workflowId: data.workflowId,
      workflowName: data.workflowName,
      totalStages: data.totalStages,
      currentStageNumber: data.totalStages,
      stageId: '',
      stageName: 'All stages complete',
    },
  }, groupId)
}

/**
 * Log when approval workflow is rejected
 */
export async function logApprovalWorkflowRejected(
  companyId: string,
  taskId: string,
  projectId: string,
  data: {
    instanceId: string
    workflowId: string
    workflowName: string
    totalStages: number
    rejectedAtStage: number
    stageName: string
    rejectedBy: string
    rejectedByName: string
    reason?: string
  },
  groupId?: string
): Promise<TaskActivity> {
  return logActivity(companyId, {
    companyId,
    taskId,
    projectId,
    type: 'approval_workflow_rejected',
    category: 'approval',
    description: `Approval workflow rejected at Stage ${data.rejectedAtStage} of ${data.totalStages}: ${data.stageName}`,
    actorId: data.rejectedBy,
    actorName: data.rejectedByName,
    actorType: 'user',
    approvalData: {
      instanceId: data.instanceId,
      workflowId: data.workflowId,
      workflowName: data.workflowName,
      totalStages: data.totalStages,
      currentStageNumber: data.rejectedAtStage,
      stageId: '',
      stageName: data.stageName,
      decision: 'rejected',
      comments: data.reason,
    },
  }, groupId)
}

// ============================================================================
// SYSTEM APPROVAL ACTIVITIES (Simplified for Reporter Approval)
// ============================================================================

/**
 * Log when reporter approves a task (simplified message without stage info)
 */
export async function logReporterApprovalDecision(
  companyId: string,
  taskId: string,
  projectId: string,
  data: {
    instanceId: string
    decision: 'approved' | 'rejected'
    comments?: string
    reporterId: string
    reporterName: string
  },
  groupId?: string
): Promise<TaskActivity> {
  const decisionText = data.decision === 'approved' ? 'approved' : 'rejected'
  const description = data.decision === 'approved'
    ? `Task approved by reporter (${data.reporterName})`
    : `Task rejected by reporter (${data.reporterName})${data.comments ? `: ${data.comments}` : ''}`

  return logActivity(companyId, {
    companyId,
    taskId,
    projectId,
    type: 'approval_decision',
    category: 'approval',
    description,
    actorId: data.reporterId,
    actorName: data.reporterName,
    actorType: 'user',
    approvalData: {
      instanceId: data.instanceId,
      workflowId: '__SYSTEM_REPORTER_APPROVAL__',
      workflowName: 'Reporter Approval',
      totalStages: 1,
      currentStageNumber: 1,
      stageId: 'reporter-review-stage',
      stageName: 'Reporter Review',
      decision: data.decision,
      comments: data.comments,
      isSystemApproval: true,
    },
  }, groupId)
}

// ============================================================================
// ESCALATION PROGRESSION ACTIVITIES
// ============================================================================

/**
 * Log when escalation starts
 */
export async function logEscalationStarted(
  companyId: string,
  taskId: string,
  projectId: string,
  data: {
    pathId: string
    pathName: string
    totalLevels: number
    reason?: string
    registeredAt?: string
  },
  groupId?: string
): Promise<TaskActivity> {
  return logActivity(companyId, {
    companyId,
    taskId,
    projectId,
    type: 'escalation_started',
    category: 'escalation',
    description: `Escalation started: "${data.pathName}" (${data.totalLevels} levels)`,
    actorId: 'system',
    actorName: 'System',
    actorType: 'system',
    escalationData: {
      pathId: data.pathId,
      pathName: data.pathName,
      totalLevels: data.totalLevels,
      currentLevelNumber: 0,
      levelName: '',
      ruleId: '',
      action: 'notify',
      reason: data.reason || 'Task registered for escalation monitoring',
    },
  }, groupId)
}

/**
 * Log when entering a new escalation level
 */
export async function logEscalationLevelEntered(
  companyId: string,
  taskId: string,
  projectId: string,
  data: {
    pathId: string
    pathName: string
    totalLevels: number
    currentLevelNumber: number
    levelName: string
    ruleId: string
    reason: string
  },
  groupId?: string
): Promise<TaskActivity> {
  return logActivity(companyId, {
    companyId,
    taskId,
    projectId,
    type: 'escalation_level_entered',
    category: 'escalation',
    description: `Escalated to Level ${data.currentLevelNumber} of ${data.totalLevels}: ${data.levelName}`,
    actorId: 'system',
    actorName: 'System',
    actorType: 'system',
    escalationData: {
      pathId: data.pathId,
      pathName: data.pathName,
      totalLevels: data.totalLevels,
      currentLevelNumber: data.currentLevelNumber,
      levelName: data.levelName,
      ruleId: data.ruleId,
      action: 'escalate',
      reason: data.reason,
      levelEnteredAt: new Date().toISOString(),
    },
  }, groupId)
}

/**
 * Log when notification is sent at an escalation level
 */
export async function logEscalationNotification(
  companyId: string,
  taskId: string,
  projectId: string,
  data: {
    pathId?: string
    pathName: string
    totalLevels: number
    currentLevelNumber: number
    levelName: string
    ruleId?: string
    targetUserId: string
    targetUserName: string
    targetPosition?: string | null
    notificationType?: 'notify' | 'remind'
    action?: 'notify' | 'remind'
    message?: string
  },
  groupId?: string
): Promise<TaskActivity> {
  // Support both 'notificationType' and 'action' field names
  const notifyType = data.notificationType || data.action || 'notify'
  const actionText = notifyType === 'remind' ? 'Reminder sent' : 'Notification sent'

  return logActivity(companyId, {
    companyId,
    taskId,
    projectId,
    type: 'escalation_notification_sent',
    category: 'escalation',
    description: `Level ${data.currentLevelNumber} of ${data.totalLevels}: ${actionText} to ${data.targetUserName}`,
    actorId: 'system',
    actorName: 'System',
    actorType: 'system',
    escalationData: {
      pathId: data.pathId || '',
      pathName: data.pathName,
      totalLevels: data.totalLevels,
      currentLevelNumber: data.currentLevelNumber,
      levelName: data.levelName,
      ruleId: data.ruleId || '',
      action: notifyType,
      targetUserId: data.targetUserId,
      targetUserName: data.targetUserName,
      targetPosition: data.targetPosition || undefined,
      reason: data.message || 'Escalation notification sent',
    },
  }, groupId)
}

/**
 * Log when task is reassigned due to escalation
 */
export async function logEscalationReassign(
  companyId: string,
  taskId: string,
  projectId: string,
  data: {
    pathId?: string
    pathName: string
    totalLevels: number
    currentLevelNumber: number
    levelName: string
    ruleId?: string
    fromUserId?: string | null
    fromUserName: string
    toUserId: string
    toUserName: string
    toPosition?: string | null
    reason?: string
  },
  groupId?: string
): Promise<TaskActivity> {
  return logActivity(companyId, {
    companyId,
    taskId,
    projectId,
    type: 'escalation_reassign',
    category: 'escalation',
    description: `Level ${data.currentLevelNumber} of ${data.totalLevels}: Task reassigned from ${data.fromUserName} to ${data.toUserName}`,
    actorId: 'system',
    actorName: 'System',
    actorType: 'system',
    escalationData: {
      pathId: data.pathId || '',
      pathName: data.pathName,
      totalLevels: data.totalLevels,
      currentLevelNumber: data.currentLevelNumber,
      levelName: data.levelName,
      ruleId: data.ruleId || '',
      action: 'reassign',
      targetUserId: data.toUserId,
      targetUserName: data.toUserName,
      targetPosition: data.toPosition || undefined,
      fromUserId: data.fromUserId || undefined,
      fromUserName: data.fromUserName,
      reason: data.reason || `Reassigned from ${data.fromUserName}`,
    },
  }, groupId)
}

/**
 * Log when escalation auto-approves the task
 */
export async function logEscalationAutoApprove(
  companyId: string,
  taskId: string,
  projectId: string,
  data: {
    pathId: string
    pathName: string
    totalLevels: number
    currentLevelNumber: number
    levelName: string
    ruleId: string
    reason: string
  },
  groupId?: string
): Promise<TaskActivity> {
  return logActivity(companyId, {
    companyId,
    taskId,
    projectId,
    type: 'escalation_auto_approve',
    category: 'escalation',
    description: `Level ${data.currentLevelNumber} of ${data.totalLevels}: Task auto-approved`,
    actorId: 'system',
    actorName: 'System',
    actorType: 'system',
    escalationData: {
      pathId: data.pathId,
      pathName: data.pathName,
      totalLevels: data.totalLevels,
      currentLevelNumber: data.currentLevelNumber,
      levelName: data.levelName,
      ruleId: data.ruleId,
      action: 'auto_approve',
      reason: data.reason,
    },
  }, groupId)
}

/**
 * Log when escalation auto-rejects the task
 */
export async function logEscalationAutoReject(
  companyId: string,
  taskId: string,
  projectId: string,
  data: {
    pathId: string
    pathName: string
    totalLevels: number
    currentLevelNumber: number
    levelName: string
    ruleId: string
    reason: string
  },
  groupId?: string
): Promise<TaskActivity> {
  return logActivity(companyId, {
    companyId,
    taskId,
    projectId,
    type: 'escalation_auto_reject',
    category: 'escalation',
    description: `Level ${data.currentLevelNumber} of ${data.totalLevels}: Task auto-rejected`,
    actorId: 'system',
    actorName: 'System',
    actorType: 'system',
    escalationData: {
      pathId: data.pathId,
      pathName: data.pathName,
      totalLevels: data.totalLevels,
      currentLevelNumber: data.currentLevelNumber,
      levelName: data.levelName,
      ruleId: data.ruleId,
      action: 'auto_reject',
      reason: data.reason,
    },
  }, groupId)
}

// ============================================================================
// COMMENT ACTIVITIES
// ============================================================================

export async function logCommentAdded(
  companyId: string,
  taskId: string,
  projectId: string,
  commentId: string,
  commentText: string,
  actorId: string,
  actorName: string,
  groupId?: string
): Promise<TaskActivity> {
  return logActivity(companyId, {
    companyId,
    taskId,
    projectId,
    type: 'comment_added',
    category: 'comment',
    description: 'added a comment',
    actorId,
    actorName,
    actorType: 'user',
    commentData: {
      commentId,
      commentText: commentText.substring(0, 100) + (commentText.length > 100 ? '...' : ''),
    },
  }, groupId)
}

// ============================================================================
// FIELD CHANGE ACTIVITIES
// ============================================================================

/**
 * Format a field value for display in activity description
 */
function formatFieldValue(field: string, value: any): string {
  if (value === null || value === undefined || value === '') {
    return 'none'
  }

  // Date fields - format as "25 Feb 2026"
  if (['dueDate', 'endDate', 'startDate'].includes(field)) {
    try {
      const date = new Date(value)
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch {
      return String(value)
    }
  }

  // Hours - append "h"
  if (field === 'estimatedHours') {
    return `${value}h`
  }

  // Progress - append "%"
  if (field === 'progress') {
    return `${value}%`
  }

  // Priority - capitalize
  if (field === 'priority') {
    return String(value).charAt(0).toUpperCase() + String(value).slice(1)
  }

  // Default
  return String(value)
}

/**
 * Get human-readable label for a field
 */
function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    priority: 'Priority',
    dueDate: 'Due Date',
    endDate: 'Due Date',
    startDate: 'Start Date',
    estimatedHours: 'Estimated Hours',
    taskType: 'Task Type',
    requirementType: 'Requirement Type',
    workflowDefinitionId: 'Approval Line',
    escalationPolicyId: 'Escalation Path',
    progress: 'Progress',
    title: 'title',
    description: 'description',
  }
  return labels[field] || field
}

/**
 * Log a field change on a task
 * Creates a human-readable description like "updated Priority from Medium to High"
 */
export async function logFieldChanged(
  companyId: string,
  taskId: string,
  projectId: string,
  field: string,
  fieldLabel: string,
  oldValue: any,
  newValue: any,
  actorId: string,
  actorName: string,
  groupId?: string
): Promise<TaskActivity> {
  // Sanitize values - Firestore doesn't accept undefined
  const sanitizedOldValue = oldValue === undefined ? null : oldValue
  const sanitizedNewValue = newValue === undefined ? null : newValue

  // Build description based on field type
  let description: string

  // Special handling for title and description - don't show old/new values
  if (field === 'title') {
    description = 'updated the title'
  } else if (field === 'description') {
    description = 'updated the description'
  } else {
    // Standard fields - show old → new
    const oldFormatted = formatFieldValue(field, sanitizedOldValue)
    const newFormatted = formatFieldValue(field, sanitizedNewValue)
    // Use provided fieldLabel if available, otherwise compute from field name
    const label = fieldLabel || getFieldLabel(field)
    description = `updated ${label} from ${oldFormatted} to ${newFormatted}`
  }

  return logActivity(companyId, {
    companyId,
    taskId,
    projectId,
    type: 'field_changed',
    category: 'status',
    description,
    actorId,
    actorName,
    actorType: 'user',
    changes: [{ field, oldValue: sanitizedOldValue, newValue: sanitizedNewValue }],
  }, groupId)
}

// ============================================================================
// ASSIGNMENT ACTIVITIES
// ============================================================================

/**
 * Log an assignment change on a task
 * Handles: task_assigned, task_reassigned, task_unassigned
 */
export async function logAssignmentChanged(
  companyId: string,
  taskId: string,
  projectId: string,
  changeType: 'task_assigned' | 'task_reassigned' | 'task_unassigned',
  actorId: string,
  actorName: string,
  data: {
    fromUserId?: string
    fromUserName?: string
    toUserId?: string
    toUserName?: string
    positionName?: string
  },
  groupId?: string
): Promise<TaskActivity> {
  let description: string

  switch (changeType) {
    case 'task_assigned':
      description = `assigned task to ${data.toUserName || 'Unknown'}`
      if (data.positionName) {
        description += ` (via position: ${data.positionName})`
      }
      break
    case 'task_reassigned':
      description = `reassigned task from ${data.fromUserName || 'Unknown'} to ${data.toUserName || 'Unknown'}`
      break
    case 'task_unassigned':
      description = `removed assignment from ${data.fromUserName || 'Unknown'}`
      break
    default:
      description = 'changed assignment'
  }

  return logActivity(companyId, {
    companyId,
    taskId,
    projectId,
    type: changeType,
    category: 'assignment',
    description,
    actorId,
    actorName,
    actorType: 'user',
    changes: [
      {
        field: 'assignedUserId',
        oldValue: data.fromUserId,
        newValue: data.toUserId,
      }
    ],
  }, groupId)
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get activities for a task
 */
export async function getTaskActivities(
  companyId: string,
  taskId: string,
  options?: {
    category?: TaskActivityCategory
    limit?: number
  },
  groupId?: string
): Promise<TaskActivity[]> {
  try {
    const activitiesRef = getActivitiesCollection(companyId, groupId)
    let q = query(
      activitiesRef,
      where('taskId', '==', taskId),
      orderBy('createdAt', 'desc')
    )

    if (options?.limit) {
      q = query(q, limit(options.limit))
    }

    const snapshot = await getDocs(q)
    let activities = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as TaskActivity[]

    // Filter by category client-side if specified
    if (options?.category) {
      activities = activities.filter(a => a.category === options.category)
    }

    return activities
  } catch (error) {
    console.error('[TaskActivity] Error getting activities:', error)
    return []
  }
}

/**
 * Get paginated activities
 */
export async function getTaskActivitiesPaginated(
  companyId: string,
  queryParams: TaskActivityQuery,
  groupId?: string
): Promise<TaskActivityPage> {
  try {
    const activitiesRef = getActivitiesCollection(companyId, groupId)

    const constraints: any[] = []

    if (queryParams.taskId) {
      constraints.push(where('taskId', '==', queryParams.taskId))
    }

    if (queryParams.projectId) {
      constraints.push(where('projectId', '==', queryParams.projectId))
    }

    constraints.push(orderBy('createdAt', 'desc'))

    const pageSize = queryParams.limit || 20

    const q = query(activitiesRef, ...constraints, limit(pageSize + 1))

    const snapshot = await getDocs(q)
    let activities = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as TaskActivity[]

    // Client-side filtering
    if (queryParams.category) {
      activities = activities.filter(a => a.category === queryParams.category)
    }

    if (queryParams.types && queryParams.types.length > 0) {
      activities = activities.filter(a => queryParams.types!.includes(a.type))
    }

    const hasMore = activities.length > pageSize
    if (hasMore) {
      activities = activities.slice(0, pageSize)
    }

    return {
      activities,
      total: activities.length,
      hasMore,
      nextOffset: hasMore ? (queryParams.offset || 0) + pageSize : undefined,
    }
  } catch (error) {
    console.error('[TaskActivity] Error getting paginated activities:', error)
    return {
      activities: [],
      total: 0,
      hasMore: false,
    }
  }
}

/**
 * Subscribe to real-time activity updates for a task
 */
export function subscribeToTaskActivities(
  companyId: string,
  taskId: string,
  onUpdate: (activities: TaskActivity[]) => void,
  groupId?: string
): Unsubscribe {
  const activitiesRef = getActivitiesCollection(companyId, groupId)
  const q = query(
    activitiesRef,
    where('taskId', '==', taskId),
    orderBy('createdAt', 'desc'),
    limit(50)
  )

  return onSnapshot(q, (snapshot) => {
    const activities = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as TaskActivity[]

    onUpdate(activities)
  })
}

/**
 * Get activity summary for a task
 */
export async function getTaskActivitySummary(
  companyId: string,
  taskId: string,
  groupId?: string
): Promise<TaskActivitySummary> {
  const activities = await getTaskActivities(companyId, taskId, undefined, groupId)

  const categoryBreakdown: Record<TaskActivityCategory, number> = {
    lifecycle: 0,
    assignment: 0,
    status: 0,
    approval: 0,
    escalation: 0,
    comment: 0,
  }

  for (const activity of activities) {
    categoryBreakdown[activity.category]++
  }

  // Find latest approval and escalation status
  let approvalSummary: TaskActivitySummary['approvalSummary']
  let escalationSummary: TaskActivitySummary['escalationSummary']

  const latestApproval = activities.find(a => a.category === 'approval' && a.approvalData)
  if (latestApproval?.approvalData) {
    const isCompleted = latestApproval.type === 'approval_workflow_completed'
    const isRejected = latestApproval.type === 'approval_workflow_rejected'

    approvalSummary = {
      currentStage: latestApproval.approvalData.currentStageNumber,
      totalStages: latestApproval.approvalData.totalStages,
      status: isCompleted ? 'approved' : isRejected ? 'rejected' : 'pending',
    }
  }

  const latestEscalation = activities.find(a => a.category === 'escalation' && a.escalationData)
  if (latestEscalation?.escalationData) {
    const isCompleted = latestEscalation.type === 'escalation_auto_approve' ||
      latestEscalation.type === 'escalation_auto_reject'

    escalationSummary = {
      currentLevel: latestEscalation.escalationData.currentLevelNumber,
      totalLevels: latestEscalation.escalationData.totalLevels,
      status: isCompleted ? 'completed' : 'active',
    }
  }

  return {
    taskId,
    totalActivities: activities.length,
    lastActivityAt: activities[0]?.createdAt,
    categoryBreakdown,
    approvalSummary,
    escalationSummary,
  }
}
