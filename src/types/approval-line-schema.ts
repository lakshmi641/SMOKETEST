/**
 * Approval Line & Escalation Path Schema
 *
 * Defines reusable approval lines and escalation paths that can be
 * linked to workflows. Supports both organization hierarchy-based
 * and custom approver configurations.
 */

import { ApprovalAuthority } from './org-schema'

// ============================================================================
// APPROVAL LINE TYPES
// ============================================================================

/**
 * Approval Line - Reusable approval chain definition
 * Can follow org hierarchy, use custom approvers, or mix both
 */
export interface ApprovalLine {
  id: string
  companyId: string
  name: string
  description?: string
  category?: string // 'purchase', 'hr', 'finance', 'operations', etc.

  // Resolution Strategy
  resolutionType: ApprovalResolutionType

  // Hierarchy-based configuration (follows org chart)
  hierarchyConfig?: HierarchyConfig

  // Custom approvers (outside hierarchy)
  customApprovers?: CustomApprover[]

  // Multi-stage approval configuration
  stages: ApprovalStageDefinition[]

  // Escalation Configuration (workflow-level fallback)
  escalationPathId?: string // Default escalation path for all stages
  defaultTimeoutHours?: number // Default timeout for stages

  // Global Settings
  settings: ApprovalLineSettings

  // Lifecycle
  status: ApprovalLineStatus
  version: number
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy?: string
}

export type ApprovalResolutionType = 'hierarchy' | 'custom' | 'mixed'

export type ApprovalLineStatus = 'draft' | 'active' | 'inactive' | 'archived'

export interface ApprovalLineSettings {
  allowDelegation: boolean
  skipIfSameUser: boolean // Skip if requester = approver
  requireComments: boolean // Require comments on approval/rejection
  allowPartialApproval: boolean // Allow approving with conditions
  notifyOnAssignment: boolean
  notifyOnCompletion: boolean
  defaultTimeoutHours: number
  sendReminders: boolean
  reminderIntervalHours: number
}

// ============================================================================
// HIERARCHY CONFIGURATION
// ============================================================================

export interface HierarchyConfig {
  // Starting point for hierarchy traversal
  startFrom: HierarchyStartPoint
  startPositionId?: string // If startFrom is 'position'
  startDepartmentId?: string // If startFrom is 'department_head'

  // How far to traverse
  levelsUp: number // Number of levels up the chain (1 = direct manager)

  // Stop conditions
  stopAtLevel?: number // Stop at org level N (e.g., level 1 = Director)
  stopAtPosition?: string // Stop at specific position ID
  stopAtDepartment?: string // Stop at department boundary

  // Authority requirements
  requireApprovalAuthority?: keyof ApprovalAuthority
  minBudgetAuthority?: number // Position must have at least this budget limit

  // Budget-based routing
  budgetThresholds?: BudgetThreshold[]

  // Vacant position handling
  skipVacantPositions: boolean
  vacantPositionFallback: 'skip' | 'escalate_next' | 'notify_admin' | 'fail'
}

export type HierarchyStartPoint =
  | 'requester' // Start from requester's position
  | 'position' // Start from specific position
  | 'department_head' // Start from department head
  | 'workspace_owner' // Start from workspace owner
  | 'project_manager' // Start from project manager

export interface BudgetThreshold {
  id: string
  minAmount: number
  maxAmount: number | null // null = unlimited
  levelsUp: number // How many levels for this amount
  additionalApprovers?: string[] // Position IDs for extra approval
  requireAllAdditional: boolean // All additional must approve vs any
}

// ============================================================================
// CUSTOM APPROVERS
// ============================================================================

export interface CustomApprover {
  id: string
  type: CustomApproverType
  value: string // userId, positionId, roleId, or email
  name: string // Display name for UI
  order: number // Order in approval chain

  // Settings
  isRequired: boolean // Must approve vs optional
  canDelegate: boolean
  canBeSkipped: boolean // Can be skipped if unavailable

  // Conditions
  condition?: ApprovalCondition // Only include if condition is met
}

export type CustomApproverType =
  | 'user' // Specific user
  | 'position' // Anyone in this position
  | 'role' // Anyone with this role
  | 'department' // Department head
  | 'external' // External email (for external approvals)
  | 'dynamic' // Dynamic expression (e.g., {{project.owner}})

// ============================================================================
// APPROVAL STAGES
// ============================================================================

export interface ApprovalStageDefinition {
  id: string
  name: string
  description?: string
  order: number // Stage sequence (1, 2, 3...)
  type: ApprovalStageType // How approvers in THIS stage work

  // Who approves at this stage
  approverSource: ApproverSource
  hierarchyLevel?: number // If hierarchy: levels up from requester
  customApproverIds?: string[] // If custom: specific approver IDs from customApprovers
  positionIds?: string[] // Specific positions

  // Parallel stage settings
  requiredApprovals: number // For parallel: how many must approve (0 = all)
  allowPartialCompletion: boolean // Move to next stage with partial approvals

  // SLA & Escalation
  timeoutHours: number
  escalationPathId?: string // Link to escalation path
  reminderHours?: number[] // Send reminders at these intervals

  // Routing
  onApprove: StageAction
  onReject: StageAction
  onTimeout: StageAction

  // Conditional execution
  condition?: ApprovalCondition // Skip stage if condition not met
  skipReason?: string // Reason shown when stage is skipped
}

export type ApprovalStageType = 'sequential' | 'parallel'

export type ApproverSource = 'hierarchy' | 'custom' | 'mixed' | 'dynamic'

export type StageAction =
  | 'next_stage' // Proceed to next stage
  | 'previous_stage' // Go back to previous stage
  | 'complete' // Complete the approval process
  | 'reject_all' // Reject the entire approval
  | 'conditional' // Use conditions to determine action
  | 'specific_stage' // Jump to specific stage (requires targetStageId)

// ============================================================================
// CONDITIONS
// ============================================================================

export interface ApprovalCondition {
  id?: string
  type: 'simple' | 'compound'

  // Simple condition
  field?: string // e.g., "amount", "category", "priority"
  operator?: ConditionOperator
  value?: unknown

  // Compound condition
  logic?: 'and' | 'or'
  conditions?: ApprovalCondition[]
}

export type ConditionOperator =
  | 'eq' // equals
  | 'neq' // not equals
  | 'gt' // greater than
  | 'gte' // greater than or equal
  | 'lt' // less than
  | 'lte' // less than or equal
  | 'in' // value in array
  | 'nin' // value not in array
  | 'contains' // string contains
  | 'starts_with' // string starts with
  | 'ends_with' // string ends with
  | 'is_empty' // field is empty/null
  | 'is_not_empty' // field is not empty/null

// ============================================================================
// ESCALATION PATH TYPES
// ============================================================================

/**
 * Escalation Path - Reusable escalation chain definition
 * Defines what happens when approvals timeout or are rejected
 */
export interface EscalationPath {
  id: string
  companyId: string
  name: string
  description?: string
  category?: string

  // Resolution Strategy
  resolutionType: EscalationResolutionType

  // Hierarchy-based escalation
  hierarchyConfig?: EscalationHierarchyConfig

  // Custom escalation targets
  customTargets?: EscalationTarget[]

  // Escalation rules
  rules: EscalationRule[]

  // Settings
  settings: EscalationPathSettings

  // Lifecycle
  status: EscalationPathStatus
  version: number
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy?: string
}

export type EscalationResolutionType = 'hierarchy' | 'custom' | 'mixed'

export type EscalationPathStatus = 'draft' | 'active' | 'inactive' | 'archived'

export interface EscalationPathSettings {
  maxEscalations: number // Max times to escalate before final action
  finalAction: EscalationFinalAction
  notifyOriginalApprover: boolean // Notify original approver on escalation
  notifyRequester: boolean // Notify requester on escalation
  trackEscalationHistory: boolean
  notifyOnFinalAction: boolean // Send notification when final action is taken
}

export type EscalationFinalAction =
  | 'auto_approve'
  | 'auto_reject'
  | 'notify_admin'
  | 'cancel'
  | 'none'

export interface EscalationHierarchyConfig {
  escalateToManager: boolean // Escalate to next level up in reporting chain
  maxLevels: number // Max escalation levels
  skipVacantPositions: boolean // Auto-skip to next level if vacant
  requireApprovalAuthority?: keyof ApprovalAuthority
}

export interface EscalationTarget {
  id: string
  level: number // Escalation level (1, 2, 3...)
  type: EscalationTargetType
  value?: string // If not hierarchy_next
  name: string // Display name
  notificationChannels: NotificationChannel[]
}

export type EscalationTargetType =
  | 'user' // Specific user
  | 'position' // Specific position
  | 'role' // Specific role
  | 'hierarchy_next' // Next level in hierarchy
  | 'department_head' // Department head
  | 'admin' // System admin

export type NotificationChannel = 'in_app' | 'push' | 'email' | 'sms'

// ============================================================================
// ESCALATION RULES
// ============================================================================

export interface EscalationRule {
  id: string
  name?: string
  order: number // Rule evaluation order

  // Trigger conditions
  triggerType: EscalationTriggerType
  triggerAfterHours?: number // For time-based triggers
  triggerAfterReminders?: number // Escalate after N reminders
  triggerCondition?: ApprovalCondition // Custom condition

  // Action to take
  action: EscalationAction
  targetLevel?: number // Which escalation level to go to
  targetUserId?: string // Specific user (for reassign)
  targetPositionId?: string // Specific position (for reassign)

  // Notification
  notificationChannels: NotificationChannel[]
  messageTemplate?: string // Custom message template
  includeApprovalHistory: boolean

  // Settings
  repeatIfNotActioned: boolean // Repeat this rule if still not actioned
  repeatIntervalHours?: number
  maxRepeats?: number
}

export type EscalationTriggerType =
  | 'time' // After X hours
  | 'reminder_count' // After X reminders sent
  | 'rejection' // On rejection
  | 'no_response' // No response at all
  | 'partial_approval' // Some approved, some pending
  | 'condition' // Custom condition met

export type EscalationAction =
  | 'notify' // Send notification only
  | 'remind' // Send reminder to current approvers
  | 'reassign' // Reassign to different user/position
  | 'escalate' // Escalate to next level
  | 'add_approver' // Add additional approver
  | 'auto_approve' // Automatically approve
  | 'auto_reject' // Automatically reject
  | 'cancel' // Cancel the approval request

// ============================================================================
// RESOLUTION CONTEXT & RESULTS
// ============================================================================

/**
 * Context provided when resolving an approval line to actual approvers
 */
export interface ApprovalContext {
  // Requester info
  requesterId: string
  requesterPositionId?: string
  requesterDepartmentId?: string

  // Resource being approved
  resourceType: ApprovalResourceType
  resourceId: string
  resourceTitle?: string

  // Approval-specific data
  amount?: number // For budget-based routing
  category?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'

  // Additional context
  workspaceId?: string
  projectId?: string
  metadata?: Record<string, unknown>
}

export type ApprovalResourceType =
  | 'purchase_order'
  | 'expense_report'
  | 'leave_request'
  | 'document'
  | 'project'
  | 'task'
  | 'change_request'
  | 'custom'

/**
 * Result of resolving an approval line to actual approvers
 */
export interface ResolvedApprover {
  userId: string
  userName?: string
  userEmail?: string
  positionId?: string
  positionTitle?: string
  departmentId?: string
  departmentName?: string

  // Resolution metadata
  level: number // Level in approval chain
  stageId: string // Which stage this approver belongs to
  stageOrder: number
  source: ApproverSource
  orderInStage: number // Order within the stage

  // Delegation info
  isDelegated: boolean
  delegatedFrom?: string // Original user ID
  delegatedFromPosition?: string
  delegationId?: string

  // Settings inherited from stage
  isRequired: boolean
  canDelegate: boolean
  timeoutHours: number
}

/**
 * Full resolution result for an approval line
 */
export interface ApprovalLineResolution {
  approvalLineId: string
  approvalLineName: string
  resolvedAt: string

  // Resolved stages with approvers
  stages: ResolvedApprovalStage[]

  // Total counts
  totalApprovers: number
  totalStages: number

  // Warnings/issues
  warnings: ResolutionWarning[]
  hasVacantPositions: boolean
  hasDelegations: boolean
}

export interface ResolvedApprovalStage {
  stageId: string
  stageName: string
  stageOrder: number
  stageType: ApprovalStageType
  requiredApprovals: number
  approvers: ResolvedApprover[]
  timeoutHours: number
  escalationPathId?: string
  wasSkipped: boolean
  skipReason?: string
}

export interface ResolutionWarning {
  type: 'vacant_position' | 'delegation_active' | 'user_inactive' | 'no_approvers'
  message: string
  stageId?: string
  positionId?: string
  userId?: string
}

// ============================================================================
// APPROVAL INSTANCE (Runtime)
// ============================================================================

/**
 * Instance of an approval line being executed
 */
export interface ApprovalInstance {
  id: string
  companyId: string
  approvalLineId: string
  approvalLineName: string
  approvalLineVersion: number

  // What's being approved
  resourceType: ApprovalResourceType
  resourceId: string
  resourceTitle: string
  resourceNumber?: string | number // e.g. "PA-1"
  projectId?: string // Top-level for easy querying and linking

  // Context snapshot (captured at creation)
  context: ApprovalContext
  resolution: ApprovalLineResolution

  // Current state
  status: ApprovalInstanceStatus
  currentStageId?: string
  currentStageOrder?: number

  // Tracking
  stageInstances: ApprovalStageInstance[]

  // Timing
  startedAt: string
  dueAt?: string
  completedAt?: string

  // Final result
  finalDecision?: 'approved' | 'rejected' | 'cancelled' | 'expired'
  finalDecisionBy?: string
  finalDecisionAt?: string
  finalComments?: string

  // Audit
  createdBy: string
  createdAt: string
  updatedAt: string

  // System approval fields (for Reporter Approval, etc.)
  isSystemApproval?: boolean
  systemApprovalType?: 'reporter_approval'
}

export type ApprovalInstanceStatus =
  | 'pending' // Not yet started
  | 'in_progress' // Active, waiting for approvals
  | 'approved' // All stages approved
  | 'rejected' // Rejected at some stage
  | 'cancelled' // Cancelled by requester or admin
  | 'expired' // Timed out without completion

export interface ApprovalStageInstance {
  id: string
  stageDefinitionId: string
  stageName: string
  stageOrder: number
  stageType: ApprovalStageType

  // State
  status: ApprovalStageStatus
  requiredApprovals: number
  currentApprovals: number
  currentRejections: number

  // Approvers for this stage
  assignedApprovers: StageApproverInstance[]

  // Timing
  timeoutHours?: number
  startedAt?: string
  dueAt?: string
  completedAt?: string

  // Escalation tracking
  escalationLevel: number
  lastEscalatedAt?: string
  escalationHistory: EscalationHistoryEntry[]

  // Result
  decision?: 'approved' | 'rejected' | 'skipped'
  decisionReason?: string
}

export type ApprovalStageStatus =
  | 'pending' // Not yet active
  | 'active' // Waiting for approvals
  | 'approved' // Stage approved
  | 'rejected' // Stage rejected
  | 'skipped' // Stage was skipped (condition not met)
  | 'escalated' // Currently escalated

export interface StageApproverInstance {
  userId: string
  userName: string
  positionId?: string
  positionTitle?: string

  // State
  status: ApproverStatus
  assignedAt: string
  respondedAt?: string

  // Response
  decision?: 'approved' | 'rejected'
  comments?: string
  attachments?: string[]

  // Delegation
  isDelegated: boolean
  originalUserId?: string

  // Escalation
  wasEscalatedTo: boolean
  escalatedFromLevel?: number
}

export type ApproverStatus =
  | 'pending' // Waiting for response
  | 'approved' // Approved
  | 'rejected' // Rejected
  | 'delegated' // Delegated to someone else
  | 'skipped' // Skipped (e.g., same as requester)
  | 'expired' // Timed out

export interface EscalationHistoryEntry {
  level: number
  triggeredAt: string
  triggerType: EscalationTriggerType
  action: EscalationAction
  targetUserId?: string
  targetPositionId?: string
  notificationsSent: NotificationChannel[]
  notes?: string
}

// ============================================================================
// FORM DATA TYPES (For UI)
// ============================================================================

export interface CreateApprovalLineData {
  name: string
  description?: string
  category?: string
  resolutionType: ApprovalResolutionType
  hierarchyConfig?: Partial<HierarchyConfig>
  customApprovers?: Omit<CustomApprover, 'id'>[]
  stages: Omit<ApprovalStageDefinition, 'id'>[]
  settings: Partial<ApprovalLineSettings>
  status?: ApprovalLineStatus
  escalationPathId?: string // Default escalation path for all stages
}

export interface UpdateApprovalLineData extends Partial<CreateApprovalLineData> {
  status?: ApprovalLineStatus
}

export interface CreateEscalationPathData {
  name: string
  description?: string
  category?: string
  resolutionType: EscalationResolutionType
  hierarchyConfig?: Partial<EscalationHierarchyConfig>
  customTargets?: Omit<EscalationTarget, 'id'>[]
  rules: Omit<EscalationRule, 'id'>[]
  settings: Partial<EscalationPathSettings>
  status?: EscalationPathStatus
}

export interface UpdateEscalationPathData extends Partial<CreateEscalationPathData> {
  status?: EscalationPathStatus
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

export const DEFAULT_APPROVAL_LINE_SETTINGS: ApprovalLineSettings = {
  allowDelegation: true,
  skipIfSameUser: true,
  requireComments: false,
  allowPartialApproval: false,
  notifyOnAssignment: true,
  notifyOnCompletion: true,
  defaultTimeoutHours: 48,
  sendReminders: true,
  reminderIntervalHours: 24,
}

export const DEFAULT_ESCALATION_PATH_SETTINGS: EscalationPathSettings = {
  maxEscalations: 3,
  finalAction: 'notify_admin',
  notifyOriginalApprover: true,
  notifyRequester: true,
  trackEscalationHistory: true,
  notifyOnFinalAction: true,
}

export const DEFAULT_HIERARCHY_CONFIG: HierarchyConfig = {
  startFrom: 'requester',
  levelsUp: 1,
  skipVacantPositions: true,
  vacantPositionFallback: 'escalate_next',
}

export const DEFAULT_ESCALATION_HIERARCHY_CONFIG: EscalationHierarchyConfig = {
  escalateToManager: true,
  maxLevels: 3,
  skipVacantPositions: true,
}
