// Enhanced Position-Based Project Schema aligned with PRD
// This schema implements FR2: Position-based architecture where positions exist independently of people

export interface Position {
  id: string
  title: string
  designation: string
  department?: string // Department/org unit name for display
  level: number
  managerPositionId?: string
  directReports: string[] // Position IDs
  matrixReports: string[] // Position IDs for dotted-line reporting (FR19)
  skills: string[]
  responsibilities: string[]
  isActive: boolean
  effectiveStartDate: string
  effectiveEndDate?: string
  createdAt: string
  updatedAt: string
}

export interface PositionAssignment {
  id: string
  positionId: string
  userId: string
  assignmentType: 'primary' | 'acting' | 'interim' | 'matrix'
  effectiveStartDate: string
  effectiveEndDate?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: 'compliance' | 'operational' | 'project' | 'approval' | 'custom'
  industry: string[]
  department?: string[] // Departments this template applies to
  positionLevel: number[]
  steps: WorkflowStep[]
  approvalMatrix: ApprovalMatrix
  complianceRequirements: ComplianceRequirement[]
  estimatedDuration: number // days
  isActive: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface WorkflowStep {
  id: string
  name: string
  description: string
  stepType: 'task' | 'approval' | 'decision' | 'notification' | 'compliance_check'
  assignedPositionId?: string
  assignedUserId?: string
  routingRules: RoutingRule[]
  dependencies: string[] // Step IDs
  estimatedHours: number
  definitionOfDone: ChecklistItem[]
  isRequired: boolean
  order: number
}

export interface RoutingRule {
  id: string
  condition: string
  targetPositionId: string
  priority: number
  reasoning: string
  isActive: boolean
}

export interface ApprovalMatrix {
  id: string
  name: string
  type: 'parallel' | 'sequential' | 'voting' | 'consensus'
  approvers: ApprovalLevel[]
  escalationPolicy: EscalationPolicy
  timeoutHours: number
}

export interface ApprovalLevel {
  id: string
  level: number
  positionIds: string[]
  requiredApprovals: number
  canDelegate: boolean
  timeoutHours: number
}

export interface EscalationPolicy {
  id: string
  name: string
  escalationSteps: EscalationStep[]
  maxEscalations: number
}

export interface EscalationStep {
  id: string
  stepNumber: number
  targetPositionId: string
  delayHours: number
  notificationTemplate: string
}

export interface ComplianceRequirement {
  id: string
  regulation: string
  region: string
  industry: string
  requirement: string
  deadlineType: 'absolute' | 'relative'
  deadlineValue: string
  evidenceRequired: string[]
  auditTrailRequired: boolean
}

export interface ChecklistItem {
  id: string
  text: string
  isRequired: boolean
  evidenceType: 'text' | 'file' | 'signature' | 'approval'
  validationRules: ValidationRule[]
}

export interface ValidationRule {
  id: string
  type: 'required' | 'format' | 'range' | 'custom'
  value: any
  errorMessage: string
}

// Enhanced Project interface aligned with PRD requirements
export interface PRDAlignedProject {
  id: string
  name: string
  description: string
  status: 'planning' | 'active' | 'on-hold' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'

  // Position-based assignment (FR2, FR3)
  assignedPositionId: string // Primary position responsible
  assignedUserId?: string // Specific person assigned
  matrixPositions: string[] // Additional positions involved (FR19)

  // Organizational context
  businessUnit: string
  costCenter: string

  // Timeline
  startDate: string
  endDate: string
  estimatedDuration: number

  // Financial
  costCategory: string

  // Workflow integration (FR4, FR5)
  workflowTemplateId?: string
  workflowSteps: WorkflowStep[]
  currentStepId?: string

  // Compliance tracking (FR9, FR13)
  complianceRequirements: ComplianceRequirement[]
  complianceStatus: 'compliant' | 'at_risk' | 'non_compliant'
  auditTrail: AuditEntry[]

  // Task routing (FR5, FR6)
  routingRules: RoutingRule[]
  lastRoutingDecision: RoutingDecision | null
  manualOverrides: ManualOverride[]

  // Approval workflow (FR7)
  approvalMatrix?: ApprovalMatrix
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'escalated'
  approvalHistory: ApprovalEntry[]

  // Definition of Done (FR8)
  definitionOfDone: ChecklistItem[]
  completionCriteria: CompletionCriteria

  // Collaboration (FR12)
  comments: ProjectComment[]
  mentions: Mention[]
  activityLog: ActivityEntry[]

  // Notifications (FR11)
  notificationPreferences: NotificationPreference[]
  lastNotificationSent?: string

  // Analytics and tracking
  progress: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  qualityScore: number
  complianceScore: number

  // Metadata
  tags: string[]
  projectCode: string
  client?: string
  location: string

  // Audit and compliance
  createdAt: string
  updatedAt: string
  createdBy: string
  lastModifiedBy: string
}

export interface RoutingDecision {
  id: string
  timestamp: string
  suggestedPositionId: string
  suggestedUserId?: string
  reasoning: string
  confidence: number
  alternatives: RoutingAlternative[]
  acceptedBy: string
  acceptedAt: string
}

export interface RoutingAlternative {
  positionId: string
  userId?: string
  reasoning: string
  confidence: number
}

export interface ManualOverride {
  id: string
  timestamp: string
  originalRouting: RoutingDecision
  newRouting: RoutingDecision
  reason: string
  overriddenBy: string
  approvedBy?: string
}

export interface AuditEntry {
  id: string
  timestamp: string
  action: string
  performedBy: string
  details: Record<string, any>
  ipAddress: string
  userAgent: string
}

export interface ApprovalEntry {
  id: string
  timestamp: string
  approverPositionId: string
  approverUserId: string
  decision: 'approved' | 'rejected' | 'delegated'
  comments?: string
  evidence?: string[]
}

export interface ProjectComment {
  id: string
  userId: string
  userName: string
  text: string
  mentions: string[] // User IDs
  attachments: string[] // File IDs
  isResolved: boolean
  createdAt: string
  updatedAt: string
}

export interface Mention {
  id: string
  userId: string
  positionId?: string
  context: string
  isRead: boolean
  createdAt: string
}

export interface ActivityEntry {
  id: string
  timestamp: string
  userId: string
  action: string
  details: Record<string, any>
  positionId?: string
}

export interface NotificationPreference {
  id: string
  type: 'email' | 'in_app' | 'sms' | 'push'
  enabled: boolean
  frequency: 'immediate' | 'daily' | 'weekly'
  conditions: NotificationCondition[]
}

export interface NotificationCondition {
  id: string
  trigger: string
  value: any
  enabled: boolean
}

export interface CompletionCriteria {
  id: string
  name: string
  description: string
  criteria: CompletionCriterion[]
  validationRules: ValidationRule[]
  evidenceRequired: string[]
}

export interface CompletionCriterion {
  id: string
  text: string
  isRequired: boolean
  evidenceType: 'text' | 'file' | 'signature' | 'approval'
  validationRules: ValidationRule[]
}
