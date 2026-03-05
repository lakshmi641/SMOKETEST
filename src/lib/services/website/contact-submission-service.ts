// Contact Submission Service — CRUD for WaaS contact form submissions

import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  QueryDocumentSnapshot,
} from 'firebase/firestore'
import { getFirestoreInstance } from '../../firebase'
import { companySubcollectionPathSegments } from '../../firestore-paths'

export interface ContactSubmission {
  id: string
  name: string
  email: string
  phone: string | null
  message: string
  read: boolean
  createdAt: string
  ip?: string
}

export interface ContactSubmissionPage {
  items: ContactSubmission[]
  lastDoc: QueryDocumentSnapshot | null
  hasMore: boolean
}

export class ContactSubmissionService {
  private static getCollection(groupId: string, companyId: string, websiteId: string) {
    const db = getFirestoreInstance()
    const segments = companySubcollectionPathSegments(groupId, companyId, 'websites') as [string, ...string[]]
    return collection(db, ...segments, websiteId, 'contactSubmissions')
  }

  private static getDocRef(groupId: string, companyId: string, websiteId: string, submissionId: string) {
    const db = getFirestoreInstance()
    const segments = companySubcollectionPathSegments(groupId, companyId, 'websites') as [string, ...string[]]
    return doc(db, ...segments, websiteId, 'contactSubmissions', submissionId)
  }

  static async getSubmissions(
    groupId: string,
    companyId: string,
    websiteId: string,
    pageSize: number
  ): Promise<ContactSubmissionPage> {
    const colRef = this.getCollection(groupId, companyId, websiteId)
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(pageSize))
    const snap = await getDocs(q)
    const items = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as ContactSubmission[]
    return {
      items,
      lastDoc: snap.docs[snap.docs.length - 1] || null,
      hasMore: snap.docs.length === pageSize,
    }
  }

  static async getMoreSubmissions(
    groupId: string,
    companyId: string,
    websiteId: string,
    afterDoc: QueryDocumentSnapshot,
    pageSize: number
  ): Promise<ContactSubmissionPage> {
    const colRef = this.getCollection(groupId, companyId, websiteId)
    const q = query(colRef, orderBy('createdAt', 'desc'), startAfter(afterDoc), limit(pageSize))
    const snap = await getDocs(q)
    const items = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as ContactSubmission[]
    return {
      items,
      lastDoc: snap.docs[snap.docs.length - 1] || null,
      hasMore: snap.docs.length === pageSize,
    }
  }

  static async markRead(
    groupId: string,
    companyId: string,
    websiteId: string,
    submissionId: string,
    read: boolean
  ): Promise<void> {
    const docRef = this.getDocRef(groupId, companyId, websiteId, submissionId)
    await updateDoc(docRef, { read })
  }

  static async deleteSubmission(
    groupId: string,
    companyId: string,
    websiteId: string,
    submissionId: string
  ): Promise<void> {
    const docRef = this.getDocRef(groupId, companyId, websiteId, submissionId)
    await deleteDoc(docRef)
  }
}
