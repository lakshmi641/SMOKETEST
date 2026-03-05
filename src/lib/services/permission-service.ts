/**
 * Permission Service for Navigation and Route Access Control
 * 
 * This service provides centralized permission checking logic that combines:
 * - Company feature flags (from platform)
 * - User roles (owner, admin, manager, employee, viewer)
 * - User permissions (granular permissions)
 * 
 * NOTE: This service now uses AccessControlService internally for permission checks
 * while maintaining backward compatibility with existing code.
 */

import { Company, CompanyUser, CompanyFeatures } from '@/types/company-schema'
import { AccessControlService } from './access-control/access-control-service'
import type { AccessControlContext } from '@/types/access-control-schema'

export class PermissionService {
  /**
   * Check if company has a specific feature enabled
   */
  static hasFeature(company: Company | null, featureKey: keyof CompanyFeatures): boolean {
    if (!company?.features) {
      return false
    }
    
    // Check if feature exists and is enabled
    return company.features[featureKey] === true
  }

  /**
   * Check if company has all required features enabled
   */
  static hasAllFeatures(company: Company | null, featureKeys: (keyof CompanyFeatures)[]): boolean {
    if (!company?.features || featureKeys.length === 0) {
      return featureKeys.length === 0 // Empty array means no requirements
    }
    
    return featureKeys.every(key => this.hasFeature(company, key))
  }

  /**
   * Check if company has any of the required features enabled
   */
  static hasAnyFeature(company: Company | null, featureKeys: (keyof CompanyFeatures)[]): boolean {
    if (!company?.features || featureKeys.length === 0) {
      return featureKeys.length === 0
    }
    
    return featureKeys.some(key => this.hasFeature(company, key))
  }

  /**
   * Check if user has a specific role
   */
  static hasRole(user: CompanyUser | null, roles: string | string[]): boolean {
    if (!user?.role) {
      return false
    }

    const roleArray = Array.isArray(roles) ? roles : [roles]
    return roleArray.includes(user.role)
  }

  /**
   * Check if user has a specific permission
   * Now uses AccessControlService for new permission system while maintaining backward compatibility
   */
  static hasPermission(
    user: CompanyUser | null, 
    permission: keyof CompanyUser['permissions'],
    context?: {
      companyId?: string
      workspaceId?: string
      projectId?: string
    }
  ): boolean {
    if (!user) {
      return false
    }

    // Try new access control system first if context is provided
    if (context?.companyId && user.userId) {
      try {
        // Map old permission keys to new permission strings
        const permissionMap: Record<string, string> = {
          canCreateProjects: 'project.create',
          canEditProjects: 'project.edit',
          canDeleteProjects: 'project.delete',
          canViewAllProjects: 'project.view',
          canInviteUsers: 'user.invite',
          canRemoveUsers: 'user.remove',
          canEditUserRoles: 'user.role.edit',
          canEditCompanySettings: 'company.settings.edit',
          canEditBilling: 'company.billing.edit',
          canViewAnalytics: 'analytics.view',
          isOwner: 'admin.all',
          isAdmin: 'admin.all',
        }

        const newPermission = permissionMap[permission]
        if (newPermission) {
          // Use AccessControlService for new permission system
          // Note: This is async, but we maintain sync interface for backward compatibility
          // In practice, callers should use AccessControlService directly for async checks
          // This is a best-effort synchronous check using cached permissions
          const accessContext: AccessControlContext = {
            userId: user.userId,
            companyId: context.companyId,
            workspaceId: context.workspaceId,
            projectId: context.projectId,
          }
          
          // For now, fall back to old system for sync compatibility
          // Full migration should use AccessControlService.canUserPerformAction() directly
        }
      } catch (error) {
        // Fall through to old system on error
        console.warn('Error checking permission with AccessControlService, falling back to old system:', error)
      }
    }

    // Fall back to old permission system for backward compatibility
    if (!user.permissions) {
      return false
    }

    return user.permissions[permission] === true
  }

  /**
   * Check if user has any of the required permissions
   */
  static hasAnyPermission(user: CompanyUser | null, permissions: (keyof CompanyUser['permissions'])[]): boolean {
    if (!user?.permissions || permissions.length === 0) {
      return permissions.length === 0 // No requirements = allowed
    }

    return permissions.some(perm => this.hasPermission(user, perm))
  }

  /**
   * Check if user has all required permissions
   */
  static hasAllPermissions(user: CompanyUser | null, permissions: (keyof CompanyUser['permissions'])[]): boolean {
    if (!user?.permissions || permissions.length === 0) {
      return permissions.length === 0
    }

    return permissions.every(perm => this.hasPermission(user, perm))
  }

  /**
   * Check if user can access a route based on requirements
   * Enhanced to support both old and new permission systems
   */
  static canAccessRoute(
    company: Company | null,
    user: CompanyUser | null,
    requirements: {
      requiredFeatures?: (keyof CompanyFeatures)[]
      requiredRoles?: string[]
      requiredPermissions?: (keyof CompanyUser['permissions'])[]
    },
    context?: {
      workspaceId?: string
      projectId?: string
    }
  ): boolean {
    // If no requirements, allow access
    if (
      (!requirements.requiredFeatures || requirements.requiredFeatures.length === 0) &&
      (!requirements.requiredRoles || requirements.requiredRoles.length === 0) &&
      (!requirements.requiredPermissions || requirements.requiredPermissions.length === 0)
    ) {
      return true
    }

    // Check features (ALL must be enabled)
    if (requirements.requiredFeatures && requirements.requiredFeatures.length > 0) {
      if (!this.hasAllFeatures(company, requirements.requiredFeatures)) {
        return false
      }
    }

    // Check roles (user must have ONE of the roles)
    if (requirements.requiredRoles && requirements.requiredRoles.length > 0) {
      if (!this.hasRole(user, requirements.requiredRoles)) {
        // If role check fails, check if permissions can override
        if (!requirements.requiredPermissions || requirements.requiredPermissions.length === 0) {
          return false
        }
        // Continue to permission check
      } else {
        // Role check passed, allow access (unless permissions are also required)
        if (!requirements.requiredPermissions || requirements.requiredPermissions.length === 0) {
          return true
        }
      }
    }

    // Check permissions (user must have ONE of the permissions)
    if (requirements.requiredPermissions && requirements.requiredPermissions.length > 0) {
      const permissionContext = context && company ? {
        companyId: company.id,
        workspaceId: context.workspaceId,
        projectId: context.projectId,
      } : undefined
      
      if (!this.hasAnyPermission(user, requirements.requiredPermissions)) {
        // If role check already passed, we allow (role OR permission)
        if (requirements.requiredRoles && this.hasRole(user, requirements.requiredRoles)) {
          return true
        }
        return false
      }
    }

    return true
  }

  /**
   * Get the reason why access was denied
   * Returns the first reason found: 'feature', 'role', or 'permission'
   */
  static getAccessDenialReason(
    company: Company | null,
    user: CompanyUser | null,
    requirements: {
      requiredFeatures?: (keyof CompanyFeatures)[]
      requiredRoles?: string[]
      requiredPermissions?: (keyof CompanyUser['permissions'])[]
    },
    context?: {
      workspaceId?: string
      projectId?: string
    }
  ): { reason: 'feature' | 'role' | 'permission' | null; missingFeature?: string } {
    // Check features first (ALL must be enabled)
    if (requirements.requiredFeatures && requirements.requiredFeatures.length > 0) {
      if (!this.hasAllFeatures(company, requirements.requiredFeatures)) {
        // Find the first missing feature
        const missingFeature = requirements.requiredFeatures.find(
          feature => !this.hasFeature(company, feature)
        )
        return {
          reason: 'feature',
          missingFeature: missingFeature as string
        }
      }
    }

    // Check roles (user must have ONE of the roles)
    if (requirements.requiredRoles && requirements.requiredRoles.length > 0) {
      if (!this.hasRole(user, requirements.requiredRoles)) {
        // If no permissions to override, it's a role issue
        if (!requirements.requiredPermissions || requirements.requiredPermissions.length === 0) {
          return { reason: 'role' }
        }
        // Continue to permission check
      } else {
        // Role check passed, but if permissions are required, check them
        if (requirements.requiredPermissions && requirements.requiredPermissions.length > 0) {
          const permissionContext = context && company ? {
            companyId: company.id,
            workspaceId: context.workspaceId,
            projectId: context.projectId,
          } : undefined
          
          if (!this.hasAnyPermission(user, requirements.requiredPermissions)) {
            return { reason: 'permission' }
          }
        }
      }
    }

    // Check permissions (user must have ONE of the permissions)
    if (requirements.requiredPermissions && requirements.requiredPermissions.length > 0) {
      const permissionContext = context && company ? {
        companyId: company.id,
        workspaceId: context.workspaceId,
        projectId: context.projectId,
      } : undefined
      
      if (!this.hasAnyPermission(user, requirements.requiredPermissions)) {
        // If role check already passed, we allow (role OR permission)
        if (requirements.requiredRoles && this.hasRole(user, requirements.requiredRoles)) {
          return { reason: null }
        }
        return { reason: 'permission' }
      }
    }

    return { reason: null }
  }

  /**
   * Check permission using new AccessControlService (async)
   * Use this for new code that can handle async operations
   */
  static async checkPermissionAsync(
    userId: string,
    permission: string,
    context: AccessControlContext
  ): Promise<boolean> {
    try {
      const result = await AccessControlService.canUserPerformAction(
        userId,
        permission,
        context
      )
      return result.allowed
    } catch (error) {
      console.error('Error checking permission with AccessControlService:', error)
      return false
    }
  }

  /**
   * Get default permissions for a role
   */
  static getDefaultPermissions(role: CompanyUser['role']): CompanyUser['permissions'] {
    const defaults: Record<CompanyUser['role'], CompanyUser['permissions']> = {
      owner: {
        canCreateProjects: true,
        canEditProjects: true,
        canDeleteProjects: true,
        canViewAllProjects: true,
        canInviteUsers: true,
        canRemoveUsers: true,
        canEditUserRoles: true,
        canEditCompanySettings: true,
        canEditBilling: true,
        canViewAnalytics: true,
        isOwner: true,
        isAdmin: true,
      },
      admin: {
        canCreateProjects: true,
        canEditProjects: true,
        canDeleteProjects: true,
        canViewAllProjects: true,
        canInviteUsers: true,
        canRemoveUsers: true,
        canEditUserRoles: true,
        canEditCompanySettings: true,
        canEditBilling: false,
        canViewAnalytics: true,
        isOwner: false,
        isAdmin: true,
      },
      manager: {
        canCreateProjects: true,
        canEditProjects: true,
        canDeleteProjects: false,
        canViewAllProjects: true,
        canInviteUsers: false,
        canRemoveUsers: false,
        canEditUserRoles: false,
        canEditCompanySettings: false,
        canEditBilling: false,
        canViewAnalytics: true,
        isOwner: false,
        isAdmin: false,
      },
      employee: {
        canCreateProjects: false,
        canEditProjects: false,
        canDeleteProjects: false,
        canViewAllProjects: false,
        canInviteUsers: false,
        canRemoveUsers: false,
        canEditUserRoles: false,
        canEditCompanySettings: false,
        canEditBilling: false,
        canViewAnalytics: false,
        isOwner: false,
        isAdmin: false,
      },
      viewer: {
        canCreateProjects: false,
        canEditProjects: false,
        canDeleteProjects: false,
        canViewAllProjects: false,
        canInviteUsers: false,
        canRemoveUsers: false,
        canEditUserRoles: false,
        canEditCompanySettings: false,
        canEditBilling: false,
        canViewAnalytics: false,
        isOwner: false,
        isAdmin: false,
      },
      group_admin: {
        canCreateProjects: true,
        canEditProjects: true,
        canDeleteProjects: true,
        canViewAllProjects: true,
        canInviteUsers: true,
        canRemoveUsers: true,
        canEditUserRoles: true,
        canEditCompanySettings: true,
        canEditBilling: false,
        canViewAnalytics: true,
        isOwner: false,
        isAdmin: true,
      },
    }

    return defaults[role] || defaults.employee
  }

  /**
   * Merge user permissions with role defaults
   * If permission is not explicitly set, use role default
   */
  static mergePermissionsWithDefaults(
    user: CompanyUser | null,
    role: CompanyUser['role']
  ): CompanyUser['permissions'] {
    if (!user) {
      return this.getDefaultPermissions(role)
    }

    const defaults = this.getDefaultPermissions(role)
    const userPerms = user.permissions || {}

    // Merge: user permissions override defaults, but defaults fill in missing values
    return {
      ...defaults,
      ...userPerms,
    }
  }
}

