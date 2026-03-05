// Policy Service
// CRUD operations and condition evaluation for AccessPolicy

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { companyCollectionPathSegments } from '../../firestore-paths'
import type { AccessPolicy, PolicyCondition } from '@/types/access-control-schema'
import type { Position, PositionAssignment } from '@/types/org-schema'

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

function getPoliciesCollection(companyId: string, groupId?: string) {
  const segments = companyCollectionPathSegments(groupId || companyId, companyId, 'accessPolicies')
  return collection(db, segments[0], ...segments.slice(1))
}

function getPolicyDoc(companyId: string, policyId: string, groupId?: string) {
  const segments = companyCollectionPathSegments(groupId || companyId, companyId, 'accessPolicies')
  return doc(db, segments[0], ...segments.slice(1), policyId)
}

export class PolicyService {
  /**
   * Get all access policies for a company
   */
  static async getPolicies(
    companyId: string,
    filters?: {
      isActive?: boolean
    },
    groupId?: string
  ): Promise<AccessPolicy[]> {
    try {
      const policiesRef = getPoliciesCollection(companyId, groupId)
      let q = query(policiesRef, orderBy('priority', 'desc'), orderBy('name', 'asc'))
      
      if (filters?.isActive !== undefined) {
        q = query(q, where('isActive', '==', filters.isActive))
      }
      
      const snapshot = await getDocs(q)
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...convertTimestamps(doc.data())
      } as AccessPolicy))
    } catch (error: any) {
      if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
        return []
      }
      console.error('Error getting policies:', error)
      throw error
    }
  }
  
  /**
   * Get a policy by ID
   */
  static async getPolicy(companyId: string, policyId: string, groupId?: string): Promise<AccessPolicy | null> {
    try {
      const policyRef = getPolicyDoc(companyId, policyId, groupId)
      const policySnap = await getDoc(policyRef)
      
      if (!policySnap.exists()) {
        return null
      }
      
      return {
        id: policySnap.id,
        ...convertTimestamps(policySnap.data())
      } as AccessPolicy
    } catch (error) {
      console.error('Error getting policy:', error)
      throw error
    }
  }
  
  /**
   * Create a new access policy
   */
  static async createPolicy(
    companyId: string,
    data: Omit<AccessPolicy, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>,
    userId: string,
    groupId?: string
  ): Promise<AccessPolicy> {
    try {
      const policyRef = doc(getPoliciesCollection(companyId, groupId))
      const now = new Date().toISOString()
      
      const policy: AccessPolicy = {
        ...data,
        id: policyRef.id,
        companyId,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      }
      
      await setDoc(policyRef, policy)
      return policy
    } catch (error) {
      console.error('Error creating policy:', error)
      throw error
    }
  }
  
  /**
   * Update a policy
   */
  static async updatePolicy(
    companyId: string,
    policyId: string,
    updates: Partial<Omit<AccessPolicy, 'id' | 'companyId' | 'createdAt' | 'createdBy'>>,
    userId: string,
    groupId?: string
  ): Promise<void> {
    try {
      const policyRef = getPolicyDoc(companyId, policyId, groupId)
      const policySnap = await getDoc(policyRef)
      
      if (!policySnap.exists()) {
        throw new Error('Policy not found')
      }
      
      await updateDoc(policyRef, {
        ...updates,
        updatedAt: new Date().toISOString(),
        updatedBy: userId,
      })
    } catch (error) {
      console.error('Error updating policy:', error)
      throw error
    }
  }
  
  /**
   * Delete a policy
   */
  static async deletePolicy(companyId: string, policyId: string, groupId?: string): Promise<void> {
    try {
      const policyRef = getPolicyDoc(companyId, policyId, groupId)
      await deleteDoc(policyRef)
    } catch (error) {
      console.error('Error deleting policy:', error)
      throw error
    }
  }
  
  /**
   * Evaluate a policy condition against user attributes
   */
  static evaluateCondition(
    condition: PolicyCondition,
    userAttributes: {
      position?: Position | null
      positionAssignment?: PositionAssignment | null
      departmentId?: string
      [key: string]: any
    }
  ): boolean {
    // Helper to get attribute value from path
    const getAttributeValue = (path: string): any => {
      const parts = path.split('.')
      let value: any = userAttributes
      
      for (const part of parts) {
        if (value === null || value === undefined) {
          return null
        }
        value = value[part]
      }
      
      return value
    }
    
    // Evaluate single condition
    const evaluateSingle = (cond: PolicyCondition): boolean => {
      const attributeValue = getAttributeValue(cond.attribute)
      
      if (attributeValue === null || attributeValue === undefined) {
        return false
      }
      
      switch (cond.operator) {
        case 'eq':
          return attributeValue === cond.value
        case 'ne':
          return attributeValue !== cond.value
        case 'lte':
          return Number(attributeValue) <= Number(cond.value)
        case 'gte':
          return Number(attributeValue) >= Number(cond.value)
        case 'contains':
          if (Array.isArray(attributeValue)) {
            return attributeValue.includes(cond.value)
          }
          if (typeof attributeValue === 'string') {
            return attributeValue.includes(String(cond.value))
          }
          return false
        case 'in':
          if (Array.isArray(cond.value)) {
            return cond.value.includes(attributeValue)
          }
          return false
        case 'not_in':
          if (Array.isArray(cond.value)) {
            return !cond.value.includes(attributeValue)
          }
          return false
        default:
          return false
      }
    }
    
    // Evaluate main condition
    let result = evaluateSingle(condition)
    
    // Evaluate AND conditions
    if (condition.and && condition.and.length > 0) {
      result = result && condition.and.every(andCond => evaluateSingle(andCond))
    }
    
    // Evaluate OR conditions
    if (condition.or && condition.or.length > 0) {
      result = result || condition.or.some(orCond => evaluateSingle(orCond))
    }
    
    return result
  }
  
  /**
   * Get applicable policies for a user
   */
  static async getApplicablePolicies(
    companyId: string,
    userAttributes: {
      position?: Position | null
      positionAssignment?: PositionAssignment | null
      departmentId?: string
      [key: string]: any
    },
    groupId?: string
  ): Promise<AccessPolicy[]> {
    try {
      const policies = await this.getPolicies(companyId, { isActive: true }, groupId)
      
      return policies.filter(policy => 
        this.evaluateCondition(policy.condition, userAttributes)
      )
    } catch (error) {
      console.error('Error getting applicable policies:', error)
      throw error
    }
  }
}

