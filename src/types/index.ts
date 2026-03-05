// PMS-specific types for Autocracy Manufacturing & Technology

// Recurring Tasks (v6.2)
export * from './recurring-task-schema'
export * from './task-request-schema'
export * from './starred-items'
export * from './executive-dashboard'

// Workflow Validation & Activity (NEW)
export * from './workflow-validation-schema'
export * from './task-activity-schema'

// Multi-org (enterprise groups)
export * from './enterprise-group-schema'

// Website-as-a-Service (WaaS)
export * from './website-schema'

// Re-export ghost types from task-template-schema
export type {
  GhostWorkflowInfo,
  GhostReasonType,
  GhostResolutionMethod,
  GhostPositionInfo,
} from './task-template-schema'

export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'manager' | 'employee' | 'owner' | 'group_admin'
  orgUnitId?: string
  orgUnitName?: string
  position: string
  positionCode?: string
  designation?: string
  /** Current / primary company (used for context and APIs) */
  companyId: string
  avatar?: string
  skills: string[]
  contact: {
    phone: string
    slack: string
  }
  /** When true, user must change password on next login before accessing the app */
  mustChangePassword?: boolean
  /**
   * ISO timestamp when a temporary password expires.
   * Used together with mustChangePassword to enforce time-bound temp credentials.
   */
  temporaryPasswordExpiresAt?: string
  spocTeams?: string[]
  createdAt: string
  updatedAt: string
  // Multi-org (enterprise groups): set when user is resolved from enterpriseGroups/{groupId}/users
  enterpriseGroupId?: string
  companyIds?: string[]
  primaryCompanyId?: string
  /** Per-company role (companyId -> role) for sidebar/permission when switching companies */
  roles?: Record<string, 'owner' | 'admin' | 'manager' | 'employee' | 'viewer' | 'group_admin'>
  /** True when the enterprise group user doc has top-level role === 'group_admin' */
  isGroupAdmin?: boolean
}

export interface Project {
  id: string
  workspaceId: string // ✅ NEW: Required - links to workspace (Level 1)
  name: string
  description: string
  status: 'planning' | 'active' | 'on-hold' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  manager: string // User ID
  team: string[] // User IDs
  adminIds?: string[] // v6.2: Promoted project admins (can manage recurring tasks)
  startDate: string // ISO date string
  endDate: string // ISO date string
  progress: number // 0-100
  tags: string[]
  equipmentType: 'Industrial Robots' | 'Automation Systems' | 'Manufacturing Equipment' | 'Quality Control Systems' | 'Smart Sensors' | 'other'
  manufacturingPhase: 'Design & Engineering' | 'Prototyping' | 'Production Planning' | 'Manufacturing' | 'Quality Testing' | 'Packaging & Delivery'
  qualityStandards: string[]
  complianceRequirements: string[]
  createdAt: string
  updatedAt: string
}

export interface TaskDependency {
  targetTaskId: string
  type: 'FS' | 'SS' | 'FF' | 'SF'
  lag: number // hours
}

export interface GanttItem {
  id: string
  title: string
  startDate?: string
  endDate?: string
  dependencies?: TaskDependency[]
  progress?: number
  status?: string
  priority?: string
  assignee?: {
    name: string
    avatar?: string
  }
  reporterId?: string
  type: 'task' | 'project'
  estimatedHours?: number // Optional, for critical path calculation
  createdAt?: string // ✅ NEW: For sorting by creation date
}

export interface Task {
  id: string
  title: string
  description: string
  status: 'todo' | 'in_progress' | 'done' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assignee: string // User ID
  reporter: string // User ID
  projectId: string
  dueDate: string
  startDate?: string // ISO date string
  endDate?: string // ISO date string
  dependencies?: TaskDependency[]
  progress?: number // 0-100
  isMilestone?: boolean
  estimatedHours: number
  actualHours: number
  requirementType?: string
  tags: string[]
  comments: TaskComment[]
  manufacturingStep: string
  qualityCheckpoints: string[]
  safetyRequirements: string[]
  createdAt: string
  updatedAt: string
  assignedPositionId?: string // Position-based assignment
}

export interface TaskComment {
  userId: string
  text: string
  timestamp: string
}

export interface Activity {
  id: string
  type: 'task_completed' | 'project_created' | 'user_joined' | 'task_assigned' | 'quality_check' | 'safety_incident'
  title: string
  description: string
  userId: string
  userName: string
  userAvatar: string
  timestamp: string
  metadata: Record<string, any>
}

export interface OrgChartNode {
  id: string
  name: string
  position: string
  manager: string | null
  reports: string[]
  avatar: string
  level: number
  userId: string
}

export interface Workflow {
  id: string
  name: string
  description: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  projectId?: string
  equipmentType?: string
  createdAt: string
  updatedAt: string
}

export interface WorkflowNode {
  id: string
  type: 'start' | 'process' | 'decision' | 'quality_check' | 'safety_check' | 'end'
  position: { x: number; y: number }
  data: {
    label: string
    description?: string
    assignee?: string
    estimatedHours?: number
    qualityRequirements?: string[]
    safetyRequirements?: string[]
  }
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  type: 'default' | 'conditional'
  data?: {
    condition?: string
    label?: string
  }
}

export interface DashboardMetrics {
  totalProjects: number
  activeProjects: number
  completedProjects: number
  totalTasks: number
  completedTasks: number
  overdueTasks: number
  teamUtilization: number
  averageProjectDuration: number
  qualityScore: number
  safetyScore: number
}

export interface Equipment {
  id: string
  name: string
  type: 'Industrial Robots' | 'Automation Systems' | 'Manufacturing Equipment' | 'Quality Control Systems' | 'Smart Sensors' | 'other'
  model: string
  serialNumber: string
  manufacturer: string
  specifications: Record<string, any>
  manufacturingDate: string
  status: 'in_production' | 'completed' | 'delivered' | 'maintenance'
  projectId: string
  qualityChecks: QualityCheck[]
  safetyInspections: SafetyInspection[]
  createdAt: string
  updatedAt: string
}

export interface QualityCheck {
  id: string
  equipmentId: string
  checkpoint: string
  status: 'passed' | 'failed' | 'pending'
  inspector: string
  notes: string
  timestamp: string
  photos?: string[]
}

export interface SafetyInspection {
  id: string
  equipmentId: string
  inspectionType: string
  status: 'passed' | 'failed' | 'pending'
  inspector: string
  notes: string
  timestamp: string
  complianceStandards: string[]
}
