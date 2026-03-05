// Can Component
// Permission-based conditional rendering component

'use client'

import { ReactNode } from 'react'
import { useAccessControl } from '@/hooks/useAccessControl'

interface CanProps {
  /**
   * Permission to check (e.g., "task.create", "project.edit")
   */
  permission: string
  
  /**
   * Resource type (e.g., "task", "project", "workspace")
   */
  resourceType?: string
  
  /**
   * Resource ID (optional, for resource-specific checks)
   */
  resourceId?: string
  
  /**
   * Workspace ID (optional, for workspace-scoped checks)
   */
  workspaceId?: string
  
  /**
   * Project ID (optional, for project-scoped checks)
   */
  projectId?: string
  
  /**
   * Company ID (required)
   */
  companyId: string
  
  /**
   * User ID (required)
   */
  userId: string
  
  /**
   * Enterprise group ID (optional, for multi-org; improves permission resolution)
   */
  groupId?: string | null
  
  /**
   * Content to render if permission is granted
   */
  children: ReactNode
  
  /**
   * Content to render if permission is denied (optional)
   */
  fallback?: ReactNode
  
  /**
   * Show loading state while checking permission
   */
  loading?: ReactNode
}

/**
 * Can Component
 * Conditionally renders children based on user permissions
 * 
 * @example
 * ```tsx
 * <Can 
 *   permission="task.create" 
 *   companyId={companyId}
 *   userId={userId}
 *   workspaceId={workspaceId}
 * >
 *   <CreateTaskButton />
 * </Can>
 * ```
 */
export function Can({
  permission,
  resourceType,
  resourceId,
  workspaceId,
  projectId,
  companyId,
  userId,
  groupId,
  children,
  fallback = null,
  loading = null,
}: CanProps) {
  const { canPerformAction, isLoading } = useAccessControl({
    userId,
    companyId,
    groupId: groupId ?? undefined,
    workspaceId,
    projectId,
  })
  
  // Show loading state while checking permission
  // Don't show fallback until we've actually checked permissions
  if (isLoading) {
    return loading ? <>{loading}</> : null
  }
  
  // Check permission - only check if we have a loaded cache
  // If cache is null and not loading, something went wrong, but don't show fallback immediately
  const hasPermission = canPerformAction(permission, {
    resourceType,
    resourceId,
  })
  
  // Render children if permission granted, fallback otherwise
  // Only show fallback if we've actually loaded permissions and user doesn't have access
  return hasPermission ? <>{children}</> : <>{fallback}</>
}

/**
 * CanAny Component
 * Renders children if user has ANY of the specified permissions
 */
interface CanAnyProps extends Omit<CanProps, 'permission'> {
  permissions: string[]
}

export function CanAny({
  permissions,
  ...props
}: CanAnyProps) {
  const { canPerformAction, isLoading } = useAccessControl({
    userId: props.userId,
    companyId: props.companyId,
    groupId: props.groupId ?? undefined,
    workspaceId: props.workspaceId,
    projectId: props.projectId,
  })
  
  if (isLoading && props.loading) {
    return <>{props.loading}</>
  }
  
  const hasAnyPermission = permissions.some(permission =>
    canPerformAction(permission, {
      resourceType: props.resourceType,
      resourceId: props.resourceId,
    })
  )
  
  return hasAnyPermission ? <>{props.children}</> : <>{props.fallback}</>
}

/**
 * CanAll Component
 * Renders children if user has ALL of the specified permissions
 */
interface CanAllProps extends Omit<CanProps, 'permission'> {
  permissions: string[]
}

export function CanAll({
  permissions,
  ...props
}: CanAllProps) {
  const { canPerformAction, isLoading } = useAccessControl({
    userId: props.userId,
    companyId: props.companyId,
    groupId: props.groupId ?? undefined,
    workspaceId: props.workspaceId,
    projectId: props.projectId,
  })
  
  if (isLoading && props.loading) {
    return <>{props.loading}</>
  }
  
  const hasAllPermissions = permissions.every(permission =>
    canPerformAction(permission, {
      resourceType: props.resourceType,
      resourceId: props.resourceId,
    })
  )
  
  return hasAllPermissions ? <>{props.children}</> : <>{props.fallback}</>
}

