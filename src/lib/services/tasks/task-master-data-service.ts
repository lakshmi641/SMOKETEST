// Task Master Data Service
// Manages Task Types, Requirement Types, and Task Statuses in Firebase

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { companySubcollectionPathSegments } from '../../firestore-paths'

export interface TaskType {
  id: string
  companyId: string
  name: string
  description?: string
  color?: string
  icon?: string
  isActive: boolean
  /** When true, type is system-defined and cannot be deleted. */
  isSystem?: boolean
  order: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface RequirementType {
  id: string
  companyId: string
  name: string
  description?: string
  color?: string
  icon?: string
  isActive: boolean
  order: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface TaskStatus {
  id: string
  companyId: string
  name: string
  code: string // e.g., 'assigned', 'in_progress', 'completed'
  description?: string
  color?: string
  icon?: string
  isActive: boolean
  isSystem: boolean // System statuses cannot be deleted
  order: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

function removeUndefined<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj
  }
  Object.keys(obj).forEach((key) => {
    if (obj[key] === undefined) {
      delete obj[key]
    }
  })
  return obj
}

export class TaskMasterDataService {
  
  // ============================================================================
  // TASK TYPES
  // ============================================================================

  static getTaskTypesCollectionRef(companyId: string, groupId?: string) {
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'taskTypes')
    return collection(db, segments[0], ...segments.slice(1))
  }

  static async getTaskTypes(companyId: string, groupId?: string): Promise<TaskType[]> {
    try {
      const q = query(
        this.getTaskTypesCollectionRef(companyId, groupId),
        where('isActive', '==', true)
      )
      const snapshot = await getDocs(q)
      const types = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
      } as TaskType))
      types.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      return types
    } catch (error) {
      console.error('Error getting task types:', error)
      throw error
    }
  }

  static async getAllTaskTypes(companyId: string, groupId?: string): Promise<TaskType[]> {
    try {
      const q = query(
        this.getTaskTypesCollectionRef(companyId, groupId),
        orderBy('order', 'asc')
      )
      const snapshot = await getDocs(q)
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
      } as TaskType))
    } catch (error) {
      console.error('Error getting all task types:', error)
      throw error
    }
  }

  static async createTaskType(
    companyId: string,
    data: Omit<TaskType, 'id' | 'createdAt' | 'updatedAt'>,
    userId: string,
    groupId?: string
  ): Promise<string> {
    try {
      const payload = removeUndefined({
        ...data,
        companyId,
        createdBy: userId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
      const docRef = await addDoc(this.getTaskTypesCollectionRef(companyId, groupId), payload)
      return docRef.id
    } catch (error) {
      console.error('Error creating task type:', error)
      throw error
    }
  }

  static async updateTaskType(
    companyId: string,
    taskTypeId: string,
    updates: Partial<TaskType>,
    userId: string,
    groupId?: string
  ): Promise<void> {
    try {
      const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'taskTypes')
      const docRef = doc(db, ...segments, taskTypeId)
      const payload = removeUndefined({
        ...updates,
        updatedAt: Timestamp.now(),
      })
      await updateDoc(docRef, payload)
    } catch (error) {
      console.error('Error updating task type:', error)
      throw error
    }
  }

  static async deleteTaskType(
    companyId: string,
    taskTypeId: string,
    groupId?: string
  ): Promise<void> {
    try {
      // Soft delete by setting isActive to false
      const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'taskTypes')
      const docRef = doc(db, ...segments, taskTypeId)
      await updateDoc(docRef, {
        isActive: false,
        updatedAt: Timestamp.now(),
      })
    } catch (error) {
      console.error('Error deleting task type:', error)
      throw error
    }
  }

  // ============================================================================
  // REQUIREMENT TYPES
  // ============================================================================

  static getRequirementTypesCollectionRef(companyId: string, groupId?: string) {
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'requirementTypes')
    return collection(db, segments[0], ...segments.slice(1))
  }

  static async getRequirementTypes(companyId: string, groupId?: string): Promise<RequirementType[]> {
    try {
      const q = query(
        this.getRequirementTypesCollectionRef(companyId, groupId),
        where('isActive', '==', true),
        orderBy('order', 'asc')
      )
      const snapshot = await getDocs(q)
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
      } as RequirementType))
    } catch (error) {
      console.error('Error getting requirement types:', error)
      throw error
    }
  }

  static async getAllRequirementTypes(companyId: string, groupId?: string): Promise<RequirementType[]> {
    try {
      const q = query(
        this.getRequirementTypesCollectionRef(companyId, groupId),
        orderBy('order', 'asc')
      )
      const snapshot = await getDocs(q)
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
      } as RequirementType))
    } catch (error) {
      console.error('Error getting all requirement types:', error)
      throw error
    }
  }

  static async createRequirementType(
    companyId: string,
    data: Omit<RequirementType, 'id' | 'createdAt' | 'updatedAt'>,
    userId: string,
    groupId?: string
  ): Promise<string> {
    try {
      const payload = removeUndefined({
        ...data,
        companyId,
        createdBy: userId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
      const docRef = await addDoc(this.getRequirementTypesCollectionRef(companyId, groupId), payload)
      return docRef.id
    } catch (error) {
      console.error('Error creating requirement type:', error)
      throw error
    }
  }

  static async updateRequirementType(
    companyId: string,
    requirementTypeId: string,
    updates: Partial<RequirementType>,
    userId: string,
    groupId?: string
  ): Promise<void> {
    try {
      const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'requirementTypes')
      const docRef = doc(db, ...segments, requirementTypeId)
      const payload = removeUndefined({
        ...updates,
        updatedAt: Timestamp.now(),
      })
      await updateDoc(docRef, payload)
    } catch (error) {
      console.error('Error updating requirement type:', error)
      throw error
    }
  }

  static async deleteRequirementType(
    companyId: string,
    requirementTypeId: string,
    groupId?: string
  ): Promise<void> {
    try {
      // Soft delete by setting isActive to false
      const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'requirementTypes')
      const docRef = doc(db, ...segments, requirementTypeId)
      await updateDoc(docRef, {
        isActive: false,
        updatedAt: Timestamp.now(),
      })
    } catch (error) {
      console.error('Error deleting requirement type:', error)
      throw error
    }
  }

  // ============================================================================
  // TASK STATUSES
  // ============================================================================

  static getTaskStatusesCollectionRef(companyId: string, groupId?: string) {
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'taskStatuses')
    return collection(db, segments[0], ...segments.slice(1))
  }

  static async getTaskStatuses(companyId: string, groupId?: string): Promise<TaskStatus[]> {
    try {
      const q = query(
        this.getTaskStatusesCollectionRef(companyId, groupId),
        where('isActive', '==', true),
        orderBy('order', 'asc')
      )
      const snapshot = await getDocs(q)
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
      } as TaskStatus))
    } catch (error) {
      console.error('Error getting task statuses:', error)
      throw error
    }
  }

  static async getAllTaskStatuses(companyId: string, groupId?: string): Promise<TaskStatus[]> {
    try {
      const q = query(
        this.getTaskStatusesCollectionRef(companyId, groupId),
        orderBy('order', 'asc')
      )
      const snapshot = await getDocs(q)
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
      } as TaskStatus))
    } catch (error) {
      console.error('Error getting all task statuses:', error)
      throw error
    }
  }

  static async createTaskStatus(
    companyId: string,
    data: Omit<TaskStatus, 'id' | 'createdAt' | 'updatedAt'>,
    userId: string
  ): Promise<string> {
    try {
      const payload = removeUndefined({
        ...data,
        companyId,
        createdBy: userId,
        isSystem: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
      const docRef = await addDoc(this.getTaskStatusesCollectionRef(companyId), payload)
      return docRef.id
    } catch (error) {
      console.error('Error creating task status:', error)
      throw error
    }
  }

  static async updateTaskStatus(
    companyId: string,
    taskStatusId: string,
    updates: Partial<TaskStatus>,
    userId: string
  ): Promise<void> {
    try {
      const docRef = doc(this.getTaskStatusesCollectionRef(companyId), taskStatusId)
      // Don't allow updating isSystem field
      const { isSystem, ...safeUpdates } = updates as any
      const payload = removeUndefined({
        ...safeUpdates,
        updatedAt: Timestamp.now(),
      })
      await updateDoc(docRef, payload)
    } catch (error) {
      console.error('Error updating task status:', error)
      throw error
    }
  }

  static async deleteTaskStatus(
    companyId: string,
    taskStatusId: string
  ): Promise<void> {
    try {
      // Check if it's a system status
      const docRef = doc(this.getTaskStatusesCollectionRef(companyId), taskStatusId)
      const docSnap = await getDoc(docRef)
      if (docSnap.exists() && docSnap.data().isSystem) {
        throw new Error('Cannot delete system task status')
      }

      // Soft delete by setting isActive to false
      await updateDoc(docRef, {
        isActive: false,
        updatedAt: Timestamp.now(),
      })
    } catch (error) {
      console.error('Error deleting task status:', error)
      throw error
    }
  }
}

