// Task Template Schema for Position-Based Task Management
// This schema defines reusable task templates that can be assigned to positions

export interface TaskTemplate {
  id: string
  name: string
  description: string

  department: string[]
  positionLevel: number[] // Organizational levels this template applies to
  priority: 'low' | 'medium' | 'high' | 'urgent'

  // Task details
  estimatedHours: number
  dueDateOffset: number // Days from assignment date
  isRecurring: boolean
  recurrencePattern?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'

  // Assignment rules
  assignmentType: 'automatic' | 'manual' | 'conditional'
  assignmentConditions?: TaskAssignmentCondition[]

  // Task requirements
  requiredSkills: string[]
  requiredCertifications: string[]
  definitionOfDone: TaskDoDItem[]

  // Workflow
  approvalRequired: boolean
  approvalMatrix?: string // Reference to approval matrix ID
  escalationRules?: TaskEscalationRule[]

  // Compliance and quality
  complianceRequirements: string[]
  qualityCheckpoints: string[]
  safetyRequirements: string[]

  // Metadata
  tags: string[]
  isActive: boolean
  isSystemTemplate: boolean // System vs user-created templates
  createdBy: string // User ID
  lastUsedAt?: string
  usageCount: number

  createdAt: string
  updatedAt: string
}

export interface TaskAssignmentCondition {
  id: string
  type: 'position_level' | 'department' | 'skill' | 'certification' | 'tenure' | 'custom'
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains'
  value: string | number
  description: string
}

export interface TaskDoDItem {
  id: string
  text: string
  isRequired: boolean
  evidenceType: 'approval' | 'document' | 'checklist' | 'signature' | 'photo' | 'custom'
  validationRules: string[]
  order: number
}

export interface TaskEscalationRule {
  id: string
  name: string
  triggerCondition: 'overdue' | 'stuck' | 'rejected' | 'custom'
  triggerValue: number // Hours or days
  escalationAction: 'notify_manager' | 'reassign' | 'escalate_approval' | 'create_incident'
  targetPosition?: string // Position ID for escalation
  notificationTemplate?: string
}

// Position-Template Assignment
export interface PositionTaskTemplate {
  id: string
  companyId: string
  positionId: string
  templateId: string

  // Assignment configuration
  assignmentMode: 'immediate' | 'on_assignment' | 'scheduled' | 'conditional'
  assignmentDate?: string // For scheduled assignments
  assignmentConditions?: TaskAssignmentCondition[]

  // Customization for this position
  customDueDateOffset?: number
  customPriority?: 'low' | 'medium' | 'high' | 'urgent'
  customInstructions?: string

  // Status
  isActive: boolean
  lastAssignedAt?: string
  assignmentCount: number

  createdAt: string
  updatedAt: string
}

// Generated Task from Template
export interface GeneratedTask {
  id: string
  taskNumber?: number // ✅ Sequential task number for display (e.g., 1, 2, 3 -> PA-1, PA-2, PA-3)
  templateId: string
  positionId: string
  assignedUserId: string
  assignedTo?: string // Map to assignedUserId for dashboard compatibility
  assignedPositionId?: string // Position-based assignment
  assignedToName?: string // Denormalized name for dashboard display
  workspaceId?: string // ✅ NEW: Optional - links to workspace (inherited from project or standalone)
  projectId: string // Required - every task belongs to a project (similar to Jira)
  projectCode?: string // Optional - cached project code for display (e.g. "PA")
  projectName?: string // Optional - cached project name for display
  parentTaskId?: string // For subtasks - reference to parent task ID
  workflowId?: string // Link to Workflow Definition ID

  // Task details (copied from template)
  title: string
  description: string

  priority: 'low' | 'medium' | 'high' | 'urgent'
  estimatedHours: number
  dueDate: string
  startDate?: string // ISO date string
  endDate?: string // ISO date string
  dependencies?: {
    targetTaskId: string
    type: 'FS' | 'SS' | 'FF' | 'SF'
    lag: number
  }[]
  isMilestone?: boolean
  orgUnitId?: string
  orgUnitName?: string
  team?: string
  taskType?: string
  requirementType?: string
  targetDate?: string // ISO date string - for Milestones or specific deadlines

  // Assignment details
  assignmentType: 'template_generated' | 'manual' | 'escalated'
  assignmentReason: string
  assignedBy: string // User ID
  reporter?: string // User ID who created/reported the task
  reporterName?: string // Denormalized name for display
  reporterPositionId?: string // Position ID for reporter

  // Status tracking
  status: 'open' | 'assigned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled' | 'escalated' | 'approval_required'
  progress: number // 0-100

  // Completion tracking
  startedAt?: string
  completedAt?: string
  actualHours?: number
  completionNotes?: string

  // Actual Date Fields - Automatically recorded on status changes
  actualStartDate?: string   // ISO date string - recorded when task moves to 'in_progress'
  actualEndDate?: string     // ISO date string - recorded when task moves to 'completed'

  // Approval workflow
  approvalStatus?: 'pending' | 'approved' | 'rejected' | 'escalated'
  approvedBy?: string
  approvedAt?: string
  approvalNotes?: string

  // Reporter Approval
  requiresReporterApproval?: boolean
  reporterApprovalStatus?: 'pending' | 'approved' | 'rejected'
  reporterRejectionComments?: string
  reporterApprovalAttempts?: number
  reporterApprovalHistory?: Array<{
    decision: 'approved' | 'rejected'
    comments?: string
    decidedBy: string
    decidedAt: string
    attemptNumber: number
  }>

  // Definition of Done tracking
  definitionOfDone: TaskDoDProgress[]

  // Attachments
  attachments?: TaskAttachment[]

  // Recurring Task Metadata
  metadata?: {
    recurringConfigId: string
    scheduledDate: string
    isRecurring: boolean
  }

  // Workflow Integration Fields
  workflowInstanceId?: string        // Link to WorkflowInstance
  workflowStepId?: string            // Current workflow step
  flowableTaskId?: string            // Flowable's task ID
  flowableProcessInstanceId?: string // Flowable's process instance ID
  workflowStatus?: 'pending' | 'active' | 'completed' | 'failed' | 'cancelled'
  candidateUsers?: string[]          // Users who can claim this task
  candidateGroups?: string[]         // Groups who can claim this task

  // ═══════════════════════════════════════════════════════════════════════
  // INDEPENDENT APPROVAL & ESCALATION (NEW)
  // These are decoupled from BPMN/Flowable for simple direct execution
  // ═══════════════════════════════════════════════════════════════════════

  // APPROVAL LINE (Independent Entity)
  // Triggers ONLY on task 'completed' status
  workflowDefinitionId?: string     // Reference to the Approval Line
  approvalInstanceId?: string       // Created when approval process starts
  approvalAssignedBy?: string       // User who attached the approval line
  approvalAssignedAt?: string       // Timestamp of attachment

  // ESCALATION PATH (Independent Entity)
  // Registers when task moves to 'in_progress' status
  escalationPolicyId?: string       // Reference to the Escalation Path
  escalationRegisteredAt?: string   // Timestamp when escalation monitoring started

  // ═══════════════════════════════════════════════════════════════════════

  completionData?: {                 // Data from workflow completion
    approved?: boolean
    rejected?: boolean
    comments?: string
    decision?: string
    completedBy?: string
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GHOST WORKFLOW TRACKING (NEW)
  // Tracks when positions are removed from active workflows
  // ═══════════════════════════════════════════════════════════════════════

  ghostInfo?: GhostWorkflowInfo

  // Quick flags for filtering
  hasGhostIssue?: boolean
  lastGhostCheckAt?: string

  // Last Seen Tracking
  /**
   * Track which users have seen this task and when.
   * Key: UserId, Value: ISO Timestamp
   */
  lastSeenBy?: Record<string, string>

  /** Zero-indexed position within its status column on the board. Undefined = no manual order set. */
  boardOrder?: number

  createdAt: string
  updatedAt: string
}

/**
 * Ghost Workflow Info - Tracks issues when positions are removed
 * from active approval lines or escalation paths
 */
export interface GhostWorkflowInfo {
  // Ghost status flags
  hasGhostApproval: boolean
  hasGhostEscalation: boolean

  // Approval ghost details
  approvalGhostReason?: GhostReasonType
  affectedApprovalStages?: string[]
  affectedApprovalPositions?: GhostPositionInfo[]

  // Escalation ghost details
  escalationGhostReason?: GhostReasonType
  affectedEscalationRules?: string[]
  affectedEscalationPositions?: GhostPositionInfo[]

  // Detection info
  detectedAt: string
  detectedBy: 'system' | 'user' | 'scheduler'

  // Resolution info
  resolvedAt?: string
  resolvedBy?: string
  resolutionMethod?: GhostResolutionMethod
  resolutionNotes?: string
}

export type GhostReasonType =
  | 'position_missing'         // Position no longer exists
  | 'position_vacant'          // Position exists but no assignee
  | 'user_missing'             // User no longer exists (deleted from system)
  | 'user_inactive'            // Assigned user is inactive
  | 'approval_line_deleted'    // Entire approval line was deleted
  | 'escalation_path_deleted'  // Entire escalation path was deleted

export type GhostResolutionMethod =
  | 'workflow_changed'    // Changed to a different workflow
  | 'position_filled'     // Position was filled
  | 'user_reactivated'    // User was reactivated
  | 'manual_override'     // Manual resolution by admin
  | 'auto_resolved'       // Automatically resolved by system

export interface GhostPositionInfo {
  positionId: string
  positionTitle?: string
  reason: GhostReasonType
  stageId?: string
  stageName?: string
  ruleId?: string
  ruleName?: string
}

export interface TaskAttachment {
  id: string
  url: string
  path: string
  name: string
  size: number
  contentType: string
  uploadedBy: string
  uploadedAt: string
  referredUserId?: string // ✅ NEW: User this document refers to
  referredUserName?: string // ✅ NEW: Cached name for display
  folderId?: string // Always set to default folder ID for task/subtask uploads
  folderName?: string // Always "Default" for task/subtask uploads
  source?: 'task' | 'subtask' | 'manual' // Track upload source
  metadata?: {
    name: string
    size: number
    contentType: string
    timeCreated: string
    updated: string
  }
}

export interface TaskDoDProgress {
  doDItemId: string
  text: string
  isRequired: boolean
  isCompleted: boolean
  completedAt?: string
  completedBy?: string
  evidence?: TaskEvidence[]
  order: number
}

export interface TaskEvidence {
  id: string
  type: 'file' | 'text' | 'signature' | 'photo' | 'approval'
  content: string
  uploadedBy: string
  uploadedAt: string
  metadata?: Record<string, any>
}

// Task Library Statistics
export interface TaskLibraryStats {
  totalTemplates: number
  activeTemplates: number
  systemTemplates: number
  userTemplates: number
  totalAssignments: number
  completedTasks: number
  overdueTasks: number
  averageCompletionTime: number // hours
  mostUsedTemplates: Array<{
    templateId: string
    templateName: string
    usageCount: number
  }>
}

// Collection structure for Firestore
export interface TaskTemplateCollections {
  taskTemplates: TaskTemplate[]
  positionTaskTemplates: PositionTaskTemplate[]
  tasks: GeneratedTask[]
  taskLibraryStats: TaskLibraryStats[]
}
