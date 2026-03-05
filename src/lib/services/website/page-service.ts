// Page Service — CRUD operations for WaaS website pages

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  writeBatch,
  Timestamp,
} from 'firebase/firestore'
import { getFirestoreInstance } from '../../firebase'
import { companySubcollectionPathSegments } from '../../firestore-paths'
import type {
  WebsitePage,
  CreatePageInput,
  UpdatePageInput,
  PageContent,
} from '@/types/website-schema'

const convertTimestamps = (data: Record<string, unknown>): Record<string, unknown> => {
  const converted = { ...data }
  Object.keys(converted).forEach((key) => {
    const val = converted[key]
    if (val instanceof Timestamp) {
      converted[key] = val.toDate().toISOString()
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      converted[key] = convertTimestamps(val as Record<string, unknown>)
    }
  })
  return converted
}

export class PageService {
  private static getPagesCollection(
    groupId: string,
    companyId: string,
    websiteId: string
  ) {
    const db = getFirestoreInstance()
    const segments = companySubcollectionPathSegments(groupId, companyId, 'websites') as [string, ...string[]]
    return collection(db, ...segments, websiteId, 'pages')
  }

  static async getPage(
    groupId: string,
    companyId: string,
    websiteId: string,
    pageId: string
  ): Promise<WebsitePage | null> {
    const db = getFirestoreInstance()
    const segments = companySubcollectionPathSegments(groupId, companyId, 'websites') as [string, ...string[]]
    const docRef = doc(db, ...segments, websiteId, 'pages', pageId)
    const snap = await getDoc(docRef)
    if (!snap.exists()) return null
    return { id: snap.id, ...convertTimestamps(snap.data()) } as unknown as WebsitePage
  }

  static async getPagesByWebsite(
    groupId: string,
    companyId: string,
    websiteId: string
  ): Promise<WebsitePage[]> {
    const col = this.getPagesCollection(groupId, companyId, websiteId)
    const q = query(col, orderBy('order', 'asc'))
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({
      id: d.id,
      ...convertTimestamps(d.data()),
    })) as unknown as WebsitePage[]
  }

  static async createPage(
    groupId: string,
    companyId: string,
    websiteId: string,
    data: CreatePageInput
  ): Promise<string> {
    const col = this.getPagesCollection(groupId, companyId, websiteId)
    const now = new Date().toISOString()
    const docRef = await addDoc(col, {
      ...data,
      createdAt: now,
      updatedAt: now,
    })
    return docRef.id
  }

  static async updatePage(
    groupId: string,
    companyId: string,
    websiteId: string,
    pageId: string,
    updates: UpdatePageInput
  ): Promise<void> {
    const db = getFirestoreInstance()
    const segments = companySubcollectionPathSegments(groupId, companyId, 'websites') as [string, ...string[]]
    const docRef = doc(db, ...segments, websiteId, 'pages', pageId)
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    })
  }

  static async updatePageContent(
    groupId: string,
    companyId: string,
    websiteId: string,
    pageId: string,
    content: PageContent
  ): Promise<void> {
    await this.updatePage(groupId, companyId, websiteId, pageId, { content })
  }

  static async updateLocalizedContent(
    groupId: string,
    companyId: string,
    websiteId: string,
    pageId: string,
    language: string,
    content: PageContent
  ): Promise<void> {
    const page = await this.getPage(groupId, companyId, websiteId, pageId)
    if (!page) throw new Error('Page not found')
    const localizedContent = { ...page.localizedContent, [language]: content }
    await this.updatePage(groupId, companyId, websiteId, pageId, { localizedContent })
  }

  static async reorderPages(
    groupId: string,
    companyId: string,
    websiteId: string,
    pageOrder: { pageId: string; order: number }[]
  ): Promise<void> {
    const db = getFirestoreInstance()
    const batch = writeBatch(db)
    const segments = companySubcollectionPathSegments(groupId, companyId, 'websites') as [string, ...string[]]
    const now = new Date().toISOString()

    for (const item of pageOrder) {
      const docRef = doc(db, ...segments, websiteId, 'pages', item.pageId)
      batch.update(docRef, { order: item.order, updatedAt: now })
    }

    await batch.commit()
  }

  static async deletePage(
    groupId: string,
    companyId: string,
    websiteId: string,
    pageId: string
  ): Promise<void> {
    const page = await this.getPage(groupId, companyId, websiteId, pageId)
    if (!page) throw new Error('Page not found')
    if (page.isHomePage) throw new Error('Cannot delete the home page')

    const db = getFirestoreInstance()
    const segments = companySubcollectionPathSegments(groupId, companyId, 'websites') as [string, ...string[]]
    const docRef = doc(db, ...segments, websiteId, 'pages', pageId)
    await deleteDoc(docRef)
  }
}
