/**
 * Workflow Validation Schema
 *
 * Types for validating approval lines and escalation paths
 * against company org structure. Checks if required positions
 * exist and are filled.
 */

// ============================================================================
// VALIDATION RESULT TYPES
// ============================================================================

/**
 * Overall validation status for a workflow
 */
export type ValidationStatus = 'valid' | 'warning' | 'error'

/**
 * Issue type categories
 */
export type ValidationIssueType =
  | 'position_missing'    // Position no longer exists in company
  | 'position_vacant'     // Position exists but no one is assigned
  | 'user_missing'        // Specific user no longer exists or is inactive
  | 'user_inactive'       // User exists but is inactive
  | 'hierarchy_broken'    // Hierarchy level doesn't exist
  | 'approval_line_deleted' // Referenced approval line was deleted
  | 'escalation_path_deleted' // Referenced escalation path was deleted

/**
 * Severity of the issue
 */
export type ValidationIssueSeverity = 'warning' | 'error'

/**
 * Individual validation issue
 */
export interface ValidationIssue {
  id: string
  type: ValidationIssueType
  severity: ValidationIssueSeverity
  message: string

  // Context
  positionId?: string
  positionTitle?: string
  userId?: string
  userName?: string
  stageId?: string
  stageName?: string
  ruleId?: string
  ruleName?: string
  hierarchyLevel?: number
}

/**
 * Complete validation result for an approval line or escalation path
 */
export interface ValidationResult {
  status: ValidationStatus
  isSelectable: boolean  // Can be selected for use
  issues: ValidationIssue[]
  validatedAt: string

  // Summary counts
  errorCount: number
  warningCount: number

  // Detailed breakdown
  validStages?: number
  totalStages?: number
  validRules?: number
  totalRules?: number
}

// ============================================================================
// APPROVAL LINE VALIDATION
// ============================================================================

/**
 * Approval line with validation result
 */
export interface ApprovalLineWithValidation {
  id: string
  companyId?: string
  name: string
  description?: string
  category?: string
  stageCount: number
  status: 'draft' | 'active' | 'inactive' | 'archived'
  resolutionType?: 'hierarchy' | 'custom' | 'mixed'
  version?: number
  validation: ValidationResult
  // System line fields
  isSystemLine?: boolean
  systemType?: 'reporter_approval' | 'manager_approval' | 'skip_level_approval'
  createdBy?: string
  createdAt?: string
  updatedAt?: string
  stages?: unknown[]
  settings?: Record<string, unknown>
}

/**
 * Stage validation result
 */
export interface StageValidationResult {
  stageId: string
  stageName: string
  stageOrder: number
  status: ValidationStatus
  issues: ValidationIssue[]
  approverCount: number
  validApproverCount: number
}

// ============================================================================
// ESCALATION PATH VALIDATION
// ============================================================================

/**
 * Escalation path with validation result
 */
export interface EscalationPathWithValidation {
  id: string
  name: string
  description?: string
  category?: string
  ruleCount: number
  status: 'draft' | 'active' | 'inactive' | 'archived'
  resolutionType?: 'hierarchy' | 'custom' | 'mixed'
  finalAction?: 'auto_approve' | 'auto_reject' | 'notify_admin' | 'cancel' | 'none'
  validation: ValidationResult
}

/**
 * Rule validation result
 */
export interface RuleValidationResult {
  ruleId: string
  ruleName?: string
  ruleOrder: number
  status: ValidationStatus
  issues: ValidationIssue[]
  hasValidTarget: boolean
}

// ============================================================================
// BATCH VALIDATION
// ============================================================================

/**
 * Batch validation request
 */
export interface BatchValidationRequest {
  companyId: string
  approvalLineIds?: string[]
  escalationPathIds?: string[]
  validateAll?: boolean
}

/**
 * Batch validation result
 */
export interface BatchValidationResult {
  companyId: string
  validatedAt: string
  approvalLines: ApprovalLineWithValidation[]
  escalationPaths: EscalationPathWithValidation[]
  summary: {
    totalApprovalLines: number
    validApprovalLines: number
    warningApprovalLines: number
    errorApprovalLines: number
    totalEscalationPaths: number
    validEscalationPaths: number
    warningEscalationPaths: number
    errorEscalationPaths: number
  }
}

// ============================================================================
// PROJECT WORKFLOW VALIDATION
// ============================================================================

/**
 * Validation result for a project's assigned workflows
 */
export interface ProjectWorkflowValidation {
  projectId: string
  projectName: string
  validatedAt: string

  // Assigned workflows
  approvalLine?: {
    id: string
    name: string
    validation: ValidationResult
  }
  escalationPath?: {
    id: string
    name: string
    validation: ValidationResult
  }

  // Overall status
  hasIssues: boolean
  issueCount: number
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Position validation info
 */
export interface PositionValidationInfo {
  positionId: string
  exists: boolean
  title?: string
  departmentId?: string
  departmentName?: string
  hasAssignee: boolean
  assigneeId?: string
  assigneeName?: string
  assigneeActive?: boolean
}

/**
 * User validation info
 */
export interface UserValidationInfo {
  userId: string
  exists: boolean
  name?: string
  email?: string
  isActive: boolean
  positionId?: string
  positionTitle?: string
}

/**
 * Hierarchy validation info
 */
export interface HierarchyValidationInfo {
  companyId: string
  maxLevel: number
  levelNames: Record<number, string>
}
