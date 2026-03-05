// Enhanced Project Module Schema for Autocracy Manufacturing & Technology
// This schema extends the existing Project interface with additional collections and features

export interface ProjectPhase {
  id: string
  projectId: string
  name: string
  description: string
  phase: 'Design & Engineering' | 'Prototyping' | 'Production Planning' | 'Manufacturing' | 'Quality Testing' | 'Packaging & Delivery'
  status: 'not_started' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled'
  startDate: string
  endDate: string
  progress: number // 0-100
  dependencies: string[] // Phase IDs that must be completed first
  deliverables: ProjectDeliverable[]
  resources: ProjectResource[]
  risks: ProjectRisk[]
  createdAt: string
  updatedAt: string
}

export interface ProjectDeliverable {
  id: string
  phaseId: string
  name: string
  description: string
  type: 'document' | 'prototype' | 'system' | 'report' | 'certification'
  status: 'pending' | 'in_progress' | 'completed' | 'approved'
  assignee: string // User ID
  dueDate: string
  completedDate?: string
  files: ProjectFile[]
  approvalRequired: boolean
  approvedBy?: string // User ID
  approvedAt?: string
  createdAt: string
  updatedAt: string
}

export interface ProjectResource {
  id: string
  projectId: string
  phaseId?: string
  name: string
  type: 'equipment' | 'material' | 'personnel' | 'external_service' | 'software'
  category: string
  description: string
  quantity: number
  unit: string
  cost: number
  supplier?: string
  status: 'required' | 'ordered' | 'received' | 'allocated' | 'returned'
  allocatedTo?: string // User ID
  allocationDate?: string
  returnDate?: string
  specifications: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface ProjectRisk {
  id: string
  projectId: string
  phaseId?: string
  title: string
  description: string
  category: 'technical' | 'schedule' | 'budget' | 'quality' | 'safety' | 'compliance'
  probability: 'low' | 'medium' | 'high' | 'critical'
  impact: 'low' | 'medium' | 'high' | 'critical'
  status: 'identified' | 'monitoring' | 'mitigating' | 'resolved' | 'accepted'
  owner: string // User ID
  mitigationPlan: string
  contingencyPlan: string
  identifiedDate: string
  resolvedDate?: string
  createdAt: string
  updatedAt: string
}

export interface ProjectMilestone {
  id: string
  projectId: string
  name: string
  description: string
  type: 'phase_gate' | 'deliverable' | 'review' | 'approval' | 'go_live'
  targetDate: string
  actualDate?: string
  status: 'upcoming' | 'in_progress' | 'completed' | 'overdue' | 'cancelled'
  dependencies: string[] // Milestone IDs
  deliverables: string[] // Deliverable IDs
  reviewers: string[] // User IDs
  approvedBy?: string // User ID
  approvedAt?: string
  notes: string
  createdAt: string
  updatedAt: string
}

export interface ProjectFile {
  id: string
  projectId: string
  phaseId?: string
  deliverableId?: string
  name: string
  description: string
  type: 'document' | 'drawing' | 'specification' | 'report' | 'image' | 'video' | 'other'
  category: string
  fileUrl: string
  fileSize: number
  mimeType: string
  uploadedBy: string // User ID
  uploadedAt: string
  version: string
  isLatest: boolean
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface ProjectComment {
  id: string
  projectId: string
  phaseId?: string
  deliverableId?: string
  userId: string
  userName: string
  userAvatar: string
  text: string
  type: 'comment' | 'question' | 'suggestion' | 'approval' | 'rejection'
  isResolved: boolean
  resolvedBy?: string // User ID
  resolvedAt?: string
  mentions: string[] // User IDs
  attachments: ProjectFile[]
  createdAt: string
  updatedAt: string
}

export interface ProjectTemplate {
  id: string
  name: string
  description: string
  equipmentType: 'Industrial Robots' | 'Automation Systems' | 'Manufacturing Equipment' | 'Quality Control Systems' | 'Smart Sensors' | 'other'
  manufacturingPhase: 'Design & Engineering' | 'Prototyping' | 'Production Planning' | 'Manufacturing' | 'Quality Testing' | 'Packaging & Delivery'
  phases: Omit<ProjectPhase, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>[]
  milestones: Omit<ProjectMilestone, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>[]
  defaultResources: Omit<ProjectResource, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>[]
  qualityStandards: string[]
  complianceRequirements: string[]
  estimatedDuration: number // days
  estimatedBudget: number
  isActive: boolean
  createdBy: string // User ID
  createdAt: string
  updatedAt: string
}

export interface ProjectBudget {
  id: string
  projectId: string
  phaseId?: string
  category: 'equipment' | 'materials' | 'personnel' | 'external_services' | 'software' | 'overhead' | 'contingency'
  name: string
  description: string
  budgetedAmount: number
  actualAmount: number
  committedAmount: number
  remainingAmount: number
  currency: string
  status: 'on_track' | 'over_budget' | 'under_budget' | 'at_risk'
  lastUpdated: string
  createdAt: string
  updatedAt: string
}

export interface ProjectTimeTracking {
  id: string
  projectId: string
  phaseId?: string
  taskId?: string
  userId: string
  userName: string
  date: string
  hoursWorked: number
  description: string
  billable: boolean
  hourlyRate?: number
  approvedBy?: string // User ID
  approvedAt?: string
  createdAt: string
  updatedAt: string
}

// Enhanced Project interface with additional fields
export interface EnhancedProject {
  id: string
  workspaceId: string // ✅ NEW: Required - links to workspace (Level 1)
  name: string
  description: string
  status: 'planning' | 'active' | 'on-hold' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  manager: string | null // User ID
  team: string[] // User IDs
  positionTeam?: string[] // Position IDs of team members assigned via position
  startDate: string
  endDate: string
  progress: number // 0-100
  tags: string[]
  views?: string[] // Project views (e.g., 'list', 'board', 'timeline', 'calendar', 'dashboard')
  equipmentType: 'Industrial Robots' | 'Automation Systems' | 'Manufacturing Equipment' | 'Quality Control Systems' | 'Smart Sensors' | 'other'
  manufacturingPhase: 'Design & Engineering' | 'Prototyping' | 'Production Planning' | 'Manufacturing' | 'Quality Testing' | 'Packaging & Delivery'
  qualityStandards: string[]
  complianceRequirements: string[]

  // Additional fields for enhanced project management
  projectType?: 'rft' | 'reports' | 'compliance' | 'other'
  projectTemplateId?: string | null // Reference to ProjectTemplate (virtual or custom)
  templateId?: string | null // Legacy reference
  department?: string | null // Department/org unit owning the project
  client?: string | null
  clientContact?: string
  projectCode: string
  taskCounter?: number // ✅ Counter for sequential task IDs (increments atomically)
  location: string

  // Project metrics
  totalTasks: number
  completedTasks: number
  overdueTasks: number
  teamUtilization: number
  qualityScore: number
  safetyScore: number

  // Risk and issue tracking
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  issuesCount: number
  resolvedIssuesCount: number

  // Timeline and milestones
  currentPhase?: string // Phase ID
  nextMilestone?: string // Milestone ID
  lastActivityDate: string

  // Approval workflow
  requiresApproval: boolean
  approvedBy?: string | null // User ID
  approvedAt?: string | null
  approvalNotes?: string | null

  // Visibility settings
  // Standard: Full recursive visibility - inherited by entire management chain up to CEO
  // Private/Secret: Zero inheritance - not visible to managers unless explicitly invited
  visibility?: 'standard' | 'private' | 'secret'

  // ✅ Workflow & Escalation Defaults
  workflowDefinitionId?: string
  escalationPolicyId?: string

  // ✅ Project Custom Fields (Staging/Production Values)
  customFields?: Record<string, any>
  verificationStatus?: Record<string, 'pending' | 'verified' | 'rejected'>

  // UI properties
  color?: string // For UI display (hex color)

  // Soft delete fields
  isDeleted?: boolean
  deletedAt?: string

  // Audit fields
  createdBy?: string // User ID of the creator
  createdAt: string
  updatedAt: string
}

// Collection structure for Firestore
export interface ProjectCollections {
  projects: EnhancedProject[]
  projectPhases: ProjectPhase[]
  projectDeliverables: ProjectDeliverable[]
  projectResources: ProjectResource[]
  projectRisks: ProjectRisk[]
  projectMilestones: ProjectMilestone[]
  projectFiles: ProjectFile[]
  projectComments: ProjectComment[]
  projectTemplates: ProjectTemplate[]
  projectBudgets: ProjectBudget[]
  projectTimeTracking: ProjectTimeTracking[]
}
