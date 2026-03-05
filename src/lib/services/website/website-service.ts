// Website Service — CRUD operations for WaaS websites

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  Timestamp,
} from 'firebase/firestore'
import { getFirestoreInstance } from '../../firebase'
import { companySubcollectionPathSegments } from '../../firestore-paths'
import type {
  Website,
  CreateWebsiteInput,
  UpdateWebsiteInput,
  WebsiteBranding,
  WebsiteBrandKit,
  WebsiteSeo,
  WebsiteDomainConfig,
  WebsiteSettings,
  WebsiteNavigation,
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

export class WebsiteService {
  private static getCollection(groupId: string, companyId: string) {
    const db = getFirestoreInstance()
    const segments = companySubcollectionPathSegments(groupId, companyId, 'websites') as [string, ...string[]]
    return collection(db, ...segments)
  }

  static async getWebsite(
    groupId: string,
    companyId: string,
    websiteId: string
  ): Promise<Website | null> {
    const db = getFirestoreInstance()
    const segments = companySubcollectionPathSegments(groupId, companyId, 'websites') as [string, ...string[]]
    const docRef = doc(db, ...segments, websiteId)
    const snap = await getDoc(docRef)
    if (!snap.exists()) return null
    return { id: snap.id, ...convertTimestamps(snap.data()) } as unknown as Website
  }

  /** MVP: one website per company */
  static async getWebsiteByCompany(
    groupId: string,
    companyId: string
  ): Promise<Website | null> {
    const col = this.getCollection(groupId, companyId)
    const q = query(col, where('status', '==', 'active'), limit(1))
    const snap = await getDocs(q)
    if (snap.empty || !snap.docs[0]) return null
    const docSnap = snap.docs[0]!
    return { id: docSnap.id, ...convertTimestamps(docSnap.data()) } as unknown as Website
  }

  static async createWebsite(
    groupId: string,
    companyId: string,
    data: CreateWebsiteInput
  ): Promise<string> {
    const col = this.getCollection(groupId, companyId)
    const now = new Date().toISOString()
    const docRef = await addDoc(col, {
      ...data,
      publishStatus: data.publishStatus || 'draft',
      publishHistory: [],
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })
    return docRef.id
  }

  static async updateWebsite(
    groupId: string,
    companyId: string,
    websiteId: string,
    updates: UpdateWebsiteInput
  ): Promise<void> {
    const db = getFirestoreInstance()
    const segments = companySubcollectionPathSegments(groupId, companyId, 'websites') as [string, ...string[]]
    const docRef = doc(db, ...segments, websiteId)
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    })
  }

  static async deleteWebsite(
    groupId: string,
    companyId: string,
    websiteId: string
  ): Promise<void> {
    const db = getFirestoreInstance()
    const segments = companySubcollectionPathSegments(groupId, companyId, 'websites') as [string, ...string[]]
    const docRef = doc(db, ...segments, websiteId)
    await deleteDoc(docRef)
  }

  static async updateBranding(
    groupId: string,
    companyId: string,
    websiteId: string,
    branding: Partial<WebsiteBranding>
  ): Promise<void> {
    const website = await this.getWebsite(groupId, companyId, websiteId)
    if (!website) throw new Error('Website not found')
    await this.updateWebsite(groupId, companyId, websiteId, {
      branding: { ...website.branding, ...branding },
    })
  }

  /** Update the website's brand kit (Phase 3 extended branding) */
  static async updateBrandKit(
    groupId: string,
    companyId: string,
    websiteId: string,
    brandKit: WebsiteBrandKit
  ): Promise<void> {
    const db = getFirestoreInstance()
    const segments = companySubcollectionPathSegments(groupId, companyId, 'websites') as [string, ...string[]]
    const docRef = doc(db, ...segments, websiteId)
    await updateDoc(docRef, {
      brandKit,
      // Sync legacy branding fields for backward compat
      'branding.primaryColor': brandKit.colors.primary,
      'branding.secondaryColor': brandKit.colors.secondary,
      'branding.accentColor': brandKit.colors.accent,
      'branding.headingFont': brandKit.typography.headingFont,
      'branding.bodyFont': brandKit.typography.bodyFont,
      ...(brandKit.logo !== undefined ? { 'branding.logo': brandKit.logo } : {}),
      ...(brandKit.favicon !== undefined ? { 'branding.favicon': brandKit.favicon } : {}),
      updatedAt: new Date().toISOString(),
    })
  }

  static async updateSeo(
    groupId: string,
    companyId: string,
    websiteId: string,
    seo: Partial<WebsiteSeo>
  ): Promise<void> {
    const website = await this.getWebsite(groupId, companyId, websiteId)
    if (!website) throw new Error('Website not found')
    await this.updateWebsite(groupId, companyId, websiteId, {
      seo: { ...website.seo, ...seo },
    })
  }

  static async updateDomain(
    groupId: string,
    companyId: string,
    websiteId: string,
    domain: Partial<WebsiteDomainConfig>
  ): Promise<void> {
    const website = await this.getWebsite(groupId, companyId, websiteId)
    if (!website) throw new Error('Website not found')
    await this.updateWebsite(groupId, companyId, websiteId, {
      domain: { ...website.domain, ...domain },
    })
  }

  static async updateSettings(
    groupId: string,
    companyId: string,
    websiteId: string,
    settings: Partial<WebsiteSettings>
  ): Promise<void> {
    const website = await this.getWebsite(groupId, companyId, websiteId)
    if (!website) throw new Error('Website not found')
    await this.updateWebsite(groupId, companyId, websiteId, {
      settings: { ...website.settings, ...settings },
    })
  }

  static async updateNavigation(
    groupId: string,
    companyId: string,
    websiteId: string,
    navigation: Partial<WebsiteNavigation>
  ): Promise<void> {
    const website = await this.getWebsite(groupId, companyId, websiteId)
    if (!website) throw new Error('Website not found')
    await this.updateWebsite(groupId, companyId, websiteId, {
      navigation: { ...website.navigation, ...navigation },
    })
  }
}
