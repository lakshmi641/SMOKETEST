// Workflow Schema for Advanced Approvals and Escalations
// Supports custom approval paths, escalations, and workflow automation

import { ApprovalAuthority } from './org-schema'
import { ApprovalInstance } from './approval-line-schema'

/**
 * WorkflowDefinition - Template defining a sequence of steps
 * Used for approvals, notifications, and actions
 */
export interface WorkflowDefinition {
  id: string
  companyId: string
  name: string // e.g., "High Value Procurement", "Client Design Review"
  description?: string
  category?: string // 'approval', 'review', 'onboarding', etc.
  bpmnXml?: string // Raw BPMN 2.0 XML content

  // Linked Master Data
  approvalLineId?: string // Link to ApprovalLine for approver resolution
  escalationPathId?: string // Link to EscalationPath for SLA handling

  // Trigger configuration
  triggerType: 'manual' | 'automatic' | 'scheduled'
  triggerCondition?: WorkflowTriggerCondition // e.g., "budget > $10k"
  triggerSchedule?: string // Cron expression for scheduled triggers

  // Workflow steps
  steps: WorkflowStep[]

  // VERSION MANAGEMENT
  version: number // Current version number
  versionHistory?: WorkflowVersion[]
  latestPublishedVersion?: number
  isDraft: boolean // True if this is a draft version

  // LIFECYCLE STATUS
  status: 'draft' | 'pending_review' | 'active' | 'inactive' | 'archived' | 'deleted'
  statusChangedAt?: string
  statusChangedBy?: string

  // DEPLOYMENT STATE
  isDeployed: boolean
  deploymentId?: string // Flowable deployment ID
  deployedVersion?: number
  deployedAt?: string
  deployedBy?: string

  // SHARING & VISIBILITY
  visibility: 'private' | 'workspace' | 'company'
  sharedWith?: WorkflowShare[]
  allowCopy: boolean // Allow others to copy/fork

  // OWNERSHIP
  ownerId: string // User who created
  ownerWorkspaceId?: string // Workspace it belongs to
  maintainers?: string[] // Users who can edit

  // USAGE TRACKING
  usageCount?: number
  lastUsedAt?: string

  // Legacy compatibility
  isActive: boolean // Deprecated: use status instead

  // Timestamps
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy?: string
}

/**
 * WorkflowVersion - Snapshot of a workflow at a specific version
 */
export interface WorkflowVersion {
  version: number
  bpmnXml: string
  steps: WorkflowStep[]
  approvalLineId?: string
  escalationPathId?: string
  createdAt: string
  createdBy: string
  changeNotes?: string
  status: 'draft' | 'published' | 'deprecated'
}

/**
 * WorkflowShare - Sharing configuration for a workflow
 */
export interface WorkflowShare {
  type: 'user' | 'workspace' | 'role'
  targetId: string
  permission: 'view' | 'use' | 'edit' | 'admin'
  sharedAt: string
  sharedBy: string
}

/**
 * WorkflowTriggerCondition - Condition for automatic workflow triggering
 */
export interface WorkflowTriggerCondition {
  // Attribute path to evaluate (e.g., "project.budget", "task.priority")
  attribute: string

  // Comparison operator
  operator: 'lte' | 'gte' | 'eq' | 'ne' | 'contains' | 'in'

  // Value to compare against
  value: any
}

/**
 * WorkflowStep - A single unit of work in a workflow
 */
export interface WorkflowStep {
  id: string
  name: string // e.g., "Internal Review", "Client Approval"
  description?: string
  order: number
  type: 'approval' | 'notification' | 'action'

  // Who is responsible?
  assigneeSelector: AssigneeSelector

  // Configuration
  requiredApprovals: number // e.g., 1 of 3 (for parallel approvals)
  canReject: boolean

  // SLA & Escalation
  timeoutHours: number // e.g., 48 hours
  escalationPolicyId?: string

  // Dependencies (steps that must complete before this one)
  dependsOn: string[] // Step IDs

  // Parallel execution
  executeInParallel: boolean // If true, can run with other steps at same order
}

/**
 * AssigneeSelector - Defines who should be assigned to a workflow step
 */
export interface AssigneeSelector {
  type: 'role' | 'position' | 'user' | 'relation' | 'external'
  value: string // Role ID, Position ID, User ID, or "manager", "client_contact"

  // For relation type
  relationType?: 'manager' | 'skip_level' | 'project_owner' | 'workspace_spoc'

  // For external type (e.g., client contacts)
  externalContactId?: string
  externalEmail?: string
}

/**
 * EscalationPolicy - Rules for what happens when a step breaches its SLA
 */
export interface EscalationPolicy {
  id: string
  companyId: string
  name: string
  description?: string

  // Escalation rules (evaluated in order)
  rules: EscalationRule[]

  // Status
  isActive: boolean

  // Timestamps
  createdAt: string
  updatedAt: string
  createdBy: string
}

/**
 * EscalationRule - A single escalation action
 */
export interface EscalationRule {
  // When to trigger (hours after step started/overdue)
  triggerAfterHours: number // e.g., 48 (2 days overdue)

  // What action to take
  action: 'notify' | 'reassign' | 'auto_approve' | 'auto_reject' | 'escalate'

  // Who to escalate to (if action is 'reassign' or 'escalate')
  targetSelector?: AssigneeSelector

  // Notification message template
  messageTemplate?: string

  // Order (rules are evaluated in order)
  order: number
}

/**
 * WorkflowInstance - A running instance of a workflow for a specific resource
 */
export interface WorkflowInstance {
  id: string
  companyId: string
  workflowDefinitionId: string

  // Flowable Integration
  flowableProcessInstanceId?: string  // Flowable's process instance ID
  flowableDeploymentId?: string       // Flowable deployment ID
  flowableProcessDefinitionKey?: string

  // Resource this workflow is for
  resourceType: 'project' | 'task' | 'budget' | 'document' | 'custom'
  resourceId: string

  // Current state
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'cancelled' | 'failed'
  currentStepId?: string
  currentStepDueAt?: string

  // Step instances
  stepInstances: WorkflowStepInstance[]

  // Process variables
  variables?: Record<string, unknown>
  completionVariables?: Record<string, unknown>

  // Error information (for failed workflows)
  error?: {
    code: string
    message: string
    timestamp: string
  }

  // Results
  approvedBy?: string // User ID
  approvedAt?: string
  rejectedBy?: string // User ID
  rejectedAt?: string
  rejectionReason?: string

  // Timestamps
  startedAt?: string
  failedAt?: string
  cancelledAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
  createdBy: string
}

/**
 * WorkflowStepInstance - Instance of a workflow step
 */
export interface WorkflowStepInstance {
  id: string
  stepId: string // Reference to WorkflowStep.id
  order: number

  // Assignment
  assignedTo: string[] // User IDs
  assignedAt: string

  // Status
  status: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'escalated' | 'skipped'

  // Approvals
  approvals: WorkflowApproval[]
  rejections: WorkflowRejection[]

  // SLA tracking
  startedAt: string
  dueAt: string // startedAt + timeoutHours
  completedAt?: string
  escalatedAt?: string

  // Escalation
  escalationLevel: number // How many times this step has been escalated
  escalatedTo?: string[] // User IDs
}

/**
 * WorkflowApproval - An approval for a workflow step
 */
export interface WorkflowApproval {
  id: string
  userId: string
  userName: string
  userEmail: string
  approvedAt: string
  comments?: string
}

/**
 * WorkflowRejection - A rejection for a workflow step
 */
export interface WorkflowRejection {
  id: string
  userId: string
  userName: string
  userEmail: string
  rejectedAt: string
  reason: string
  comments?: string
}

/**
 * ProjectWorkflowAssignment - Links reusable workflows to projects
 */
export interface ProjectWorkflowAssignment {
  id: string
  companyId: string
  projectId: string
  type: 'approval_line' | 'escalation_path'

  // Link to the reusable definition
  workflowDefinitionId?: string  // For approval_line
  escalationPolicyId?: string    // For escalation_path

  // Configuration
  isActive: boolean
  assignedBy: string
  assignedAt: string

  // Optional customizations
  customSettings?: Record<string, any>
}

/**
 * TaskEscalationRegistration - Tracking for task escalation monitoring
 */
export interface TaskEscalationRegistration {
  id: string
  companyId: string
  groupId?: string // NEW: Store tenant context
  taskId: string
  escalationPolicyId: string
  escalationPolicyName?: string // Denormalized for display

  // Status
  status: 'active' | 'completed' | 'cancelled'
  currentEscalationLevel: number

  // Scheduling
  registeredAt: string
  nextCheckAt: string
  lastCheckedAt?: string
  completedAt?: string

  // History
  lastActionAt?: string
  lastActionTaken?: string
  escalationHistory?: EscalationHistoryEntry[]

  metadata?: Record<string, any>
}

/**
 * EscalationHistoryEntry - Record of an escalation action taken
 */
export interface EscalationHistoryEntry {
  level: number
  action: string
  timestamp: string
  targetUserId?: string
  targetUserName?: string
  message?: string
}

/**
 * Collection structure for Firestore
 */
export interface WorkflowCollections {
  workflowDefinitions: WorkflowDefinition[]
  workflowInstances: WorkflowInstance[]
  escalationPolicies: EscalationPolicy[]
  approvalInstances: ApprovalInstance[]
  projectWorkflowAssignments: ProjectWorkflowAssignment[]
  taskEscalationRegistrations: TaskEscalationRegistration[]
  outbox: OutboxEvent[]
}

/**
 * Outbox Event Definitions (Transactional Pattern)
 */
export interface OutboxEvent {
  id?: string;
  eventType: 'START_PROCESS' | 'COMPLETE_TASK' | 'CANCEL_PROCESS' | 'DEPLOY_WORKFLOW';
  payload: any;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: any;
  processedAt?: any;
  error?: string;
  retryCount: number;
  companyId: string;
}

