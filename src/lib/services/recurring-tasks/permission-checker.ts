/**
 * Permission Checker - Role-based Access Control
 * Master Plan v6.2 - Stage 3
 * 
 * Enforces workspace-centric permissions for recurring tasks
 * Works alongside Firestore Security Rules
 */

import { db } from '@/lib/firebase'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { companyCollectionPathSegments } from '@/lib/firestore-paths'

export interface PermissionContext {
    userId: string
    companyId: string
    workspaceId?: string
    projectId?: string
}

export interface UserRole {
    userId: string
    companyId: string
    role: 'owner' | 'admin' | 'manager' | 'employee'
}

/**
 * Check if user can manage recurring tasks in a workspace
 * 
 * Allowed:
 * - Company owner/admin (any workspace)
 * - Workspace creator
 * - Promoted workspace admins (v6.2)
 */
export async function canManageRecurringTasks(
    userId: string,
    companyId: string,
    workspaceId: string,
    groupId?: string
): Promise<boolean> {
    if (!userId || !companyId || !workspaceId) return false
    try {
        // Check 1: Company-level admin
        const isCompanyAdmin = await isCompanyAdminOrOwner(userId, companyId, groupId)
        if (isCompanyAdmin) {
            return true
        }

        // Check 2: Workspace creator or promoted admin
        const workspacePath = groupId
            ? companyCollectionPathSegments(groupId, companyId, 'workspaces')
            : ['companies', companyId, 'workspaces']
        const workspaceRef = doc(db, ...workspacePath as [string, string, string, string, string], workspaceId)
        const workspaceSnap = await getDoc(workspaceRef)

        if (!workspaceSnap.exists()) {
            return false
        }

        const workspace = workspaceSnap.data()

        // Creator can manage
        if (workspace.createdBy === userId) {
            return true
        }

        // Workspace owner can manage
        // Backward compatibility: check both old and new field names
        const oldAdminIds = (workspace as any).adminIds;
        const ownerId = workspace.ownerId || (Array.isArray(oldAdminIds) && oldAdminIds.length > 0 ? oldAdminIds[0] : null);
        if (ownerId === userId) {
            return true
        }

        return false
    } catch (error) {
        console.error('Permission check failed:', error)
        return false
    }
}

export async function canViewRecurringTasks(
    userId: string,
    companyId: string,
    workspaceId: string,
    groupId?: string
): Promise<boolean> {
    // In v6.2, view permissions are aligned with management permissions
    // Only admins or the workspace creator should see the recurring task templates
    return canManageRecurringTasks(userId, companyId, workspaceId, groupId)
}

/**
 * Check if user is company owner or admin
 */
export async function isCompanyAdminOrOwner(
    userId: string,
    companyId: string,
    groupId?: string
): Promise<boolean> {
    if (!userId) return false
    try {
        const userPath = groupId
            ? ['enterpriseGroups', groupId, 'users', userId]
            : ['companies', companyId, 'users', userId]
        const userRef = doc(db, ...userPath as [string, string, string, string])
        const userSnap = await getDoc(userRef)

        if (!userSnap.exists()) {
            return false
        }

        const userData = userSnap.data()
        // Enterprise structure stores role in roles[companyId]
        const role = groupId ? (userData.roles?.[companyId] || userData.role) : userData.role
        return role === 'owner' || role === 'admin' || role === 'group_admin'
    } catch (error) {
        console.error('Company admin check failed:', error)
        return false
    }
}

/**
 * Check if user can promote others to workspace admin
 * 
 * Allowed (v6.2):
 * - Company owner/admin
 * - Workspace creator
 * - Promoted workspace admins (NEW!)
 */
export async function canPromoteWorkspaceAdmin(
    userId: string,
    companyId: string,
    workspaceId: string,
    groupId?: string
): Promise<boolean> {
    // Same as canManageRecurringTasks in v6.2
    return canManageRecurringTasks(userId, companyId, workspaceId, groupId)
}

/**
 * Get all workspaces where user can manage recurring tasks
 */
export async function getManageableWorkspaces(
    userId: string,
    companyId: string,
    groupId?: string
): Promise<string[]> {
    try {
        const workspaceIds: string[] = []

        // If company admin, return all workspaces
        const isCompanyAdmin = await isCompanyAdminOrOwner(userId, companyId, groupId)
        if (isCompanyAdmin) {
            const workspacesPath = groupId
                ? companyCollectionPathSegments(groupId, companyId, 'workspaces')
                : ['companies', companyId, 'workspaces']
            const workspacesRef = collection(db, ...workspacesPath as [string, string, string, string, string])
            const workspacesSnap = await getDocs(workspacesRef)
            return workspacesSnap.docs.map((doc) => doc.id)
        }

        // Otherwise, get workspaces where user is creator or admin
        const workspacesPath = groupId
            ? companyCollectionPathSegments(groupId, companyId, 'workspaces')
            : ['companies', companyId, 'workspaces']
        const workspacesRef = collection(db, ...workspacesPath as [string, string, string, string, string])

        // Created workspaces
        const createdQuery = query(workspacesRef, where('createdBy', '==', userId))
        const createdSnap = await getDocs(createdQuery)
        createdSnap.docs.forEach((doc) => workspaceIds.push(doc.id))

        // Owner workspaces
        const ownerQuery = query(workspacesRef, where('ownerId', '==', userId))
        const ownerSnap = await getDocs(ownerQuery)
        ownerSnap.docs.forEach((doc) => {
            if (!workspaceIds.includes(doc.id)) {
                workspaceIds.push(doc.id)
            }
        })

        // Backward compatibility: also check old adminIds field
        // Note: This requires a separate query since we can't use OR in Firestore queries easily
        // For now, we'll fetch all workspaces and filter client-side for backward compatibility
        // In production, you may want to migrate data and remove this
        const allWorkspacesQuery = query(workspacesRef)
        const allWorkspacesSnap = await getDocs(allWorkspacesQuery)
        allWorkspacesSnap.docs.forEach((doc) => {
            const data = doc.data()
            const oldAdminIds = Array.isArray(data.adminIds) ? data.adminIds : []
            if (oldAdminIds.includes(userId) && !workspaceIds.includes(doc.id)) {
                workspaceIds.push(doc.id)
            }
        })

        return workspaceIds
    } catch (error) {
        console.error('Failed to get manageable workspaces:', error)
        return []
    }
}

/**
 * Validate permission context
 */
export function validatePermissionContext(context: PermissionContext): string[] {
    const errors: string[] = []

    if (!context.userId) {
        errors.push('User ID is required')
    }

    if (!context.companyId) {
        errors.push('Company ID is required')
    }

    return errors
}

/**
 * Check if user exists and is active
 */
export async function isUserActive(
    userId: string,
    companyId: string,
    groupId?: string
): Promise<boolean> {
    if (!userId) return false
    try {
        const userPath = groupId
            ? ['enterpriseGroups', groupId, 'users', userId]
            : ['companies', companyId, 'users', userId]
        const userRef = doc(db, ...userPath as [string, string, string, string])
        const userSnap = await getDoc(userRef)

        if (!userSnap.exists()) {
            return false
        }

        const userData = userSnap.data()
        // Assuming there's an isActive or status field
        return userData.status !== 'inactive' && userData.status !== 'deleted'
    } catch (error) {
        console.error('User active check failed:', error)
        return false
    }
}

/**
 * Check if position has active users.
 * Uses enterprise-group-aware path when groupId is provided.
 * positionAssignment documents use 'status: active' (written by org-services.ts).
 */
export async function getPositionUsers(
    companyId: string,
    positionId: string,
    positionName?: string,
    groupId?: string
): Promise<string[]> {
    if (!companyId || !positionId) return []
    try {
        // Build the correct path depending on whether this is an enterprise group tenant.
        // positionAssignment docs live under enterpriseGroups/{groupId}/companies/{companyId}/...
        // for enterprise tenants, or under companies/{companyId}/... for standalone.
        const pathSegments: [string, string, string, string, string] | [string, string, string] = groupId
            ? ['enterpriseGroups', groupId, 'companies', companyId, 'positionAssignments']
            : ['companies', companyId, 'positionAssignments'] as any

        const assignmentsRef = collection(db, ...pathSegments as [string, string, string, string, string])
        const q = query(
            assignmentsRef,
            where('positionId', '==', positionId),
            where('status', '==', 'active')  // docs use 'status', not 'isActive'
        )

        const snapshot = await getDocs(q)
        const userIds = snapshot.docs.map((doc) => doc.data().userId)

        return userIds
    } catch (error) {
        console.error('Failed to get position users:', error)
        return []
    }
}

/**
 * Permission cache for performance
 * Simple in-memory cache with TTL
 */
class PermissionCache {
    private cache: Map<string, { value: boolean; expires: number }> = new Map()
    private ttl: number = 5 * 60 * 1000 // 5 minutes

    set(key: string, value: boolean): void {
        this.cache.set(key, {
            value,
            expires: Date.now() + this.ttl,
        })
    }

    get(key: string): boolean | null {
        const entry = this.cache.get(key)
        if (!entry) {
            return null
        }

        if (Date.now() > entry.expires) {
            this.cache.delete(key)
            return null
        }

        return entry.value
    }

    clear(): void {
        this.cache.clear()
    }
}

export const permissionCache = new PermissionCache()

/**
 * Cached permission check
 */
export async function canManageRecurringTasksCached(
    userId: string,
    companyId: string,
    workspaceId: string,
    groupId?: string
): Promise<boolean> {
    const cacheKey = `${userId}:${companyId}:${workspaceId}:${groupId || 'none'}`
    const cached = permissionCache.get(cacheKey)

    if (cached !== null) {
        return cached
    }

    const result = await canManageRecurringTasks(userId, companyId, workspaceId, groupId)
    permissionCache.set(cacheKey, result)

    return result
}
