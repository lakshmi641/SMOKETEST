// Workspace Schema for Team-Based Organization
// Workspaces represent functional teams (Level 1 in the hierarchy)




export interface Workspace {
  id: string
  name: string // e.g., "QC Workspace", "Sourcing Workspace", "Finance Workspace"
  description: string
  teamName: string // Functional team name (e.g., "QC", "Sourcing", "Finance")

  // Admin & Member management
  ownerId: string // User ID of the workspace owner
  members: string[] // User IDs of all members (labeled as Members in UI)
  positionMembers?: string[] // Position IDs of members assigned via position

  // Organizational context
  department?: string
  businessUnit?: string

  // Status
  status: 'active' | 'archived'

  // Vertical Visibility (Inheritance Policy)
  // Standard: Full recursive visibility - inherited by entire management chain up to CEO
  // Confidential: Restricted inheritance - only direct manager inherits access, blocked for skip-levels
  // Private/Secret: Zero inheritance - not visible to managers unless explicitly invited
  visibility?: 'standard' | 'confidential' | 'private' | 'secret'




  // Metadata
  tags: string[]
  color?: string // For UI display (hex color)
  icon?: string // Icon identifier for UI

  // Metrics (computed)
  totalProjects?: number
  activeProjects?: number
  totalTasks?: number
  completedTasks?: number

  // Audit
  createdAt: string
  updatedAt: string
  createdBy: string // User ID
  lastModifiedBy?: string // User ID
}

// Workspace member (for future expansion)
export interface WorkspaceMember {
  id: string
  workspaceId: string
  userId: string
  role: 'spoc' | 'member' | 'viewer'
  joinedAt: string
  addedBy: string // User ID
}

// Workspace settings
export interface WorkspaceSettings {
  workspaceId: string
  allowPublicProjects: boolean
  defaultProjectTemplate?: string
  notificationPreferences: {
    projectCreated: boolean
    taskAssigned: boolean
    milestoneReached: boolean
  }
}

// Collection structure for Firestore
export interface WorkspaceCollections {
  workspaces: Workspace[]
  workspaceMembers: WorkspaceMember[]
  workspaceSettings: WorkspaceSettings[]
}

