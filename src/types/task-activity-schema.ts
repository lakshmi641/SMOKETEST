/**
 * Task Activity Schema
 *
 * Comprehensive activity logging for tasks including lifecycle events,
 * approval stage progression, and escalation level tracking.
 */

// ============================================================================
// ACTIVITY CATEGORIES
// ============================================================================

export type TaskActivityCategory =
  | 'lifecycle'    // Task creation, start, completion, cancellation
  | 'assignment'   // Task assignment changes
  | 'status'       // Status and field changes
  | 'approval'     // Approval workflow activities
  | 'escalation'   // Escalation activities
  | 'comment'      // Comments on tasks

// ============================================================================
// ACTIVITY TYPES
// ============================================================================

export type TaskActivityType =
  // Lifecycle
  | 'task_created'
  | 'time_logged'
  | 'task_started'
  | 'task_completed'
  | 'task_cancelled'
  | 'task_reopened'
  | 'task_on_hold'
  | 'task_resumed'
  // Assignment
  | 'task_assigned'
  | 'task_reassigned'
  | 'task_unassigned'
  // Status
  | 'status_changed'
  | 'priority_changed'
  | 'due_date_changed'
  | 'field_changed'
  // Approval - Full progression tracking
  | 'approval_workflow_started'     // Workflow begins
  | 'approval_stage_entered'        // Entered a new stage
  | 'approval_stage_pending'        // Waiting for approver
  | 'approval_decision'             // Approver made decision
  | 'approval_stage_completed'      // Stage finished
  | 'approval_workflow_completed'   // All stages done - approved
  | 'approval_workflow_rejected'    // Rejected at some stage
  // Escalation - Full progression tracking
  | 'escalation_started'            // Escalation begins
  | 'escalation_level_entered'      // Entered a new level
  | 'escalation_notification_sent'  // Notification sent at this level
  | 'escalation_level_completed'    // Level action completed
  | 'escalation_reassign'           // Task reassigned
  | 'escalation_auto_approve'       // Auto-approved
  | 'escalation_auto_reject'        // Auto-rejected
  // Comment
  | 'comment_added'
  | 'comment_edited'
  | 'comment_deleted'

// ============================================================================
// ACTOR TYPES
// ============================================================================

export type ActivityActorType = 'user' | 'system'

// ============================================================================
// MAIN ACTIVITY INTERFACE
// ============================================================================

export interface TaskActivity {
  id: string
  companyId: string
  taskId: string
  projectId: string

  // Activity info
  type: TaskActivityType
  category: TaskActivityCategory
  description: string

  // Actor (who performed the action)
  actorId: string
  actorName: string
  actorType: ActivityActorType
  actorPosition?: string
  actorEmail?: string

  // Change details (for status/field changes)
  changes?: ActivityChange[]

  // Approval-specific - ENHANCED for progression tracking
  approvalData?: ApprovalActivityData

  // Escalation-specific - ENHANCED for progression tracking
  escalationData?: EscalationActivityData

  // Comment-specific
  commentData?: CommentActivityData

  // Custom metadata
  metadata?: Record<string, any>

  // Timestamps
  createdAt: string
}

// ============================================================================
// CHANGE TRACKING
// ============================================================================

export interface ActivityChange {
  field: string
  fieldLabel?: string
  oldValue?: unknown
  newValue?: unknown
  oldDisplayValue?: string
  newDisplayValue?: string
}

// ============================================================================
// APPROVAL ACTIVITY DATA
// ============================================================================

export interface ApprovalActivityData {
  instanceId: string
  workflowId: string
  workflowName: string

  // Stage progression
  totalStages: number
  currentStageNumber: number  // e.g., 2 (meaning "Stage 2 of 3")
  stageId: string
  stageName: string

  // Decision details
  decision?: 'approved' | 'rejected'
  comments?: string

  // Pending approver info (for stage_entered/stage_pending)
  pendingApproverId?: string
  pendingApproverName?: string
  pendingApproverPosition?: string
  pendingApproverEmail?: string

  // Approver info (for decision)
  approverPosition?: string

  // Timing
  stageEnteredAt?: string
  stageCompletedAt?: string
  timeInStage?: number  // milliseconds

  // System approval flag (for Reporter Approval)
  isSystemApproval?: boolean
}

// ============================================================================
// ESCALATION ACTIVITY DATA
// ============================================================================

export interface EscalationActivityData {
  pathId: string
  pathName: string

  // Level progression
  totalLevels: number
  currentLevelNumber: number  // e.g., 2 (meaning "Level 2 of 3")
  levelName: string
  ruleId: string

  // Action details
  action: EscalationActionType

  // Target info
  targetUserId?: string
  targetUserName?: string
  targetPosition?: string
  targetEmail?: string

  // From info (for reassign)
  fromUserId?: string
  fromUserName?: string

  // Escalation reason
  reason?: string  // e.g., "Task overdue by 2 hours", "Previous level timeout"

  // Timing
  levelEnteredAt?: string
  levelCompletedAt?: string
  timeInLevel?: number  // milliseconds
}

export type EscalationActionType =
  | 'notify'
  | 'remind'
  | 'escalate'
  | 'reassign'
  | 'auto_approve'
  | 'auto_reject'

// ============================================================================
// COMMENT ACTIVITY DATA
// ============================================================================

export interface CommentActivityData {
  commentId: string
  commentText?: string
  parentCommentId?: string
  isReply?: boolean
}

// ============================================================================
// QUERY/FILTER TYPES
// ============================================================================

export interface TaskActivityQuery {
  companyId: string
  taskId?: string
  projectId?: string
  category?: TaskActivityCategory
  types?: TaskActivityType[]
  actorId?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}

export interface TaskActivityPage {
  activities: TaskActivity[]
  total: number
  hasMore: boolean
  nextOffset?: number
}

// ============================================================================
// ACTIVITY SUMMARY
// ============================================================================

export interface TaskActivitySummary {
  taskId: string
  totalActivities: number
  lastActivityAt?: string
  categoryBreakdown: Record<TaskActivityCategory, number>
  approvalSummary?: {
    currentStage: number
    totalStages: number
    status: 'pending' | 'approved' | 'rejected'
  }
  escalationSummary?: {
    currentLevel: number
    totalLevels: number
    status: 'active' | 'completed'
  }
}

// ============================================================================
// CREATE ACTIVITY INPUT
// ============================================================================

export type CreateTaskActivityInput = Omit<TaskActivity, 'id' | 'createdAt'>
