// Access Control System (ACS) Schema
// Hybrid RBAC + ReBAC + ABAC implementation

/**
 * Role - A collection of permissions that can be assigned to users
 * Roles can be system-wide, workspace-specific, or project-specific
 */
export interface Role {
  id: string
  companyId: string
  name: string // e.g., "Workspace Admin", "Project Manager", "Viewer"
  description: string

  // Scope defines where this role can be assigned
  scope: 'system' | 'workspace' | 'project'

  // Permissions granted by this role (permission IDs from registry)
  permissions: string[] // e.g., ["workspace.view", "task.create"]

  // Whether this is a custom role created by admin or a system default
  isCustom: boolean

  // Timestamps
  createdAt: string
  updatedAt: string
  createdBy: string // User ID
  updatedBy?: string // User ID
}

/**
 * AccessPolicy - Attribute-Based Access Control (ABAC)
 * Grants permissions based on user attributes (e.g., position level)
 */
export interface AccessPolicy {
  id: string
  companyId: string
  name: string
  description?: string

  // Condition that must be met for this policy to apply
  condition: PolicyCondition

  // What this policy grants
  grant: PolicyGrant

  // Whether this policy is active
  isActive: boolean

  // Priority (higher priority policies are evaluated first)
  priority: number

  // Timestamps
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy?: string
}

/**
 * PolicyCondition - Defines the condition for an AccessPolicy
 */
export interface PolicyCondition {
  // Attribute path to evaluate (e.g., "user.position.level", "user.department")
  attribute: string

  // Comparison operator
  operator: 'lte' | 'gte' | 'eq' | 'ne' | 'contains' | 'in' | 'not_in'

  // Value to compare against
  value: any

  // Optional: Additional conditions (AND logic)
  and?: PolicyCondition[]

  // Optional: Alternative conditions (OR logic)
  or?: PolicyCondition[]
}

/**
 * PolicyGrant - What permissions/roles are granted by a policy
 */
export interface PolicyGrant {
  // Grant a full role (optional)
  roleId?: string

  // Or grant specific permissions (optional)
  permissions?: string[]

  // Resource scope defines what resources this applies to
  resourceScope: 'all_workspaces' | 'own_department' | 'own_workspace' | 'assigned_projects' | 'all'

  // Optional: Specific workspace IDs (if resourceScope is custom)
  workspaceIds?: string[]

  // Optional: Specific project IDs (if resourceScope is custom)
  projectIds?: string[]
}

/**
 * RoleAssignment - Links a user to a role at a specific scope
 * Users can have multiple role assignments (system + workspace + project)
 */
export interface RoleAssignment {
  id: string
  companyId: string
  userId: string
  roleId: string

  // Scope type determines where this role applies
  scopeType: 'system' | 'workspace' | 'project'

  // Scope ID is required for workspace/project scopes
  scopeId?: string // workspaceId or projectId

  // Who assigned this role
  assignedBy: string // User ID

  // Optional: Expiration date for temporary assignments
  expiresAt?: string | null

  // Status
  status: 'active' | 'inactive' | 'expired'

  // Timestamps
  createdAt: string
  updatedAt: string
}

/**
 * PositionRoleMapping - Links positions to default roles
 * When a user is assigned to a position, they automatically get these roles
 */
export interface PositionRoleMapping {
  id: string
  companyId: string
  positionId: string
  roleId: string

  // Whether this mapping is active
  isActive: boolean

  // Timestamps
  createdAt: string
  updatedAt: string
  createdBy: string
}

/**
 * PermissionCheckResult - Result of a permission check
 */
export interface PermissionCheckResult {
  allowed: boolean
  reason: 'admin' | 'direct_role' | 'position_inheritance' | 'delegation' | 'policy' | 'denied' | 'workspace_admin' | 'workspace_member'
  roleId?: string
  roleName?: string
  policyId?: string
  policyName?: string
  delegationId?: string
  checkedAt: string
}

/**
 * AccessControlContext - Context for permission checks
 */
export interface AccessControlContext {
  userId: string
  companyId: string
  /** Enterprise group ID (multi-org). When set, company user/role is resolved from enterprise path or group user roles. */
  groupId?: string
  workspaceId?: string
  projectId?: string
  resourceType?: string // e.g., "task", "project", "workspace"
  resourceId?: string
}

/**
 * Collection structure for Firestore
 */
export interface AccessControlCollections {
  roles: Role[]
  roleAssignments: RoleAssignment[]
  accessPolicies: AccessPolicy[]
  positionRoleMappings: PositionRoleMapping[]
}

