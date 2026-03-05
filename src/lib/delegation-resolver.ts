// Delegation Resolution Service
// Resolves effective assignments considering delegations within 60s SLA

import { resolveEffectiveAssignment } from './services/org/org-services'
import type { WorkItemAssignmentContext } from '@/types/org-schema'

/**
 * Resolve who should work on a specific item, considering position assignments and delegations
 * Target: < 60s resolution time
 * 
 * @param companyId Company ID
 * @param itemType Type of work item (task, project, approval, etc.)
 * @param itemId ID of the work item
 * @param positionId Position responsible for this item
 * @param userId Original user assigned (can be overridden by delegation)
 * @returns Effective assignment context with resolved user and delegation chain
 */
export async function resolveWorkItemAssignment(
  companyId: string,
  itemType: 'task' | 'project' | 'approval' | 'quality_check' | 'safety_inspection',
  itemId: string,
  positionId: string | null,
  userId: string | null,
  groupId?: string
): Promise<WorkItemAssignmentContext> {
  const startTime = Date.now()

  try {
    // If no position specified, use direct user assignment (no delegation possible)
    if (!positionId) {
      return {
        itemType,
        itemId,
        originalPositionId: null,
        originalUserId: userId,
        effectivePositionId: positionId || '',
        effectiveUserId: userId || '',
        effectiveAssignmentId: '',
        delegationChain: [],
        resolvedAt: new Date().toISOString(),
        resolutionTimeMs: Date.now() - startTime,
        usedCache: false,
      }
    }

    // Resolve effective assignment for the position (includes delegation check)
    const effectiveAssignment = await resolveEffectiveAssignment(companyId, positionId, groupId)

    if (!effectiveAssignment) {
      // No active assignment found, return original
      return {
        itemType,
        itemId,
        originalPositionId: positionId,
        originalUserId: userId,
        effectivePositionId: positionId,
        effectiveUserId: userId || '',
        effectiveAssignmentId: '',
        delegationChain: [],
        resolvedAt: new Date().toISOString(),
        resolutionTimeMs: Date.now() - startTime,
        usedCache: false,
      }
    }

    // Build delegation chain if applicable
    const delegationChain = []
    if (effectiveAssignment.isDelegated && effectiveAssignment.originalUserId) {
      delegationChain.push({
        delegationId: effectiveAssignment.delegationId || '',
        fromUserId: effectiveAssignment.originalUserId,
        toUserId: effectiveAssignment.userId,
        reason: 'Delegation active',
      })
    }

    const resolutionTimeMs = Date.now() - startTime

    // Log if resolution took too long (> 60s)
    if (resolutionTimeMs > 60000) {
      console.warn(
        `Delegation resolution took ${resolutionTimeMs}ms (exceeds 60s SLA) for ${itemType}:${itemId}`
      )
    }

    return {
      itemType,
      itemId,
      originalPositionId: positionId,
      originalUserId: userId,
      effectivePositionId: positionId,
      effectiveUserId: effectiveAssignment.userId,
      effectiveAssignmentId: effectiveAssignment.assignmentId,
      delegationChain,
      resolvedAt: new Date().toISOString(),
      resolutionTimeMs: effectiveAssignment.resolutionTimeMs,
      usedCache: resolutionTimeMs < 1000, // If very fast, likely from cache
    }
  } catch (error) {
    console.error('Error resolving work item assignment:', error)

    // Fallback to original assignment on error
    return {
      itemType,
      itemId,
      originalPositionId: positionId,
      originalUserId: userId,
      effectivePositionId: positionId || '',
      effectiveUserId: userId || '',
      effectiveAssignmentId: '',
      delegationChain: [],
      resolvedAt: new Date().toISOString(),
      resolutionTimeMs: Date.now() - startTime,
      usedCache: false,
    }
  }
}

/**
 * Batch resolve multiple work items for better performance
 * 
 * @param items Array of items to resolve
 * @returns Array of resolved contexts
 */
export async function batchResolveWorkItems(
  companyId: string,
  items: Array<{
    itemType: 'task' | 'project' | 'approval' | 'quality_check' | 'safety_inspection'
    itemId: string
    positionId: string | null
    userId: string | null
  }>,
  groupId?: string
): Promise<WorkItemAssignmentContext[]> {
  const startTime = Date.now()

  // Resolve all items in parallel for performance
  const results = await Promise.all(
    items.map((item) =>
      resolveWorkItemAssignment(companyId, item.itemType, item.itemId, item.positionId, item.userId, groupId)
    )
  )

  const totalTime = Date.now() - startTime
  console.log(`Batch resolved ${items.length} items in ${totalTime}ms (avg: ${totalTime / items.length}ms per item)`)

  return results
}

/**
 * Get delegation status for a user
 * Returns information about active delegations affecting this user
 */
export async function getUserDelegationStatus(userId: string): Promise<{
  hasDelegationsOut: boolean
  hasDelegationsIn: boolean
  delegationsOut: number
  delegationsIn: number
}> {
  // This would query the delegations collection
  // For now, return a placeholder
  return {
    hasDelegationsOut: false,
    hasDelegationsIn: false,
    delegationsOut: 0,
    delegationsIn: 0,
  }
}

/**
 * Check if a user can perform an action based on their position and delegations
 */
export async function canUserPerformAction(
  userId: string,
  action: string,
  context: {
    positionId?: string
    departmentId?: string
    budgetAmount?: number
  }
): Promise<{
  allowed: boolean
  reason: string
  effectivePositionId: string | null
}> {
  // This would check position approval authority and active delegations
  // For now, return a placeholder
  return {
    allowed: true,
    reason: 'User has required authority',
    effectivePositionId: context.positionId || null,
  }
}

/**
 * Real-time delegation change notification handler
 * Call this when a delegation is created, modified, or revoked
 */
export async function handleDelegationChange(
  delegationId: string,
  changeType: 'created' | 'activated' | 'revoked' | 'expired'
): Promise<void> {
  console.log(`Delegation ${delegationId} ${changeType}`)

  // In a real implementation, this would:
  // 1. Invalidate relevant caches
  // 2. Notify affected users
  // 3. Trigger work item reassignment if needed
  // 4. Update real-time dashboards
}

/**
 * Performance monitoring for delegation resolution
 */
export class DelegationResolutionMonitor {
  private static resolutions: Array<{ timestamp: number; durationMs: number; cached: boolean }> = []

  static record(durationMs: number, cached: boolean) {
    this.resolutions.push({
      timestamp: Date.now(),
      durationMs,
      cached,
    })

    // Keep only last 1000 resolutions
    if (this.resolutions.length > 1000) {
      this.resolutions.shift()
    }
  }

  static getStats() {
    if (this.resolutions.length === 0) {
      return {
        count: 0,
        avgMs: 0,
        maxMs: 0,
        cacheHitRate: 0,
        exceedsSLA: 0,
      }
    }

    const durations = this.resolutions.map((r) => r.durationMs)
    const cached = this.resolutions.filter((r) => r.cached).length
    const exceedsSLA = this.resolutions.filter((r) => r.durationMs > 60000).length

    return {
      count: this.resolutions.length,
      avgMs: durations.reduce((a, b) => a + b, 0) / durations.length,
      maxMs: Math.max(...durations),
      cacheHitRate: (cached / this.resolutions.length) * 100,
      exceedsSLA,
    }
  }

  static reset() {
    this.resolutions = []
  }
}

