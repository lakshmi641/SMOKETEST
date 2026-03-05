// Position Permission Resolver
// Resolves permissions from position hierarchy and role mappings

import { getPosition, getCurrentAssignmentForUser } from '../org/org-services'
import { RoleService } from './role-service'
import type { Position, PositionAssignment } from '@/types/org-schema'
import { ADMIN_ALL } from '@/lib/constants/permissions'

/**
 * Position Permission Resolver
 * Traverses position hierarchy to resolve permissions
 */
export class PositionPermissionResolver {
  /**
   * Get all permissions for a user based on their position
   * Includes hierarchy traversal for manager permissions
   */
  static async getUserPermissionsFromPosition(
    companyId: string,
    userId: string,
    options?: {
      includeHierarchy?: boolean // Traverse reportsTo chain
      maxDepth?: number // Maximum hierarchy depth to traverse
    }
  ): Promise<Set<string>> {
    const permissions = new Set<string>()
    const includeHierarchy = options?.includeHierarchy ?? false
    const maxDepth = options?.maxDepth ?? 5
    
    // Get user's active position assignment
    const assignment = await getCurrentAssignmentForUser(companyId, userId)
    if (!assignment) {
      return permissions
    }
    
    // Get position details
    const position = await getPosition(companyId, assignment.positionId)
    if (!position) {
      return permissions
    }
    
    // Get permissions from current position
    await this.addPositionPermissions(companyId, position.id, permissions)
    
    // Traverse hierarchy if enabled
    if (includeHierarchy) {
      await this.traverseHierarchy(
        companyId,
        position,
        permissions,
        0,
        maxDepth
      )
    }
    
    return permissions
  }
  
  /**
   * Add permissions from a position to the set
   */
  private static async addPositionPermissions(
    companyId: string,
    positionId: string,
    permissions: Set<string>
  ): Promise<void> {
    try {
      // Get position role mappings
      const mappings = await this.getPositionRoleMappings(companyId, positionId)
      
      for (const mapping of mappings) {
        const role = await RoleService.getRole(companyId, companyId, mapping.roleId)
        if (role) {
          role.permissions.forEach(perm => permissions.add(perm))
        }
      }
    } catch (error) {
      console.error('Error adding position permissions:', error)
    }
  }
  
  /**
   * Traverse position hierarchy to get manager permissions
   */
  private static async traverseHierarchy(
    companyId: string,
    position: Position,
    permissions: Set<string>,
    currentDepth: number,
    maxDepth: number
  ): Promise<void> {
    if (currentDepth >= maxDepth || !position.reportsToPositionId) {
      return
    }
    
    try {
      // Get parent position
      const parentPosition = await getPosition(companyId, position.reportsToPositionId)
      if (!parentPosition) {
        return
      }
      
      // Add parent position permissions
      await this.addPositionPermissions(companyId, parentPosition.id, permissions)
      
      // Continue traversing up the chain
      await this.traverseHierarchy(
        companyId,
        parentPosition,
        permissions,
        currentDepth + 1,
        maxDepth
      )
    } catch (error) {
      console.error('Error traversing hierarchy:', error)
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
      const { collection, query, where, getDocs } = await import('firebase/firestore')
      const { db } = await import('../../firebase')
      
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
   * Check if a position has a specific permission
   */
  static async positionHasPermission(
    companyId: string,
    positionId: string,
    permission: string,
    options?: {
      includeHierarchy?: boolean
      maxDepth?: number
    }
  ): Promise<boolean> {
    const position = await getPosition(companyId, positionId)
    if (!position) {
      return false
    }
    
    const permissions = await this.getPermissionsForPosition(
      companyId,
      position,
      options
    )
    
    return permissions.has(permission) || permissions.has(ADMIN_ALL)
  }
  
  /**
   * Get permissions for a position (without user context)
   */
  static async getPermissionsForPosition(
    companyId: string,
    position: Position,
    options?: {
      includeHierarchy?: boolean
      maxDepth?: number
    }
  ): Promise<Set<string>> {
    const permissions = new Set<string>()
    const includeHierarchy = options?.includeHierarchy ?? false
    const maxDepth = options?.maxDepth ?? 5
    
    // Add current position permissions
    await this.addPositionPermissions(companyId, position.id, permissions)
    
    // Traverse hierarchy if enabled
    if (includeHierarchy) {
      await this.traverseHierarchy(
        companyId,
        position,
        permissions,
        0,
        maxDepth
      )
    }
    
    return permissions
  }
  
  /**
   * Get all positions that have a specific permission
   * Useful for finding who can perform an action
   */
  static async getPositionsWithPermission(
    companyId: string,
    permission: string
  ): Promise<Position[]> {
    // This would require querying all positions and checking their role mappings
    // For now, return empty array as this is a complex operation
    // In production, this could be optimized with indexes or cached results
    return []
  }
}

