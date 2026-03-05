// Publish Service — publish/unpublish workflows, checklist, and revalidation

import {
  doc,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore'
import { getFirestoreInstance } from '../../firebase'
import { companySubcollectionPathSegments } from '../../firestore-paths'
import { WebsiteService } from './website-service'
import { PageService } from './page-service'
import type {
  Website,
  PublishRecord,
  RevalidationPayload,
} from '@/types/website-schema'

export interface ChecklistItem {
  key: string
  label: string
  passed: boolean
  severity: 'error' | 'warning'
}

export interface PublishResult {
  success: boolean
  publishedUrl?: string
  error?: string
}

export class PublishService {
  /** Pre-publish validation checklist */
  static async runChecklist(
    groupId: string,
    companyId: string,
    websiteId: string
  ): Promise<ChecklistItem[]> {
    const website = await WebsiteService.getWebsite(groupId, companyId, websiteId)
    if (!website) throw new Error('Website not found')

    const pages = await PageService.getPagesByWebsite(groupId, companyId, websiteId)
    const homePage = pages.find((p) => p.isHomePage)

    return [
      {
        key: 'has_logo',
        label: 'Company logo uploaded',
        passed: !!website.branding.logo,
        severity: 'warning',
      },
      {
        key: 'has_home_content',
        label: 'Home page has content',
        passed: !!homePage && !!homePage.content.html && homePage.content.html.trim().length > 0,
        severity: 'error',
      },
      {
        key: 'has_seo_title',
        label: 'SEO title configured',
        passed: !!website.seo.title && website.seo.title.trim().length > 0,
        severity: 'warning',
      },
      {
        key: 'has_subdomain',
        label: 'Subdomain configured',
        passed: !!website.domain.subdomain,
        severity: 'error',
      },
      {
        key: 'has_pages',
        label: 'At least one published page',
        passed: pages.some((p) => p.isPublished),
        severity: 'error',
      },
    ]
  }

  /** Execute the publish workflow */
  static async publish(
    groupId: string,
    companyId: string,
    websiteId: string,
    publishedBy: string
  ): Promise<PublishResult> {
    const db = getFirestoreInstance()
    const segments = companySubcollectionPathSegments(groupId, companyId, 'websites') as [string, ...string[]]
    const docRef = doc(db, ...segments, websiteId)
    const now = new Date().toISOString()

    // Set status to 'publishing'
    await updateDoc(docRef, {
      publishStatus: 'publishing',
      updatedAt: now,
    })

    try {
      // Get website for subdomain
      const website = await WebsiteService.getWebsite(groupId, companyId, websiteId)
      if (!website) throw new Error('Website not found')

      // Get all published pages for revalidation paths
      const pages = await PageService.getPagesByWebsite(groupId, companyId, websiteId)
      const publishedPages = pages.filter((p) => p.isPublished)
      const paths = publishedPages.map((p) => (p.isHomePage ? '/' : `/${p.slug}`))

      // Trigger ISR revalidation
      await this.triggerRevalidation({
        paths,
        subdomain: website.domain.subdomain,
        secret: process.env.NEXT_PUBLIC_REVALIDATION_SECRET || '',
      })

      const publishedUrl = `https://${website.domain.subdomain}.${process.env.NEXT_PUBLIC_WAAS_DOMAIN || 'julley.app'}`

      // Success — update status
      const record: PublishRecord = {
        publishedAt: now,
        publishedBy,
        status: 'success',
      }
      await updateDoc(docRef, {
        publishStatus: 'published',
        publishedAt: now,
        publishedUrl,
        publishHistory: arrayUnion(record),
        updatedAt: now,
      })

      return { success: true, publishedUrl }
    } catch (error) {
      // Failed — update status
      const record: PublishRecord = {
        publishedAt: now,
        publishedBy,
        status: 'failed',
      }
      await updateDoc(docRef, {
        publishStatus: 'failed',
        publishHistory: arrayUnion(record),
        updatedAt: now,
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Publish failed',
      }
    }
  }

  static async unpublish(
    groupId: string,
    companyId: string,
    websiteId: string
  ): Promise<void> {
    const db = getFirestoreInstance()
    const segments = companySubcollectionPathSegments(groupId, companyId, 'websites') as [string, ...string[]]
    const docRef = doc(db, ...segments, websiteId)
    await updateDoc(docRef, {
      publishStatus: 'draft',
      updatedAt: new Date().toISOString(),
    })
  }

  static async getPublishHistory(
    groupId: string,
    companyId: string,
    websiteId: string
  ): Promise<PublishRecord[]> {
    const website = await WebsiteService.getWebsite(groupId, companyId, websiteId)
    return website?.publishHistory || []
  }

  /** Send revalidation request to waas-sites */
  static async triggerRevalidation(payload: RevalidationPayload): Promise<boolean> {
    const waasUrl = process.env.NEXT_PUBLIC_WAAS_SITES_URL
    if (!waasUrl) {
      console.warn('WAAS_SITES_URL not configured, skipping revalidation')
      return false
    }

    try {
      const response = await fetch(`${waasUrl}/api/revalidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      return response.ok
    } catch (error) {
      console.error('Revalidation failed:', error)
      return false
    }
  }
}
