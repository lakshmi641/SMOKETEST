// Template Service — browse, preview, and instantiate website templates

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  collectionGroup,
  limit,
  Timestamp,
} from 'firebase/firestore'
import { getFirestoreInstance } from '../../firebase'
import { companySubcollectionPathSegments } from '../../firestore-paths'
import type {
  WebsiteTemplate,
  WebsiteTemplateCategory,
  WebsitePage,
  Website,
  WebsiteDomain,
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

export class TemplateService {
  static async getTemplates(filters?: {
    category?: WebsiteTemplateCategory
    isActive?: boolean
    isFeatured?: boolean
  }): Promise<WebsiteTemplate[]> {
    const db = getFirestoreInstance()
    let q = query(
      collection(db, 'websiteTemplates'),
      orderBy('popularity', 'desc')
    )

    if (filters?.category) {
      q = query(q, where('category', '==', filters.category))
    }
    if (filters?.isActive !== undefined) {
      q = query(q, where('isActive', '==', filters.isActive))
    }
    if (filters?.isFeatured !== undefined) {
      q = query(q, where('isFeatured', '==', filters.isFeatured))
    }

    const snap = await getDocs(q)
    return snap.docs.map((d) => ({
      id: d.id,
      ...convertTimestamps(d.data()),
    })) as unknown as WebsiteTemplate[]
  }

  static async getTemplate(templateId: string): Promise<WebsiteTemplate | null> {
    const db = getFirestoreInstance()
    const docRef = doc(db, 'websiteTemplates', templateId)
    const snap = await getDoc(docRef)
    if (!snap.exists()) return null
    return { id: snap.id, ...convertTimestamps(snap.data()) } as unknown as WebsiteTemplate
  }

  static async getTemplatePages(templateId: string): Promise<WebsitePage[]> {
    const db = getFirestoreInstance()
    const col = collection(db, 'websiteTemplates', templateId, 'pages')
    const q = query(col, orderBy('order', 'asc'))
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({
      id: d.id,
      ...convertTimestamps(d.data()),
    })) as unknown as WebsitePage[]
  }

  /**
   * Deep copy: read template + pages, create website doc + page docs,
   * replace placeholders with company info, create websiteDomains record.
   */
  static async instantiateTemplate(
    groupId: string,
    companyId: string,
    templateId: string,
    overrides: {
      name: string
      companyName: string
      logo?: string
      contactEmail?: string
      contactPhone?: string
      whatsappNumber?: string
      createdBy: string
    }
  ): Promise<string> {
    const template = await this.getTemplate(templateId)
    if (!template) throw new Error('Template not found')

    const templatePages = await this.getTemplatePages(templateId)
    const db = getFirestoreInstance()
    const now = new Date().toISOString()

    // Generate unique subdomain
    const subdomain = await this.generateUniqueSubdomain(overrides.companyName)

    // Build navigation from template pages
    const navPages = templatePages.map((page, idx) => ({
      pageId: '', // Will be filled after page creation
      title: page.title,
      slug: page.slug,
      isVisible: true,
      order: idx,
    }))

    // Create website doc
    const websiteSegments = companySubcollectionPathSegments(groupId, companyId, 'websites') as [string, ...string[]]
    const websiteData: Omit<Website, 'id'> = {
      companyId,
      name: overrides.name,
      templateId,
      templateName: template.name,
      branding: {
        ...(overrides.logo != null ? { logo: overrides.logo } : {}),
        primaryColor: template.colorScheme.primary,
        secondaryColor: template.colorScheme.secondary,
        accentColor: template.colorScheme.accent,
        headingFont: template.fonts.heading,
        bodyFont: template.fonts.body,
      },
      domain: {
        subdomain,
        domainStatus: 'none',
        sslStatus: 'none',
      },
      seo: {
        title: overrides.name,
        description: `Welcome to ${overrides.companyName}`,
        language: 'en',
      },
      navigation: { pages: navPages, style: 'horizontal' },
      settings: {
        language: 'en',
        supportedLanguages: ['en'],
        ...(overrides.whatsappNumber != null ? { whatsappNumber: overrides.whatsappNumber } : {}),
        ...(overrides.contactEmail != null ? { contactEmail: overrides.contactEmail } : {}),
        ...(overrides.contactPhone != null ? { contactPhone: overrides.contactPhone } : {}),
        showPoweredByJulley: true,
      },
      publishStatus: 'draft',
      publishHistory: [],
      status: 'active',
      createdBy: overrides.createdBy,
      createdAt: now,
      updatedAt: now,
    }

    const websiteRef = await addDoc(collection(db, ...websiteSegments), websiteData)
    const websiteId = websiteRef.id

    // Create page docs and update navigation pageIds
    const pageIdMap: Record<number, string> = {}
    for (let i = 0; i < templatePages.length; i++) {
      const tPage = templatePages[i]!
      const pageCol = collection(db, ...websiteSegments, websiteId, 'pages')
      const pageData: Omit<WebsitePage, 'id'> = {
        websiteId,
        title: tPage.title,
        slug: tPage.slug,
        content: {
          html: this.replacePlaceholders(tPage.content.html || '', overrides),
          css: tPage.content.css || '',
          components: tPage.content.components || [],
        },
        seo: tPage.seo || {},
        isHomePage: tPage.isHomePage || i === 0,
        isPublished: true,
        order: i,
        createdBy: overrides.createdBy,
        createdAt: now,
        updatedAt: now,
      }
      const pageRef = await addDoc(pageCol, pageData)
      pageIdMap[i] = pageRef.id
    }

    // Update navigation with real page IDs
    const updatedNavPages = navPages.map((nav, idx) => ({
      ...nav,
      pageId: pageIdMap[idx] || '',
    }))
    const websiteDocRef = doc(db, ...websiteSegments, websiteId)
    await updateDoc(websiteDocRef, {
      'navigation.pages': updatedNavPages,
    })

    // Create websiteDomains record for tenant resolution
    const domainSegments = companySubcollectionPathSegments(groupId, companyId, 'websiteDomains') as [string, ...string[]]
    await addDoc(collection(db, ...domainSegments), {
      websiteId,
      subdomain,
      status: 'active',
    } satisfies Omit<WebsiteDomain, 'id'>)

    // Increment template popularity (best-effort — may fail if user lacks write access)
    try {
      const templateRef = doc(db, 'websiteTemplates', templateId)
      const currentTemplate = await getDoc(templateRef)
      if (currentTemplate.exists()) {
        await updateDoc(templateRef, {
          popularity: (currentTemplate.data().popularity || 0) + 1,
        })
      }
    } catch {
      // Non-critical: popularity tracking requires platformAdmin write access
    }

    return websiteId
  }

  static async isSubdomainAvailable(subdomain: string): Promise<boolean> {
    try {
      const db = getFirestoreInstance()
      const q = query(
        collectionGroup(db, 'websiteDomains'),
        where('subdomain', '==', subdomain),
        where('status', '==', 'active'),
        limit(1)
      )
      const snap = await getDocs(q)
      return snap.empty
    } catch {
      // Collection group query may fail without proper index; assume available
      console.warn('[TemplateService] Subdomain availability check failed, assuming available')
      return true
    }
  }

  static async generateUniqueSubdomain(businessName: string): Promise<string> {
    const base = businessName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 40)
      .replace(/^-|-$/g, '')

    let candidate = base || 'my-website'
    let suffix = 0

    while (!(await this.isSubdomainAvailable(candidate))) {
      suffix++
      candidate = `${base}-${suffix}`
    }

    return candidate
  }

  private static replacePlaceholders(
    html: string,
    overrides: { companyName: string; contactEmail?: string; contactPhone?: string }
  ): string {
    return html
      .replace(/\{\{company_name\}\}/g, overrides.companyName)
      .replace(/\{\{businessName\}\}/g, overrides.companyName)
      .replace(/\{\{contact_email\}\}/g, overrides.contactEmail || '')
      .replace(/\{\{email\}\}/g, overrides.contactEmail || '')
      .replace(/\{\{contact_phone\}\}/g, overrides.contactPhone || '')
      .replace(/\{\{phone\}\}/g, overrides.contactPhone || '')
      .replace(/\{\{tagline\}\}/g, `Your trusted partner for quality products and services`)
  }
}
