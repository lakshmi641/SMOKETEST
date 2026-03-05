/**
 * Permission Registry
 * Centralized registry of all available permissions in the system
 * This ensures type safety and UI consistency
 * 
 * Permission naming convention: {resource}.{action}
 * Examples: workspace.view, task.create, budget.approve
 */

// Workspace Level Permissions
export const WORKSPACE_VIEW = 'workspace.view'
export const WORKSPACE_MANAGE = 'workspace.manage'
export const WORKSPACE_DELETE = 'workspace.delete'
export const WORKSPACE_MEMBER_MANAGE = 'workspace.member.manage'
export const WORKSPACE_SETTINGS_EDIT = 'workspace.settings.edit'

// Project Level Permissions
export const PROJECT_CREATE = 'project.create'
export const PROJECT_VIEW = 'project.view'
export const PROJECT_EDIT = 'project.edit'
export const PROJECT_DELETE = 'project.delete'
export const PROJECT_MANAGE = 'project.manage'
export const PROJECT_MEMBER_MANAGE = 'project.member.manage'
export const PROJECT_BUDGET_VIEW = 'project.budget.view'
export const PROJECT_BUDGET_EDIT = 'project.budget.edit'

// Task Level Permissions
export const TASK_CREATE = 'task.create'
export const TASK_VIEW = 'task.view'
export const TASK_EDIT = 'task.edit'
export const TASK_DELETE = 'task.delete'
export const TASK_ASSIGN = 'task.assign'
export const TASK_COMPLETE = 'task.complete'
export const TASK_MANAGE = 'task.manage'

// User Management Permissions
export const USER_INVITE = 'user.invite'
export const USER_REMOVE = 'user.remove'
export const USER_EDIT = 'user.edit'
export const USER_ROLE_EDIT = 'user.role.edit'
export const USER_VIEW_ALL = 'user.view.all'

// Company Settings Permissions
export const COMPANY_SETTINGS_EDIT = 'company.settings.edit'
export const COMPANY_BILLING_EDIT = 'company.billing.edit'
export const COMPANY_FEATURES_MANAGE = 'company.features.manage'

// Analytics & Reporting Permissions
export const ANALYTICS_VIEW = 'analytics.view'
export const ANALYTICS_EXPORT = 'analytics.export'
export const REPORT_CREATE = 'report.create'
export const REPORT_VIEW = 'report.view'

// Workflow Permissions
export const WORKFLOW_CREATE = 'workflow.create'
export const WORKFLOW_EDIT = 'workflow.edit'
export const WORKFLOW_DELETE = 'workflow.delete'
export const WORKFLOW_EXECUTE = 'workflow.execute'
export const APPROVAL_APPROVE = 'approval.approve'
export const APPROVAL_REJECT = 'approval.reject'

// Independent Approval & Escalation Permissions
export const APPROVAL_LINE_ASSIGN = 'approval-line.assign'      // Attach approval line to task
export const APPROVAL_LINE_MODIFY = 'approval-line.modify'      // Modify after task created
export const ESCALATION_PATH_ASSIGN = 'escalation-path.assign'  // Attach escalation path to task
export const ESCALATION_PATH_MODIFY = 'escalation-path.modify'  // Modify after task created
export const WORKFLOW_INSTANCE_VIEW = 'workflow.instance.view'  // View running instances
export const WORKFLOW_INSTANCE_CANCEL = 'workflow.instance.cancel' // Cancel running instances

// Admin Permissions (System-level)
export const ADMIN_ALL = 'admin.all' // Bypass all permission checks
export const ADMIN_ROLE_MANAGE = 'admin.role.manage'
export const ADMIN_POLICY_MANAGE = 'admin.policy.manage'
export const ADMIN_AUDIT_VIEW = 'admin.audit.view'

// PM-KUSUM / Manufacturing Specialized Permissions
export const DOCUMENT_UPLOAD = 'document.upload'
export const DOCUMENT_VERIFY = 'document.verify'
export const CUSTOM_FIELD_MANAGE = 'custom-field.manage'
export const PROJECT_INFO_EDIT = 'project.info.edit'
export const CONTRACT_SIGN = 'contract.sign'
export const SANCTION_APPROVE = 'sanction.approve'
export const DISBURSEMENT_TRACK = 'disbursement.track'

/**
 * Permission Registry Object
 * Maps permission IDs to their metadata
 */
export const PERMISSIONS = {
  COMMAND_CENTER: {
    VIEW: 'command-center.view',
    VIEW_ALL: 'command-center.view-all',
    VIEW_WORKSPACE: 'command-center.view-workspace',
    EXPORT: 'command-center.export',
    DRILL_DOWN: 'command-center.drill-down'
  },
  // Workspace Level
  WORKSPACE_VIEW,
  WORKSPACE_MANAGE,
  WORKSPACE_DELETE,
  WORKSPACE_MEMBER_MANAGE,
  WORKSPACE_SETTINGS_EDIT,

  // Project Level
  PROJECT_CREATE,
  PROJECT_VIEW,
  PROJECT_EDIT,
  PROJECT_DELETE,
  PROJECT_MANAGE,
  PROJECT_MEMBER_MANAGE,
  PROJECT_BUDGET_VIEW,
  PROJECT_BUDGET_EDIT,

  // Task Level
  TASK_CREATE,
  TASK_VIEW,
  TASK_EDIT,
  TASK_DELETE,
  TASK_ASSIGN,
  TASK_COMPLETE,
  TASK_MANAGE,

  // User Management
  USER_INVITE,
  USER_REMOVE,
  USER_EDIT,
  USER_ROLE_EDIT,
  USER_VIEW_ALL,

  // Company Settings
  COMPANY_SETTINGS_EDIT,
  COMPANY_BILLING_EDIT,
  COMPANY_FEATURES_MANAGE,

  // Analytics
  ANALYTICS_VIEW,
  ANALYTICS_EXPORT,
  REPORT_CREATE,
  REPORT_VIEW,

  // Workflow
  WORKFLOW_CREATE,
  WORKFLOW_EDIT,
  WORKFLOW_DELETE,
  WORKFLOW_EXECUTE,
  APPROVAL_APPROVE,
  APPROVAL_REJECT,

  // Independent Approval & Escalation
  APPROVAL_LINE_ASSIGN,
  APPROVAL_LINE_MODIFY,
  ESCALATION_PATH_ASSIGN,
  ESCALATION_PATH_MODIFY,
  WORKFLOW_INSTANCE_VIEW,
  WORKFLOW_INSTANCE_CANCEL,

  // Admin
  ADMIN_ALL,
  ADMIN_ROLE_MANAGE,
  ADMIN_POLICY_MANAGE,
  ADMIN_AUDIT_VIEW,

  // PM-KUSUM / Manufacturing
  DOCUMENT_UPLOAD,
  DOCUMENT_VERIFY,
  CUSTOM_FIELD_MANAGE,
  PROJECT_INFO_EDIT,
  CONTRACT_SIGN,
  SANCTION_APPROVE,
  DISBURSEMENT_TRACK,
} as const

/**
 * Permission Metadata
 * Provides human-readable descriptions and categories for permissions
 */
export interface PermissionMetadata {
  id: string
  name: string
  description: string
  category: 'workspace' | 'project' | 'task' | 'user' | 'company' | 'analytics' | 'workflow' | 'admin'
  resourceType?: string // e.g., "workspace", "task"
  action?: string // e.g., "view", "create", "edit"
}

/**
 * Permission Metadata Registry
 */
export const PERMISSION_METADATA: Record<string, PermissionMetadata> = {
  [WORKSPACE_VIEW]: {
    id: WORKSPACE_VIEW,
    name: 'View Workspace',
    description: 'View workspace details and projects',
    category: 'workspace',
    resourceType: 'workspace',
    action: 'view',
  },
  [WORKSPACE_MANAGE]: {
    id: WORKSPACE_MANAGE,
    name: 'Manage Workspace',
    description: 'Full workspace management capabilities',
    category: 'workspace',
    resourceType: 'workspace',
    action: 'manage',
  },
  [WORKSPACE_DELETE]: {
    id: WORKSPACE_DELETE,
    name: 'Delete Workspace',
    description: 'Delete workspace and all its projects',
    category: 'workspace',
    resourceType: 'workspace',
    action: 'delete',
  },
  [WORKSPACE_MEMBER_MANAGE]: {
    id: WORKSPACE_MEMBER_MANAGE,
    name: 'Manage Workspace Members',
    description: 'Add or remove workspace members',
    category: 'workspace',
    resourceType: 'workspace',
    action: 'manage',
  },
  [WORKSPACE_SETTINGS_EDIT]: {
    id: WORKSPACE_SETTINGS_EDIT,
    name: 'Edit Workspace Settings',
    description: 'Modify workspace configuration',
    category: 'workspace',
    resourceType: 'workspace',
    action: 'edit',
  },
  [PROJECT_CREATE]: {
    id: PROJECT_CREATE,
    name: 'Create Project',
    description: 'Create new projects',
    category: 'project',
    resourceType: 'project',
    action: 'create',
  },
  [PROJECT_VIEW]: {
    id: PROJECT_VIEW,
    name: 'View Project',
    description: 'View project details',
    category: 'project',
    resourceType: 'project',
    action: 'view',
  },
  [PROJECT_EDIT]: {
    id: PROJECT_EDIT,
    name: 'Edit Project',
    description: 'Modify project details',
    category: 'project',
    resourceType: 'project',
    action: 'edit',
  },
  [PROJECT_DELETE]: {
    id: PROJECT_DELETE,
    name: 'Delete Project',
    description: 'Delete projects',
    category: 'project',
    resourceType: 'project',
    action: 'delete',
  },
  [PROJECT_MANAGE]: {
    id: PROJECT_MANAGE,
    name: 'Manage Project',
    description: 'Full project management capabilities',
    category: 'project',
    resourceType: 'project',
    action: 'manage',
  },
  [PROJECT_MEMBER_MANAGE]: {
    id: PROJECT_MEMBER_MANAGE,
    name: 'Manage Project Members',
    description: 'Add or remove project team members',
    category: 'project',
    resourceType: 'project',
    action: 'manage',
  },
  [TASK_CREATE]: {
    id: TASK_CREATE,
    name: 'Create Task',
    description: 'Create new tasks',
    category: 'task',
    resourceType: 'task',
    action: 'create',
  },
  [TASK_VIEW]: {
    id: TASK_VIEW,
    name: 'View Task',
    description: 'View task details',
    category: 'task',
    resourceType: 'task',
    action: 'view',
  },
  [TASK_EDIT]: {
    id: TASK_EDIT,
    name: 'Edit Task',
    description: 'Modify task details',
    category: 'task',
    resourceType: 'task',
    action: 'edit',
  },
  [TASK_DELETE]: {
    id: TASK_DELETE,
    name: 'Delete Task',
    description: 'Delete tasks',
    category: 'task',
    resourceType: 'task',
    action: 'delete',
  },
  [TASK_ASSIGN]: {
    id: TASK_ASSIGN,
    name: 'Assign Task',
    description: 'Assign tasks to users',
    category: 'task',
    resourceType: 'task',
    action: 'assign',
  },
  [TASK_COMPLETE]: {
    id: TASK_COMPLETE,
    name: 'Complete Task',
    description: 'Mark tasks as complete',
    category: 'task',
    resourceType: 'task',
    action: 'complete',
  },
  [TASK_MANAGE]: {
    id: TASK_MANAGE,
    name: 'Manage Task',
    description: 'Full task management capabilities',
    category: 'task',
    resourceType: 'task',
    action: 'manage',
  },
  [USER_INVITE]: {
    id: USER_INVITE,
    name: 'Invite User',
    description: 'Invite new users to the company',
    category: 'user',
    resourceType: 'user',
    action: 'invite',
  },
  [USER_REMOVE]: {
    id: USER_REMOVE,
    name: 'Remove User',
    description: 'Remove users from the company',
    category: 'user',
    resourceType: 'user',
    action: 'remove',
  },
  [USER_EDIT]: {
    id: USER_EDIT,
    name: 'Edit User',
    description: 'Modify user profiles',
    category: 'user',
    resourceType: 'user',
    action: 'edit',
  },
  [USER_ROLE_EDIT]: {
    id: USER_ROLE_EDIT,
    name: 'Edit User Roles',
    description: 'Change user role assignments',
    category: 'user',
    resourceType: 'user',
    action: 'edit',
  },
  [USER_VIEW_ALL]: {
    id: USER_VIEW_ALL,
    name: 'View All Users',
    description: 'View all company users',
    category: 'user',
    resourceType: 'user',
    action: 'view',
  },
  [COMPANY_SETTINGS_EDIT]: {
    id: COMPANY_SETTINGS_EDIT,
    name: 'Edit Company Settings',
    description: 'Modify company configuration',
    category: 'company',
    resourceType: 'company',
    action: 'edit',
  },
  [COMPANY_BILLING_EDIT]: {
    id: COMPANY_BILLING_EDIT,
    name: 'Edit Billing',
    description: 'Manage billing and subscription',
    category: 'company',
    resourceType: 'company',
    action: 'edit',
  },
  [COMPANY_FEATURES_MANAGE]: {
    id: COMPANY_FEATURES_MANAGE,
    name: 'Manage Features',
    description: 'Enable or disable company features',
    category: 'company',
    resourceType: 'company',
    action: 'manage',
  },
  [ANALYTICS_VIEW]: {
    id: ANALYTICS_VIEW,
    name: 'View Analytics',
    description: 'Access analytics and reports',
    category: 'analytics',
    resourceType: 'analytics',
    action: 'view',
  },
  [ANALYTICS_EXPORT]: {
    id: ANALYTICS_EXPORT,
    name: 'Export Analytics',
    description: 'Export analytics data',
    category: 'analytics',
    resourceType: 'analytics',
    action: 'export',
  },
  [REPORT_CREATE]: {
    id: REPORT_CREATE,
    name: 'Create Report',
    description: 'Create custom reports',
    category: 'analytics',
    resourceType: 'report',
    action: 'create',
  },
  [REPORT_VIEW]: {
    id: REPORT_VIEW,
    name: 'View Report',
    description: 'View reports',
    category: 'analytics',
    resourceType: 'report',
    action: 'view',
  },
  [WORKFLOW_CREATE]: {
    id: WORKFLOW_CREATE,
    name: 'Create Workflow',
    description: 'Create workflow definitions',
    category: 'workflow',
    resourceType: 'workflow',
    action: 'create',
  },
  [WORKFLOW_EDIT]: {
    id: WORKFLOW_EDIT,
    name: 'Edit Workflow',
    description: 'Modify workflow definitions',
    category: 'workflow',
    resourceType: 'workflow',
    action: 'edit',
  },
  [WORKFLOW_DELETE]: {
    id: WORKFLOW_DELETE,
    name: 'Delete Workflow',
    description: 'Delete workflow definitions',
    category: 'workflow',
    resourceType: 'workflow',
    action: 'delete',
  },
  [WORKFLOW_EXECUTE]: {
    id: WORKFLOW_EXECUTE,
    name: 'Execute Workflow',
    description: 'Execute workflow instances',
    category: 'workflow',
    resourceType: 'workflow',
    action: 'execute',
  },
  [APPROVAL_APPROVE]: {
    id: APPROVAL_APPROVE,
    name: 'Approve',
    description: 'Approve workflow steps',
    category: 'workflow',
    resourceType: 'approval',
    action: 'approve',
  },
  [APPROVAL_REJECT]: {
    id: APPROVAL_REJECT,
    name: 'Reject',
    description: 'Reject workflow steps',
    category: 'workflow',
    resourceType: 'approval',
    action: 'reject',
  },
  [APPROVAL_LINE_ASSIGN]: {
    id: APPROVAL_LINE_ASSIGN,
    name: 'Assign Approval Line',
    description: 'Attach an approval line to a task',
    category: 'workflow',
    resourceType: 'approval-line',
    action: 'assign',
  },
  [APPROVAL_LINE_MODIFY]: {
    id: APPROVAL_LINE_MODIFY,
    name: 'Modify Approval Line',
    description: 'Modify a task\'s assigned approval line',
    category: 'workflow',
    resourceType: 'approval-line',
    action: 'edit',
  },
  [ESCALATION_PATH_ASSIGN]: {
    id: ESCALATION_PATH_ASSIGN,
    name: 'Assign Escalation Path',
    description: 'Attach an escalation path to a task',
    category: 'workflow',
    resourceType: 'escalation-path',
    action: 'assign',
  },
  [ESCALATION_PATH_MODIFY]: {
    id: ESCALATION_PATH_MODIFY,
    name: 'Modify Escalation Path',
    description: 'Modify a task\'s assigned escalation path',
    category: 'workflow',
    resourceType: 'escalation-path',
    action: 'edit',
  },
  [WORKFLOW_INSTANCE_VIEW]: {
    id: WORKFLOW_INSTANCE_VIEW,
    name: 'View Workflow Instances',
    description: 'View running workflow instances',
    category: 'workflow',
    resourceType: 'workflow-instance',
    action: 'view',
  },
  [WORKFLOW_INSTANCE_CANCEL]: {
    id: WORKFLOW_INSTANCE_CANCEL,
    name: 'Cancel Workflow Instance',
    description: 'Cancel a running workflow instance',
    category: 'workflow',
    resourceType: 'workflow-instance',
    action: 'cancel',
  },
  [ADMIN_ALL]: {
    id: ADMIN_ALL,
    name: 'Admin All',
    description: 'Bypass all permission checks (system admin)',
    category: 'admin',
    resourceType: 'system',
    action: 'all',
  },
  [ADMIN_ROLE_MANAGE]: {
    id: ADMIN_ROLE_MANAGE,
    name: 'Manage Roles',
    description: 'Create and manage roles',
    category: 'admin',
    resourceType: 'role',
    action: 'manage',
  },
  [ADMIN_POLICY_MANAGE]: {
    id: ADMIN_POLICY_MANAGE,
    name: 'Manage Policies',
    description: 'Create and manage access policies',
    category: 'admin',
    resourceType: 'policy',
    action: 'manage',
  },
  [ADMIN_AUDIT_VIEW]: {
    id: ADMIN_AUDIT_VIEW,
    name: 'View Audit Logs',
    description: 'Access audit and compliance logs',
    category: 'admin',
    resourceType: 'audit',
    action: 'view',
  },
  [DOCUMENT_UPLOAD]: {
    id: DOCUMENT_UPLOAD,
    name: 'Upload Documents',
    description: 'Upload project and task documents',
    category: 'project',
    resourceType: 'document',
    action: 'create',
  },
  [DOCUMENT_VERIFY]: {
    id: DOCUMENT_VERIFY,
    name: 'Verify Documents',
    description: 'Verify and approve uploaded documents',
    category: 'project',
    resourceType: 'document',
    action: 'verify',
  },
  [CUSTOM_FIELD_MANAGE]: {
    id: CUSTOM_FIELD_MANAGE,
    name: 'Manage Custom Fields',
    description: 'Define and manage project custom fields',
    category: 'project',
    resourceType: 'project',
    action: 'manage',
  },
  [PROJECT_INFO_EDIT]: {
    id: PROJECT_INFO_EDIT,
    name: 'Edit Project Info',
    description: 'Edit core project information and technical specs',
    category: 'project',
    resourceType: 'project',
    action: 'edit',
  },
  [CONTRACT_SIGN]: {
    id: CONTRACT_SIGN,
    name: 'Sign Contract',
    description: 'Sign PPAs and other legal agreements',
    category: 'project',
    resourceType: 'contract',
    action: 'sign',
  },
  [SANCTION_APPROVE]: {
    id: SANCTION_APPROVE,
    name: 'Approve Sanction',
    description: 'Approve loan/sanction requests',
    category: 'analytics',
    resourceType: 'financial',
    action: 'approve',
  },
  [DISBURSEMENT_TRACK]: {
    id: DISBURSEMENT_TRACK,
    name: 'Track Disbursement',
    description: 'Track financial disbursements',
    category: 'analytics',
    resourceType: 'financial',
    action: 'view',
  },
}

/**
 * Get all permissions in a category
 */
export function getPermissionsByCategory(category: PermissionMetadata['category']): string[] {
  return Object.values(PERMISSION_METADATA)
    .filter(meta => meta.category === category)
    .map(meta => meta.id)
}

/**
 * Get permission metadata by ID
 */
export function getPermissionMetadata(permissionId: string): PermissionMetadata | undefined {
  return PERMISSION_METADATA[permissionId]
}

/**
 * Check if a permission ID is valid
 */
export function isValidPermission(permissionId: string): boolean {
  return permissionId in PERMISSION_METADATA
}

