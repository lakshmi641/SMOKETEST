// useAccessControl Hook
// React hook for checking permissions using AccessControlService

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { AccessControlService } from '@/lib/services/access-control/access-control-service'
import type { AccessControlContext } from '@/types/access-control-schema'

interface UseAccessControlOptions {
  userId: string
  companyId: string
  groupId?: string
  workspaceId?: string
  projectId?: string
}

interface UseAccessControlReturn {
  /**
   * Check if user can perform an action
   */
  canPerformAction: (
    permission: string,
    context?: {
      resourceType?: string
      resourceId?: string
    }
  ) => boolean
  
  /**
   * Check permission asynchronously (returns Promise)
   */
  checkPermission: (
    permission: string,
    context?: {
      resourceType?: string
      resourceId?: string
    }
  ) => Promise<boolean>
  
  /**
   * Get all user permissions (cached)
   */
  getUserPermissions: () => Promise<Set<string>>
  
  /**
   * Whether permission check is in progress
   */
  isLoading: boolean
  
  /**
   * Clear permission cache
   */
  clearCache: () => void
}

/**
 * useAccessControl Hook
 * Provides permission checking functionality with caching
 * 
 * @example
 * ```tsx
 * const { canPerformAction } = useAccessControl({
 *   userId,
 *   companyId,
 *   workspaceId,
 * })
 * 
 * if (canPerformAction('task.create')) {
 *   // Show create button
 * }
 * ```
 */
export function useAccessControl(
  options: UseAccessControlOptions
): UseAccessControlReturn {
  const [isLoading, setIsLoading] = useState(true) // Start as true since we need to load permissions
  const [permissionsCache, setPermissionsCache] = useState<Set<string> | null>(null)
  
  // Build access control context
  const context: AccessControlContext = useMemo(() => ({
    userId: options.userId,
    companyId: options.companyId,
    groupId: options.groupId,
    workspaceId: options.workspaceId,
    projectId: options.projectId,
  }), [options.userId, options.companyId, options.groupId, options.workspaceId, options.projectId])
  
  // Load permissions on mount
  useEffect(() => {
    let mounted = true
    
    const loadPermissions = async () => {
      setIsLoading(true)
      try {
        const permissions = await AccessControlService.getUserPermissions(
          options.userId,
          options.companyId,
          {
            workspaceId: options.workspaceId,
            projectId: options.projectId,
            groupId: options.groupId,
          }
        )
        if (mounted) {
          setPermissionsCache(permissions)
        }
      } catch (error) {
        console.error('Error loading permissions:', error)
        if (mounted) {
          setPermissionsCache(new Set())
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }
    
    loadPermissions()
    
    return () => {
      mounted = false
    }
  }, [options.userId, options.companyId, options.workspaceId, options.projectId, options.groupId])
  
  // Check permission synchronously (uses cache)
  const canPerformAction = useCallback((
    permission: string,
    additionalContext?: {
      resourceType?: string
      resourceId?: string
    }
  ): boolean => {
    // If cache is available, use it
    if (permissionsCache !== null) {
      return permissionsCache.has(permission) || permissionsCache.has('admin.all')
    }
    
    // Otherwise, return false (will be updated when cache loads)
    return false
  }, [permissionsCache])
  
  // Check permission asynchronously (always fresh)
  const checkPermission = useCallback(async (
    permission: string,
    additionalContext?: {
      resourceType?: string
      resourceId?: string
    }
  ): Promise<boolean> => {
    const fullContext: AccessControlContext = {
      ...context,
      resourceType: additionalContext?.resourceType,
      resourceId: additionalContext?.resourceId,
    }
    
    const result = await AccessControlService.canUserPerformAction(
      options.userId,
      permission,
      fullContext
    )
    
    return result.allowed
  }, [context, options.userId])
  
  // Get all user permissions
  const getUserPermissions = useCallback(async (): Promise<Set<string>> => {
    return AccessControlService.getUserPermissions(
      options.userId,
      options.companyId,
      {
        workspaceId: options.workspaceId,
        projectId: options.projectId,
        groupId: options.groupId,
      }
    )
  }, [options.userId, options.companyId, options.workspaceId, options.projectId, options.groupId])
  
  // Clear cache
  const clearCache = useCallback(() => {
    AccessControlService.clearUserCache(options.userId, options.companyId)
    setPermissionsCache(null)
  }, [options.userId, options.companyId])
  
  return {
    canPerformAction,
    checkPermission,
    getUserPermissions,
    isLoading,
    clearCache,
  }
}

