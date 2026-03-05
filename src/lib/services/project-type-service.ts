// Project Type Service – system types from constants, custom types in Firestore

import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { companySubcollectionPathSegments } from '../firestore-paths'
import { SYSTEM_PROJECT_TYPES } from '../constants/project-types'

export interface CustomProjectType {
  id: string
  companyId: string
  code: string // unique key, e.g. 'internal_rnd'
  name: string
  description?: string
  isActive: boolean
  order: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

/** Row shown in admin: system (from constant) or custom (from Firestore) */
export type ProjectTypeRow =
  | { source: 'system'; code: string; name: string; description: string }
  | { source: 'custom'; id: string; code: string; name: string; description?: string; isActive: boolean; order: number }

function removeUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj }
  Object.keys(out).forEach((key) => {
    if (out[key as keyof T] === undefined) delete out[key as keyof T]
  })
  return out as T
}

export class ProjectTypeService {
  static getProjectTypesCollectionRef(companyId: string, groupId?: string) {
    const segments = companySubcollectionPathSegments(groupId ?? companyId, companyId, 'projectTypes')
    return collection(db, segments[0], ...segments.slice(1))
  }

  /** All rows for admin: system types first, then custom (active + inactive). */
  static async getAllProjectTypeRows(companyId: string, groupId?: string): Promise<ProjectTypeRow[]> {
    const systemRows: ProjectTypeRow[] = SYSTEM_PROJECT_TYPES.map((t) => ({
      source: 'system',
      code: t.code,
      name: t.name,
      description: t.description,
    }))

    try {
      const q = query(
        this.getProjectTypesCollectionRef(companyId, groupId),
        orderBy('order', 'asc')
      )
      const snapshot = await getDocs(q)
      const customRows: ProjectTypeRow[] = snapshot.docs.map((d) => {
        const data = d.data()
        return {
          source: 'custom',
          id: d.id,
          code: data.code ?? '',
          name: data.name ?? '',
          description: data.description,
          isActive: data.isActive !== false,
          order: data.order ?? 0,
        }
      })
      return [...systemRows, ...customRows]
    } catch (e: any) {
      // Graceful fallback: use system types only (e.g. missing permissions or collection not set up)
      const isPermissionError = e?.code === 'permission-denied' || e?.message?.includes('permission')
      if (!isPermissionError) {
        console.warn('Error loading custom project types:', e)
      }
      return systemRows
    }
  }

  /** For dropdowns: system types + active custom types (code + name). */
  static async getProjectTypesForSelect(companyId: string, groupId?: string): Promise<{ value: string; label: string }[]> {
    const system = SYSTEM_PROJECT_TYPES.map((t) => ({ value: t.code, label: t.name }))
    try {
      const q = query(
        this.getProjectTypesCollectionRef(companyId, groupId),
        orderBy('order', 'asc')
      )
      const snapshot = await getDocs(q)
      const custom = snapshot.docs
        .filter((d) => d.data().isActive !== false)
        .map((d) => ({ value: d.data().code, label: d.data().name }))
      return [...system, ...custom]
    } catch {
      return system
    }
  }

  static async createCustomProjectType(
    companyId: string,
    data: { code: string; name: string; description?: string; order?: number },
    userId: string,
    groupId?: string
  ): Promise<string> {
    const payload = removeUndefined({
      companyId,
      code: data.code.trim(),
      name: data.name.trim(),
      description: data.description?.trim() || undefined,
      isActive: true,
      order: data.order ?? 100,
      createdBy: userId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    const ref = await addDoc(this.getProjectTypesCollectionRef(companyId, groupId), payload)
    return ref.id
  }

  static async updateCustomProjectType(
    companyId: string,
    id: string,
    updates: { name?: string; description?: string; isActive?: boolean; order?: number },
    groupId?: string
  ): Promise<void> {
    const seg = companySubcollectionPathSegments(groupId ?? companyId, companyId, 'projectTypes')
    const docRef = doc(db, ...seg, id)
    await updateDoc(docRef, removeUndefined({ ...updates, updatedAt: Timestamp.now() }))
  }

  /** Soft-delete: set isActive to false. */
  static async deleteCustomProjectType(companyId: string, id: string, groupId?: string): Promise<void> {
    await this.updateCustomProjectType(companyId, id, { isActive: false }, groupId)
  }
}
