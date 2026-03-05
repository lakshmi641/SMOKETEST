'use client'

import { useMemo } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { PermissionService } from '@/lib/services/permission-service'
import { CompanyFeatures, CompanyUser } from '@/types/company-schema'

/**
 * Hook to check if company has a specific feature enabled
 */
export function useHasFeature(feature: keyof CompanyFeatures): boolean {
  const { currentCompany } = useCompany()

  return useMemo(() => {
    return PermissionService.hasFeature(currentCompany, feature)
  }, [currentCompany, feature])
}

/**
 * Hook to check if company has all required features enabled
 */
export function useHasAllFeatures(features: (keyof CompanyFeatures)[]): boolean {
  const { currentCompany } = useCompany()

  return useMemo(() => {
    return PermissionService.hasAllFeatures(currentCompany, features)
  }, [currentCompany, features])
}

/**
 * Hook to check if company has any of the required features enabled
 */
export function useHasAnyFeature(features: (keyof CompanyFeatures)[]): boolean {
  const { currentCompany } = useCompany()

  return useMemo(() => {
    return PermissionService.hasAnyFeature(currentCompany, features)
  }, [currentCompany, features])
}

/**
 * Hook to check if user has a specific role
 */
export function useHasRole(roles: string | string[]): boolean {
  const { currentCompanyUser } = useCompany()

  return useMemo(() => {
    return PermissionService.hasRole(currentCompanyUser, roles)
  }, [currentCompanyUser, roles])
}

/**
 * Hook to check if user is admin, owner, or group_admin (group_admin treated same as admin)
 */
export function useIsAdmin(): boolean {
  return useHasRole(['owner', 'admin', 'group_admin'])
}

/**
 * Hook to check if user is manager or above
 */
export function useIsManager(): boolean {
  return useHasRole(['owner', 'admin', 'manager'])
}

/**
 * Hook to check if user is employee or above
 */
export function useIsEmployee(): boolean {
  return useHasRole(['owner', 'admin', 'manager', 'employee'])
}

/**
 * Hook to check if user is viewer
 */
export function useIsViewer(): boolean {
  return useHasRole('viewer')
}

/**
 * Hook to check if user has a specific permission
 */
export function useHasPermission(permission: keyof CompanyUser['permissions']): boolean {
  const { currentCompanyUser } = useCompany()

  return useMemo(() => {
    return PermissionService.hasPermission(currentCompanyUser, permission)
  }, [currentCompanyUser, permission])
}

/**
 * Hook to check if user has any of the required permissions
 */
export function useHasAnyPermission(permissions: (keyof CompanyUser['permissions'])[]): boolean {
  const { currentCompanyUser } = useCompany()

  return useMemo(() => {
    return PermissionService.hasAnyPermission(currentCompanyUser, permissions)
  }, [currentCompanyUser, permissions])
}

/**
 * Hook to check if user can access a route
 */
export function useCanAccessRoute(requirements: {
  requiredFeatures?: (keyof CompanyFeatures)[]
  requiredRoles?: string[]
  requiredPermissions?: (keyof CompanyUser['permissions'])[]
}): boolean {
  const { currentCompany, currentCompanyUser } = useCompany()

  return useMemo(() => {
    return PermissionService.canAccessRoute(currentCompany, currentCompanyUser, requirements)
  }, [currentCompany, currentCompanyUser, requirements])
}

/**
 * Hook to get merged permissions (user permissions + role defaults)
 */
export function useMergedPermissions(): CompanyUser['permissions'] | null {
  const { currentCompanyUser } = useCompany()

  return useMemo(() => {
    if (!currentCompanyUser) {
      return null
    }

    return PermissionService.mergePermissionsWithDefaults(
      currentCompanyUser,
      currentCompanyUser.role
    )
  }, [currentCompanyUser])
}

