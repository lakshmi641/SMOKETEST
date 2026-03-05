// requirePermission Utility
// Helper for enforcing permissions in server actions and API routes

import { AccessControlService } from '../services/access-control/access-control-service'
import type { AccessControlContext } from '@/types/access-control-schema'

/**
 * Require a permission - throws error if user doesn't have permission
 * Use this in server actions and API routes
 * 
 * @example
 * ```ts
 * export async function createTask(data: TaskData, userId: string, companyId: string) {
 *   await requirePermission(userId, 'task.create', { companyId, workspaceId: data.workspaceId })
 *   // ... create task logic
 * }
 * ```
 */
export async function requirePermission(
  userId: string,
  permission: string,
  context: AccessControlContext
): Promise<void> {
  const result = await AccessControlService.canUserPerformAction(
    userId,
    permission,
    context
  )
  
  if (!result.allowed) {
    throw new Error(
      `Permission denied: User ${userId} does not have permission "${permission}"` +
      (result.reason ? ` (reason: ${result.reason})` : '')
    )
  }
}

/**
 * Require any of the specified permissions
 */
export async function requireAnyPermission(
  userId: string,
  permissions: string[],
  context: AccessControlContext
): Promise<void> {
  for (const permission of permissions) {
    const result = await AccessControlService.canUserPerformAction(
      userId,
      permission,
      context
    )
    
    if (result.allowed) {
      return // User has at least one permission
    }
  }
  
  throw new Error(
    `Permission denied: User ${userId} does not have any of the required permissions: ${permissions.join(', ')}`
  )
}

/**
 * Require all of the specified permissions
 */
export async function requireAllPermissions(
  userId: string,
  permissions: string[],
  context: AccessControlContext
): Promise<void> {
  for (const permission of permissions) {
    const result = await AccessControlService.canUserPerformAction(
      userId,
      permission,
      context
    )
    
    if (!result.allowed) {
      throw new Error(
        `Permission denied: User ${userId} does not have permission "${permission}"`
      )
    }
  }
}

/**
 * Check permission without throwing (returns boolean)
 */
export async function checkPermission(
  userId: string,
  permission: string,
  context: AccessControlContext
): Promise<boolean> {
  const result = await AccessControlService.canUserPerformAction(
    userId,
    permission,
    context
  )
  
  return result.allowed
}

