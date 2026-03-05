// Access Control Service
// Unified permission resolution combining RBAC, ReBAC, and ABAC

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { companySubcollectionPathSegments } from '../../firestore-paths'
import { RoleService } from './role-service'
import { PolicyService } from './policy-service'
import { getCurrentAssignmentForUser, getPosition } from '../org/org-services'
import { resolveWorkItemAssignment } from '../../../lib/delegation-resolver'
import { CompanyUserService } from '../companies/company-services'
import type {
  PermissionCheckResult,
  AccessControlContext,
  RoleAssignment,
} from '@/types/access-control-schema'
import type { Position, PositionAssignment } from '@/types/org-schema'
import {
  ADMIN_ALL,
  ADMIN_ROLE_MANAGE,
  ADMIN_POLICY_MANAGE,
  ADMIN_AUDIT_VIEW,
  COMPANY_SETTINGS_EDIT,
  COMPANY_BILLING_EDIT,
  COMPANY_FEATURES_MANAGE,
  USER_INVITE,
  USER_REMOVE,
  USER_EDIT,
  USER_ROLE_EDIT,
  USER_VIEW_ALL,
} from '@/lib/constants/permissions'
import { getPermissionsForRole, ADMIN_PERMISSIONS } from '@/lib/constants/role-permissions'

// Helper to convert Firestore timestamps to ISO strings
const convertTimestamps = (data: any): any => {
  if (!data) return data

  const converted = { ...data }
  Object.keys(converted).forEach(key => {
    if (converted[key] instanceof Timestamp) {
      converted[key] = converted[key].toDate().toISOString()
    } else if (typeof converted[key] === 'object' && converted[key] !== null) {
      converted[key] = convertTimestamps(converted[key])
    }
  })

  return converted
}

/**
 * Permission cache to avoid repeated Firestore queries
 * Cache is per-user and expires after 5 minutes
 */
interface PermissionCacheEntry {
  permissions: Set<string>
  expiresAt: number
}

const permissionCache = new Map<string, PermissionCacheEntry>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Access Control Service
 * Implements unified permission resolution as per ACCESS_CONTROL_DESIGN.md
 */
export class AccessControlService {
  /**
   * Main permission check method
   * Resolution flow:
   * 1. Check if admin (bypass)
   * 2. Check direct role assignments
   * 3. Check position-based inheritance
   * 4. Check delegations
   * 5. Check access policies (ABAC)
   * 6. Deny if none match
   */
  static async canUserPerformAction(
    userId: string,
    permission: string,
    context: AccessControlContext
  ): Promise<PermissionCheckResult> {
    const startTime = Date.now()

    try {
      // 1. Check if user is admin (bypass all checks)
      const isAdmin = await this.isAdmin(userId, context.companyId, context.groupId)
      if (isAdmin) {
        return {
          allowed: true,
          reason: 'admin',
          checkedAt: new Date().toISOString(),
        }
      }

      // 2. Check dynamic workspace authority (Unified Admin Array)
      const workspaceCheck = await this.checkDynamicWorkspaceAuthority(
        userId,
        permission,
        context
      )
      if (workspaceCheck.allowed) {
        return workspaceCheck
      }

      // 3. Check direct role assignments
      const directRoleCheck = await this.checkDirectRoles(
        userId,
        permission,
        context
      )
      if (directRoleCheck.allowed) {
        return directRoleCheck
      }

      // 3. Check position-based inheritance
      const positionCheck = await this.checkPositionInheritance(
        userId,
        permission,
        context
      )
      if (positionCheck.allowed) {
        return positionCheck
      }

      // 4. Check delegations
      const delegationCheck = await this.checkDelegations(
        userId,
        permission,
        context
      )
      if (delegationCheck.allowed) {
        return delegationCheck
      }

      // 5. Check access policies (ABAC) - DISABLED
      // Access policies feature has been removed
      // const policyCheck = await this.checkAccessPolicies(
      //   userId,
      //   permission,
      //   context
      // )
      // if (policyCheck.allowed) {
      //   return policyCheck
      // }

      // 6. Deny if none match
      return {
        allowed: false,
        reason: 'denied',
        checkedAt: new Date().toISOString(),
      }
    } catch (error) {
      console.error('Error checking permission:', error)
      // Fail closed - deny on error
      return {
        allowed: false,
        reason: 'denied',
        checkedAt: new Date().toISOString(),
      }
    }
  }

  /**
   * Check if user is admin in the given company.
   * When groupId is provided (multi-org), resolves from enterprise path and falls back to group user roles map.
   */
  public static async isAdmin(userId: string, companyId: string, groupId?: string): Promise<boolean> {
    try {
      const companyUser = await CompanyUserService.getCompanyUser(companyId, userId, groupId)
      if (companyUser) {
        // group_admin has same admin capabilities as admin (platform-created first user)
        if (companyUser.role === 'owner' || companyUser.role === 'admin' || companyUser.role === 'group_admin') {
          return true
        }
        const userPermissions = await this.getUserPermissions(userId, companyId)
        return userPermissions.has(ADMIN_ALL)
      }
      // Multi-org: no company-level user doc; check group user's roles[companyId] (user in multiple companies)
      if (groupId) {
        const groupUser = await CompanyUserService.getEnterpriseGroupUser(groupId, userId)
        if (groupUser?.roles?.[companyId]) {
          const r = groupUser.roles[companyId]
          // group_admin has same admin capabilities as admin
          if (r === 'owner' || r === 'admin' || r === 'group_admin' || r === 'manager') return true
        }
      }
      return false
    } catch (error) {
      console.error('Error checking admin status:', error)
      return false
    }
  }

  /**
   * Check dynamic workspace authority (Unified Admin List)
   */
  private static async checkDynamicWorkspaceAuthority(
    userId: string,
    permission: string,
    context: AccessControlContext
  ): Promise<PermissionCheckResult> {
    if (!context.workspaceId) {
      return { allowed: false, reason: 'denied', checkedAt: new Date().toISOString() }
    }

    try {
      const workspaceRef = doc(db, `companies/${context.companyId}/workspaces`, context.workspaceId)
      const workspaceSnap = await getDoc(workspaceRef)

      if (!workspaceSnap.exists()) {
        return { allowed: false, reason: 'denied', checkedAt: new Date().toISOString() }
      }

      const data = workspaceSnap.data()
      // Backward compatibility: check both old and new field names
      const oldAdminIds = Array.isArray(data.adminIds) ? data.adminIds : []
      const ownerId = data.ownerId || (oldAdminIds.length > 0 ? oldAdminIds[0] : null)
      const oldSpocIds = Array.isArray(data.spocIds) ? data.spocIds : []
      const members = Array.isArray(data.members) ? data.members : oldSpocIds
      const createdBy = data.createdBy

      // 1. Check Administrative Authority (Owner or Creator)
      if (ownerId === userId || createdBy === userId) {
        // Full scoped authority
        if (permission.startsWith('workspace.') ||
          permission.startsWith('project.') ||
          permission.startsWith('task.') ||
          permission.startsWith('milestone.')) {
          return {
            allowed: true,
            reason: 'workspace_admin',
            checkedAt: new Date().toISOString(),
          }
        }
      }

      // 2. Check Member Authority (Workspace Members)
      if (Array.isArray(members) && members.includes(userId)) {
        // Members get standard execution permissions
        const memberPermissions = [
          'task.view', 'task.create', 'task.edit', 'task.comment',
          'project.view', 'milestone.view'
        ]

        if (memberPermissions.includes(permission)) {
          return {
            allowed: true,
            reason: 'workspace_member',
            checkedAt: new Date().toISOString(),
          }
        }
      }

      return { allowed: false, reason: 'denied', checkedAt: new Date().toISOString() }
    } catch (error) {
      console.error('Error checking dynamic workspace authority:', error)
      return { allowed: false, reason: 'denied', checkedAt: new Date().toISOString() }
    }
  }

  /**
   * Public utility to check if a user is a member of a workspace
   */
  public static async isWorkspaceMember(companyId: string, workspaceId: string, userId: string): Promise<boolean> {
    try {
      const workspaceRef = doc(db, `companies/${companyId}/workspaces`, workspaceId)
      const workspaceSnap = await getDoc(workspaceRef)

      if (!workspaceSnap.exists()) return false

      const data = workspaceSnap.data()
      // Backward compatibility: check both old and new field names
      const oldAdminIds = Array.isArray(data.adminIds) ? data.adminIds : []
      const ownerId = data.ownerId || (oldAdminIds.length > 0 ? oldAdminIds[0] : null)
      const oldSpocIds = Array.isArray(data.spocIds) ? data.spocIds : []
      const members = Array.isArray(data.members) ? data.members : oldSpocIds
      const createdBy = data.createdBy

      return ownerId === userId || (Array.isArray(members) && members.includes(userId)) || createdBy === userId
    } catch (e) {
      console.error('Error in isWorkspaceMember check:', e)
      return false
    }
  }

  /**
   * Check direct role assignments
   */
  private static async checkDirectRoles(
    userId: string,
    permission: string,
    context: AccessControlContext
  ): Promise<PermissionCheckResult> {
    try {
      // Check legacy/simplified role field on CompanyUser
      const companyUser = await CompanyUserService.getCompanyUser(
        context.companyId,
        userId,
        context.groupId
      )

      if (companyUser && companyUser.role) {
        // Normalize role to lowercase for comparison
        const roleName = companyUser.role.toLowerCase()

        // Check if it's one of the core roles (group_admin treated same as admin)
        if (['admin', 'manager', 'employee', 'owner', 'group_admin'].includes(roleName)) {
          const effectiveRole = roleName === 'owner' || roleName === 'group_admin' ? 'admin' : roleName
          const permissions = getPermissionsForRole(effectiveRole)

          if (permissions.includes(permission) || permissions.includes(ADMIN_ALL)) {
            return {
              allowed: true,
              reason: 'direct_role',
              roleId: 'static_' + effectiveRole,
              roleName: effectiveRole.charAt(0).toUpperCase() + effectiveRole.slice(1),
              checkedAt: new Date().toISOString(),
            }
          }
        }
      }

      const roleAssignments = await this.getUserRoleAssignments(
        userId,
        context.companyId,
        context.workspaceId,
        context.projectId,
        context.groupId
      )

      for (const assignment of roleAssignments) {
        const role = await RoleService.getRole(context.companyId, context.companyId, assignment.roleId)
        if (!role || !Array.isArray(role.permissions)) continue

        if (role.permissions.includes(permission) || role.permissions.includes(ADMIN_ALL)) {
          return {
            allowed: true,
            reason: 'direct_role',
            roleId: role.id,
            roleName: role.name,
            checkedAt: new Date().toISOString(),
          }
        }
      }

      return {
        allowed: false,
        reason: 'denied',
        checkedAt: new Date().toISOString(),
      }
    } catch (error) {
      console.error('Error checking direct roles:', error)
      return {
        allowed: false,
        reason: 'denied',
        checkedAt: new Date().toISOString(),
      }
    }
  }

  /**
   * Check position-based inheritance
   */
  private static async checkPositionInheritance(
    userId: string,
    permission: string,
    context: AccessControlContext
  ): Promise<PermissionCheckResult> {
    try {
      // Get user's active position assignment
      const assignment = await getCurrentAssignmentForUser(context.companyId, userId, context.groupId)
      if (!assignment) {
        return {
          allowed: false,
          reason: 'denied',
          checkedAt: new Date().toISOString(),
        }
      }

      // Get position details
      const position = await getPosition(context.companyId, assignment.positionId, context.groupId)
      if (!position) {
        return {
          allowed: false,
          reason: 'denied',
          checkedAt: new Date().toISOString(),
        }
      }

      // Check if position has associated roles (via PositionRoleMapping)
      const positionRoleMappings = await this.getPositionRoleMappings(
        context.companyId,
        assignment.positionId
      )

      for (const mapping of positionRoleMappings) {
        const role = await RoleService.getRole(context.companyId, context.companyId, mapping.roleId)
        if (!role || !Array.isArray(role.permissions)) continue

        if (role.permissions.includes(permission) || role.permissions.includes(ADMIN_ALL)) {
          return {
            allowed: true,
            reason: 'position_inheritance',
            roleId: role.id,
            roleName: role.name,
            checkedAt: new Date().toISOString(),
          }
        }
      }

      // TODO: Traverse hierarchy for manager permissions (optional, configurable)
      // This would check reportsToPositionId chain

      return {
        allowed: false,
        reason: 'denied',
        checkedAt: new Date().toISOString(),
      }
    } catch (error) {
      console.error('Error checking position inheritance:', error)
      return {
        allowed: false,
        reason: 'denied',
        checkedAt: new Date().toISOString(),
      }
    }
  }

  /**
   * Check delegations
   */
  private static async checkDelegations(
    userId: string,
    permission: string,
    context: AccessControlContext
  ): Promise<PermissionCheckResult> {
    try {
      // Delegations are primarily for work item assignments, not permissions
      // But we can check if user has delegated authority that grants permissions
      // For now, delegations are handled separately in work item resolution
      // This is a placeholder for future delegation-based permission checks

      return {
        allowed: false,
        reason: 'denied',
        checkedAt: new Date().toISOString(),
      }
    } catch (error) {
      console.error('Error checking delegations:', error)
      return {
        allowed: false,
        reason: 'denied',
        checkedAt: new Date().toISOString(),
      }
    }
  }

  /**
   * Check access policies (ABAC)
   */
  private static async checkAccessPolicies(
    userId: string,
    permission: string,
    context: AccessControlContext
  ): Promise<PermissionCheckResult> {
    try {
      // Get user's position and assignment for policy evaluation
      const assignment = await getCurrentAssignmentForUser(context.companyId, userId, context.groupId)
      const position = assignment
        ? await getPosition(context.companyId, assignment.positionId, context.groupId)
        : null

      const userAttributes = {
        position,
        positionAssignment: assignment,
        departmentId: position?.orgUnitId,
        userId,
        companyId: context.companyId,
      }

      // Get applicable policies
      const policies = await PolicyService.getApplicablePolicies(
        context.companyId,
        userAttributes,
        context.groupId
      )

      // Check each policy for the requested permission
      for (const policy of policies) {
        // Check if policy grants the permission directly
        if (policy.grant.permissions?.includes(permission)) {
          return {
            allowed: true,
            reason: 'policy',
            policyId: policy.id,
            policyName: policy.name,
            checkedAt: new Date().toISOString(),
          }
        }

        // Check if policy grants a role that has the permission
        if (policy.grant.roleId) {
          const role = await RoleService.getRole(context.companyId, context.companyId, policy.grant.roleId)
          if (role && Array.isArray(role.permissions) && (role.permissions.includes(permission) || role.permissions.includes(ADMIN_ALL))) {
            // Check resource scope
            if (this.checkResourceScope(policy.grant.resourceScope, context)) {
              return {
                allowed: true,
                reason: 'policy',
                policyId: policy.id,
                policyName: policy.name,
                roleId: role.id,
                roleName: role.name,
                checkedAt: new Date().toISOString(),
              }
            }
          }
        }
      }

      return {
        allowed: false,
        reason: 'denied',
        checkedAt: new Date().toISOString(),
      }
    } catch (error) {
      console.error('Error checking access policies:', error)
      return {
        allowed: false,
        reason: 'denied',
        checkedAt: new Date().toISOString(),
      }
    }
  }

  /**
   * Check if resource scope matches context
   */
  private static checkResourceScope(
    resourceScope: string,
    context: AccessControlContext
  ): boolean {
    switch (resourceScope) {
      case 'all_workspaces':
        return true // Applies to all workspaces
      case 'own_department':
        // Would need to check user's department
        return true // Placeholder
      case 'own_workspace':
        return !!context.workspaceId // Must be in a workspace
      case 'assigned_projects':
        return !!context.projectId // Must be in a project
      case 'all':
        return true
      default:
        return false
    }
  }

  /**
   * Get user's role assignments
   */
  private static async getUserRoleAssignments(
    userId: string,
    companyId: string,
    workspaceId?: string,
    projectId?: string,
    groupId?: string
  ): Promise<RoleAssignment[]> {
    try {
      const effectiveGroupId = groupId || companyId
      const segments = companySubcollectionPathSegments(effectiveGroupId, companyId, 'roleAssignments')
      const assignmentsRef = collection(db, segments[0], ...segments.slice(1))

      // Get system-level assignments
      const systemQuery = query(
        assignmentsRef,
        where('userId', '==', userId),
        where('scopeType', '==', 'system'),
        where('status', '==', 'active')
      )

      // Get workspace-level assignments if workspaceId provided
      const workspaceQueries = workspaceId
        ? [
          query(
            assignmentsRef,
            where('userId', '==', userId),
            where('scopeType', '==', 'workspace'),
            where('scopeId', '==', workspaceId),
            where('status', '==', 'active')
          ),
        ]
        : []

      // Get project-level assignments if projectId provided
      const projectQueries = projectId
        ? [
          query(
            assignmentsRef,
            where('userId', '==', userId),
            where('scopeType', '==', 'project'),
            where('scopeId', '==', projectId),
            where('status', '==', 'active')
          ),
        ]
        : []

      // Execute all queries
      const [systemSnap, ...workspaceSnaps] = await Promise.all([
        getDocs(systemQuery),
        ...workspaceQueries.map(q => getDocs(q)),
        ...projectQueries.map(q => getDocs(q)),
      ])

      const assignments: RoleAssignment[] = []

      // Collect system assignments
      systemSnap.docs.forEach(doc => {
        assignments.push({
          id: doc.id,
          ...convertTimestamps(doc.data()),
        } as RoleAssignment)
      })

      // Collect workspace assignments
      workspaceSnaps.forEach(snap => {
        snap.docs.forEach(doc => {
          assignments.push({
            id: doc.id,
            ...convertTimestamps(doc.data()),
          } as RoleAssignment)
        })
      })

      // Filter expired assignments
      const now = new Date().toISOString()
      return assignments.filter(a => !a.expiresAt || a.expiresAt > now)
    } catch (error: any) {
      if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
        console.warn('getUserRoleAssignments: permission denied, returning empty list', { companyId, userId, groupId })
        return []
      }
      console.error('Error getting user role assignments:', error)
      return []
    }
  }

  /**
   * Get position role mappings
   */
  private static async getPositionRoleMappings(
    companyId: string,
    positionId: string
  ): Promise<Array<{ roleId: string; isActive: boolean }>> {
    try {
      const mappingsRef = collection(db, 'companies', companyId, 'positionRoleMappings')
      const q = query(
        mappingsRef,
        where('positionId', '==', positionId),
        where('isActive', '==', true)
      )

      const snapshot = await getDocs(q)
      return snapshot.docs.map(doc => ({
        roleId: doc.data().roleId,
        isActive: doc.data().isActive,
      }))
    } catch (error) {
      console.error('Error getting position role mappings:', error)
      return []
    }
  }

  /**
   * Get all permissions for a user (cached)
   */
  static async getUserPermissions(
    userId: string,
    companyId: string,
    context?: { workspaceId?: string; projectId?: string; groupId?: string }
  ): Promise<Set<string>> {
    const cacheKey = `${userId}:${companyId}:${context?.workspaceId || ''}:${context?.projectId || ''}:${context?.groupId || ''}`
    const cached = permissionCache.get(cacheKey)

    if (cached && cached.expiresAt > Date.now()) {
      return cached.permissions
    }

    // Build permission set
    const permissions = new Set<string>()
    const groupId = context?.groupId

    try {
    // Backward compatibility: Check old CompanyUser.role field
    // This ensures admin users get proper permissions during migration period
    const companyUser = await CompanyUserService.getCompanyUser(companyId, userId, groupId)
    if (companyUser) {
      // Check simplified roles (group_admin treated same as admin)
      const roleName = companyUser.role.toLowerCase()
      const effectiveRole = roleName === 'owner' || roleName === 'group_admin' ? 'admin' : roleName

      if (['admin', 'manager', 'employee'].includes(effectiveRole)) {
        const rolePermissions = getPermissionsForRole(effectiveRole)
        rolePermissions.forEach(perm => permissions.add(perm))
      }
    }

    // Get role assignments
    const assignments = await this.getUserRoleAssignments(
      userId,
      companyId,
      context?.workspaceId,
      context?.projectId,
      groupId
    )

    for (const assignment of assignments) {
      const role = await RoleService.getRole(companyId, companyId, assignment.roleId)
      if (role && Array.isArray(role.permissions)) {
        role.permissions.forEach(perm => permissions.add(perm))
      }
    }

    // Get position-based permissions
    const assignment = await getCurrentAssignmentForUser(companyId, userId, groupId)
    if (assignment) {
      const mappings = await this.getPositionRoleMappings(companyId, assignment.positionId)
      for (const mapping of mappings) {
        const role = await RoleService.getRole(companyId, companyId, mapping.roleId)
        if (role && Array.isArray(role.permissions)) {
          role.permissions.forEach(perm => permissions.add(perm))
        }
      }
    }

    // Get policy-based permissions
    const position = assignment
      ? await getPosition(companyId, assignment.positionId)
      : null

    const userAttributes = {
      position,
      positionAssignment: assignment,
      departmentId: position?.orgUnitId,
      userId,
      companyId,
    }

    const policies = await PolicyService.getApplicablePolicies(companyId, userAttributes, groupId)
    for (const policy of policies) {
      if (policy.grant.permissions && Array.isArray(policy.grant.permissions)) {
        policy.grant.permissions.forEach(perm => permissions.add(perm))
      }
      if (policy.grant.roleId) {
        const role = await RoleService.getRole(companyId, companyId, policy.grant.roleId)
        if (role && Array.isArray(role.permissions)) {
          role.permissions.forEach(perm => permissions.add(perm))
        }
      }
    }

    // Cache the result
    permissionCache.set(cacheKey, {
      permissions,
      expiresAt: Date.now() + CACHE_TTL_MS,
    })

    return permissions
    } catch (err: any) {
      if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
        console.warn('getUserPermissions: permission denied, returning empty set', { companyId, userId, groupId })
        permissionCache.set(cacheKey, { permissions: new Set<string>(), expiresAt: Date.now() + CACHE_TTL_MS })
        return new Set<string>()
      }
      throw err
    }
  }

  /**
   * Clear permission cache for a user
   */
  static clearUserCache(userId: string, companyId?: string): void {
    if (companyId) {
      const prefix = `${userId}:${companyId}`
      for (const key of permissionCache.keys()) {
        if (key.startsWith(prefix)) {
          permissionCache.delete(key)
        }
      }
    } else {
      // Clear all entries for this user
      for (const key of permissionCache.keys()) {
        if (key.startsWith(`${userId}:`)) {
          permissionCache.delete(key)
        }
      }
    }
  }

  /**
   * Clear all permission cache
   */
  static clearAllCache(): void {
    permissionCache.clear()
  }
}

