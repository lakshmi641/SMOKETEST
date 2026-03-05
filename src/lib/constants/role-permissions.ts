/**
 * Role-Based Permissions Configuration
 * 
 * This file defines the default permissions for each of the 3 core roles.
 * These can be customized per company through the admin settings.
 */

import { PERMISSIONS } from './permissions'

// Types
export type CoreRole = 'admin' | 'manager' | 'employee'

export interface RolePermissionConfig {
    role: CoreRole
    displayName: string
    description: string
    permissions: string[]
}

/**
 * Default permissions for Admin role
 * - Full access to all features
 * - Can manage users, workspaces, projects, and settings
 */
export const ADMIN_PERMISSIONS: string[] = [
    // Workspace permissions
    PERMISSIONS.WORKSPACE_VIEW,
    PERMISSIONS.WORKSPACE_MANAGE,
    PERMISSIONS.WORKSPACE_DELETE,
    PERMISSIONS.WORKSPACE_MEMBER_MANAGE,
    PERMISSIONS.WORKSPACE_SETTINGS_EDIT,

    // Project permissions
    PERMISSIONS.PROJECT_CREATE,
    PERMISSIONS.PROJECT_VIEW,
    PERMISSIONS.PROJECT_EDIT,
    PERMISSIONS.PROJECT_DELETE,
    PERMISSIONS.PROJECT_MANAGE,
    PERMISSIONS.PROJECT_MEMBER_MANAGE,
    PERMISSIONS.PROJECT_BUDGET_VIEW,
    PERMISSIONS.PROJECT_BUDGET_EDIT,

    // Task permissions
    PERMISSIONS.TASK_CREATE,
    PERMISSIONS.TASK_VIEW,
    PERMISSIONS.TASK_EDIT,
    PERMISSIONS.TASK_DELETE,
    PERMISSIONS.TASK_ASSIGN,
    PERMISSIONS.TASK_COMPLETE,
    PERMISSIONS.TASK_MANAGE,

    // User permissions
    PERMISSIONS.USER_INVITE,
    PERMISSIONS.USER_REMOVE,
    PERMISSIONS.USER_EDIT,
    PERMISSIONS.USER_ROLE_EDIT,
    PERMISSIONS.USER_VIEW_ALL,

    // Company permissions
    PERMISSIONS.COMPANY_SETTINGS_EDIT,
    PERMISSIONS.COMPANY_BILLING_EDIT,
    PERMISSIONS.COMPANY_FEATURES_MANAGE,

    // Admin permissions
    PERMISSIONS.ADMIN_ALL,
    PERMISSIONS.ADMIN_ROLE_MANAGE,
    PERMISSIONS.ADMIN_POLICY_MANAGE,
    PERMISSIONS.ADMIN_AUDIT_VIEW,

    // Analytics permissions
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.REPORT_CREATE,
    PERMISSIONS.REPORT_VIEW,

    // Workflow permissions
    PERMISSIONS.WORKFLOW_CREATE,
    PERMISSIONS.WORKFLOW_EDIT,
    PERMISSIONS.WORKFLOW_DELETE,
    PERMISSIONS.WORKFLOW_EXECUTE,
    PERMISSIONS.APPROVAL_APPROVE,
    PERMISSIONS.APPROVAL_REJECT,
    PERMISSIONS.APPROVAL_LINE_ASSIGN,
    PERMISSIONS.APPROVAL_LINE_MODIFY,
    PERMISSIONS.ESCALATION_PATH_ASSIGN,
    PERMISSIONS.ESCALATION_PATH_MODIFY,
    PERMISSIONS.WORKFLOW_INSTANCE_VIEW,
    PERMISSIONS.WORKFLOW_INSTANCE_CANCEL,

    // PM-KUSUM / Manufacturing Admin specific
    PERMISSIONS.DOCUMENT_VERIFY,
    PERMISSIONS.CUSTOM_FIELD_MANAGE,
    PERMISSIONS.PROJECT_INFO_EDIT,
    PERMISSIONS.SANCTION_APPROVE,
]

/**
 * Default permissions for Manager role
 * - Can manage projects and view workspaces
 * - Can assign tasks and manage team members within projects
 */
export const MANAGER_PERMISSIONS: string[] = [
    // Workspace permissions (limited)
    PERMISSIONS.WORKSPACE_VIEW,

    // Project permissions (full within assigned)
    PERMISSIONS.PROJECT_CREATE,
    PERMISSIONS.PROJECT_VIEW,
    PERMISSIONS.PROJECT_EDIT,
    PERMISSIONS.PROJECT_MANAGE,
    PERMISSIONS.PROJECT_MEMBER_MANAGE,
    PERMISSIONS.PROJECT_BUDGET_VIEW,

    // Task permissions (full)
    PERMISSIONS.TASK_CREATE,
    PERMISSIONS.TASK_VIEW,
    PERMISSIONS.TASK_EDIT,
    PERMISSIONS.TASK_DELETE,
    PERMISSIONS.TASK_ASSIGN,
    PERMISSIONS.TASK_COMPLETE,
    PERMISSIONS.TASK_MANAGE,

    // User permissions (limited)
    PERMISSIONS.USER_VIEW_ALL,
    PERMISSIONS.USER_INVITE,

    // Analytics permissions
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_CREATE,

    // Workflow permissions
    PERMISSIONS.WORKFLOW_EXECUTE,
    PERMISSIONS.APPROVAL_APPROVE,
    PERMISSIONS.APPROVAL_REJECT,
    PERMISSIONS.APPROVAL_LINE_ASSIGN,
    PERMISSIONS.APPROVAL_LINE_MODIFY,
    PERMISSIONS.ESCALATION_PATH_ASSIGN,
    PERMISSIONS.ESCALATION_PATH_MODIFY,
    PERMISSIONS.WORKFLOW_INSTANCE_VIEW,
]

/**
 * Default permissions for Employee role
 * - Can view and work on assigned tasks
 * - Can view projects they are members of
 */
export const EMPLOYEE_PERMISSIONS: string[] = [
    // Workspace permissions (view only)
    PERMISSIONS.WORKSPACE_VIEW,

    // Project permissions (view only)
    PERMISSIONS.PROJECT_VIEW,

    // Task permissions (own tasks)
    PERMISSIONS.TASK_VIEW,
    PERMISSIONS.TASK_EDIT, // Can edit details of assigned tasks
    PERMISSIONS.TASK_COMPLETE,
    PERMISSIONS.TASK_CREATE, // Can create subtasks/tasks often

    // Workflow
    PERMISSIONS.WORKFLOW_EXECUTE,
    PERMISSIONS.APPROVAL_APPROVE, // If assigned as approver
    PERMISSIONS.APPROVAL_REJECT, // If assigned as approver
    PERMISSIONS.APPROVAL_LINE_ASSIGN, // Can only assign before status = 'in_progress' (hook logic)
    PERMISSIONS.ESCALATION_PATH_ASSIGN, // Can only assign before status = 'in_progress' (hook logic)
]

/**
 * Default permissions for RPG (Project Developer) role
 * - Restricted monitoring and document upload
 */
export const RPG_PERMISSIONS: string[] = [
    PERMISSIONS.WORKSPACE_VIEW,
    PERMISSIONS.PROJECT_VIEW,
    PERMISSIONS.TASK_VIEW,
    PERMISSIONS.DOCUMENT_UPLOAD,
    PERMISSIONS.CONTRACT_SIGN,
    PERMISSIONS.DISBURSEMENT_TRACK,
    PERMISSIONS.ANALYTICS_VIEW,
]

/**
 * Default permissions for EPC (Technical Operator) role
 * - Limited to assigned project execution evidence
 */
export const EPC_PERMISSIONS: string[] = [
    PERMISSIONS.WORKSPACE_VIEW,
    PERMISSIONS.PROJECT_VIEW,
    PERMISSIONS.TASK_VIEW,
    PERMISSIONS.TASK_EDIT,
    PERMISSIONS.TASK_COMPLETE,
    PERMISSIONS.DOCUMENT_UPLOAD,
]

/**
 * Default permissions for Lender role
 */
export const LENDER_PERMISSIONS: string[] = [
    PERMISSIONS.WORKSPACE_VIEW,
    PERMISSIONS.PROJECT_VIEW,
    PERMISSIONS.PROJECT_BUDGET_VIEW,
    PERMISSIONS.DISBURSEMENT_TRACK,
    PERMISSIONS.ANALYTICS_VIEW,
]

/**
 * Complete role configuration map
 */
export const ROLE_CONFIGS: Record<CoreRole, RolePermissionConfig> = {
    admin: {
        role: 'admin',
        displayName: 'Admin',
        description: 'Full access to all features. Can manage users, workspaces, projects, and settings.',
        permissions: ADMIN_PERMISSIONS,
    },
    manager: {
        role: 'manager',
        displayName: 'Manager',
        description: 'Can manage projects and teams. Can assign tasks and view analytics.',
        permissions: MANAGER_PERMISSIONS,
    },
    employee: {
        role: 'employee',
        displayName: 'Employee',
        description: 'Can view and work on assigned tasks. Limited access to project and workspace settings.',
        permissions: EMPLOYEE_PERMISSIONS,
    },
}

/**
 * Get permissions for a given role
 */
export function getPermissionsForRole(role: CoreRole | string): string[] {
    // Normalize role string
    const normalizedRole = role.toLowerCase()

    if (normalizedRole === 'admin' || normalizedRole === 'owner') {
        return ADMIN_PERMISSIONS
    }

    if (normalizedRole === 'manager') {
        return MANAGER_PERMISSIONS
    }

    if (normalizedRole === 'employee') {
        return EMPLOYEE_PERMISSIONS
    }

    if (normalizedRole === 'rpg' || normalizedRole === 'developer') {
        return RPG_PERMISSIONS
    }

    if (normalizedRole === 'epc' || normalizedRole === 'contractor' || normalizedRole === 'operator') {
        return EPC_PERMISSIONS
    }

    if (normalizedRole === 'lender' || normalizedRole === 'bank') {
        return LENDER_PERMISSIONS
    }

    // Default fallback
    return EMPLOYEE_PERMISSIONS
}

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(role: CoreRole | string, permission: string): boolean {
    const permissions = getPermissionsForRole(role)
    return permissions.includes(permission) || permissions.includes(PERMISSIONS.ADMIN_ALL)
}
