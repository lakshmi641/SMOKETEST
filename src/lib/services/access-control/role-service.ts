// Role Service
// CRUD operations for Role collection

import {
  collection,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { companyCollectionPathSegments } from '../../firestore-paths'
import type { Role } from '@/types/access-control-schema'

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

export class RoleService {
  /**
   * Get all roles for a company (enterprise path)
   */
  static async getRoles(
    groupId: string,
    companyId: string,
    filters?: {
      scope?: 'system' | 'workspace' | 'project'
      isCustom?: boolean
    },
    forceServerFetch: boolean = false
  ): Promise<Role[]> {
    try {
      const rolesRef = collection(db, ...companyCollectionPathSegments(groupId, companyId, 'roles'))
      let q = query(rolesRef, orderBy('name', 'asc'))
      
      if (filters?.scope) {
        q = query(q, where('scope', '==', filters.scope))
      }
      
      if (filters?.isCustom !== undefined) {
        q = query(q, where('isCustom', '==', filters.isCustom))
      }
      
      // Use getDocsFromServer to bypass cache if forceServerFetch is true
      const snapshot = forceServerFetch 
        ? await getDocsFromServer(q)
        : await getDocs(q)
      
      const roles = snapshot.docs.map(doc => {
        const rawData = doc.data()
        console.log('Raw role data from Firestore:', {
          docId: doc.id,
          rawData: rawData,
          permissionsType: typeof rawData.permissions,
          permissionsIsArray: Array.isArray(rawData.permissions),
          permissionsValue: rawData.permissions
        })
        
        const data = convertTimestamps(rawData)
        
        // Handle permissions - ensure it's always an array
        let permissions: string[] = []
        if (Array.isArray(data.permissions)) {
          permissions = data.permissions
        } else if (data.permissions && typeof data.permissions === 'object') {
          // If it's an object, try to convert to array
          // Could be stored as { "0": "perm1", "1": "perm2" } or similar
          permissions = Object.values(data.permissions).filter(p => typeof p === 'string') as string[]
        } else if (typeof data.permissions === 'string') {
          // If it's a single string, wrap in array
          permissions = [data.permissions]
        }
        
        const role = {
          id: doc.id,
          ...data,
          permissions: permissions
        } as Role
        
        console.log('Processed role:', {
          id: role.id,
          name: role.name,
          permissionsCount: role.permissions.length,
          permissions: role.permissions
        })
        
        return role
      })
      
      console.log('Fetched roles:', {
        count: roles.length,
        fromServer: forceServerFetch,
        roles: roles.map(r => ({
          id: r.id,
          name: r.name,
          permissionsCount: r.permissions.length,
          permissions: r.permissions
        }))
      })
      
      return roles
    } catch (error) {
      console.error('Error getting roles:', error)
      throw error
    }
  }
  
  /**
   * Get a role by ID (enterprise path)
   */
  static async getRole(groupId: string, companyId: string, roleId: string, forceServerFetch: boolean = false): Promise<Role | null> {
    try {
      const roleRef = doc(db, ...companyCollectionPathSegments(groupId, companyId, 'roles'), roleId)
      
      let roleSnap
      if (forceServerFetch) {
        const rolesRef = collection(db, ...companyCollectionPathSegments(groupId, companyId, 'roles'))
        const q = query(rolesRef)
        const snapshot = await getDocsFromServer(q)
        roleSnap = snapshot.docs.find(d => d.id === roleId)
        if (!roleSnap) {
          return null
        }
      } else {
        roleSnap = await getDoc(roleRef)
      }
      
      if (!roleSnap || !roleSnap.exists()) {
        return null
      }
      
      const rawData = roleSnap.data()
      console.log('Raw role data from Firestore (getRole):', {
        docId: roleSnap.id,
        rawData: rawData,
        permissionsType: typeof rawData.permissions,
        permissionsIsArray: Array.isArray(rawData.permissions),
        permissionsValue: rawData.permissions
      })
      
      const data = convertTimestamps(rawData)
      
      // Handle permissions - ensure it's always an array
      let permissions: string[] = []
      if (Array.isArray(data.permissions)) {
        permissions = data.permissions
      } else if (data.permissions && typeof data.permissions === 'object') {
        // If it's an object, try to convert to array
        permissions = Object.values(data.permissions).filter(p => typeof p === 'string') as string[]
      } else if (typeof data.permissions === 'string') {
        // If it's a single string, wrap in array
        permissions = [data.permissions]
      }
      
      const role = {
        id: roleSnap.id,
        ...data,
        permissions: permissions
      } as Role
      
      console.log('Fetched role:', {
        id: role.id,
        name: role.name,
        permissionsCount: role.permissions.length,
        permissions: role.permissions,
        fromServer: forceServerFetch
      })
      
      return role
    } catch (error) {
      console.error('Error getting role:', error)
      throw error
    }
  }
  
  /**
   * Create a new role
   */
  static async createRole(
    companyId: string,
    data: Omit<Role, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>,
    userId: string
  ): Promise<Role> {
    try {
      const roleRef = doc(collection(db, 'companies', companyId, 'roles'))
      const now = new Date().toISOString()
      
      const role: Role = {
        ...data,
        id: roleRef.id,
        companyId,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      }
      
      await setDoc(roleRef, role)
      return role
    } catch (error) {
      console.error('Error creating role:', error)
      throw error
    }
  }
  
  /**
   * Update a role
   */
  static async updateRole(
    companyId: string,
    roleId: string,
    updates: Partial<Omit<Role, 'id' | 'companyId' | 'createdAt' | 'createdBy'>>,
    userId: string
  ): Promise<void> {
    try {
      const roleRef = doc(db, 'companies', companyId, 'roles', roleId)
      const roleSnap = await getDoc(roleRef)
      
      if (!roleSnap.exists()) {
        throw new Error(`Role not found: ${roleId}`)
      }
      
      // Build update data object
      const updateData: any = {
        updatedAt: new Date().toISOString(),
        updatedBy: userId,
      }
      
      // Add each field from updates if provided
      if (updates.name !== undefined) {
        updateData.name = updates.name.trim()
      }
      if (updates.description !== undefined) {
        updateData.description = updates.description.trim()
      }
      if (updates.scope !== undefined) {
        updateData.scope = updates.scope
      }
      if (updates.isCustom !== undefined) {
        updateData.isCustom = updates.isCustom
      }
      
      // Explicitly handle permissions array
      if ('permissions' in updates) {
        updateData.permissions = Array.isArray(updates.permissions) ? updates.permissions : []
        console.log('Updating permissions:', {
          roleId,
          permissionsCount: updateData.permissions.length,
          permissions: updateData.permissions
        })
      }
      
      console.log('Updating role:', {
        roleId,
        companyId,
        updateData,
        userId
      })
      
      // Perform the update
      await updateDoc(roleRef, updateData)
      
      // Verify the update was successful
      const verifySnap = await getDoc(roleRef)
      if (!verifySnap.exists()) {
        throw new Error('Role update verification failed: role does not exist after update')
      }
      
      const updatedData = verifySnap.data()
      console.log('Role update verified:', {
        roleId,
        name: updatedData.name,
        permissionsCount: Array.isArray(updatedData.permissions) ? updatedData.permissions.length : 0
      })
    } catch (error) {
      console.error('Error updating role:', error)
      throw error
    }
  }
  
  /**
   * Get count of role assignments for a role
   */
  static async getRoleAssignmentCount(companyId: string, roleId: string): Promise<number> {
    try {
      const assignmentsRef = collection(db, 'companies', companyId, 'roleAssignments')
      const q = query(
        assignmentsRef,
        where('roleId', '==', roleId),
        where('status', '==', 'active')
      )
      const snapshot = await getDocs(q)
      return snapshot.size
    } catch (error) {
      console.error('Error getting role assignment count:', error)
      return 0
    }
  }

  /**
   * Delete a role
   * Note: Should check for role assignments before deleting
   */
  static async deleteRole(companyId: string, roleId: string): Promise<void> {
    try {
      // Check if role has active assignments
      const assignmentCount = await this.getRoleAssignmentCount(companyId, roleId)
      if (assignmentCount > 0) {
        throw new Error(`Cannot delete role: It is currently assigned to ${assignmentCount} user(s). Please remove all assignments first.`)
      }

      const roleRef = doc(db, 'companies', companyId, 'roles', roleId)
      await deleteDoc(roleRef)
    } catch (error) {
      console.error('Error deleting role:', error)
      throw error
    }
  }
  
  /**
   * Get role by name
   */
  static async getRoleByName(companyId: string, roleName: string): Promise<Role | null> {
    try {
      const rolesRef = collection(db, 'companies', companyId, 'roles')
      const q = query(rolesRef, where('name', '==', roleName), limit(1))
      const snapshot = await getDocs(q)
      
      if (snapshot.empty) {
        return null
      }
      
      const roleDoc = snapshot.docs[0]
      if (!roleDoc) {
        return null
      }
      const data = convertTimestamps(roleDoc.data())
      // Ensure permissions is always an array
      if (!Array.isArray(data.permissions)) {
        data.permissions = []
      }
      return {
        id: roleDoc.id,
        ...data
      } as Role
    } catch (error) {
      console.error('Error getting role by name:', error)
      throw error
    }
  }
}

