// Website-as-a-Service (WaaS) Schema
// All interfaces for the website builder feature

// ============================================================================
// Status & Enum Types
// ============================================================================

export type WebsitePublishStatus = 'draft' | 'publishing' | 'published' | 'failed'
export type WebsiteStatus = 'active' | 'disabled'
export type DomainStatus = 'pending' | 'active' | 'failed' | 'none'
export type SslStatus = 'pending' | 'active' | 'none'
export type WebsiteDomainStatus = 'active' | 'pending' | 'disabled'
export type NavigationStyle = 'horizontal' | 'hamburger'
export type StructuredDataType = 'LocalBusiness' | 'Organization' | 'ProfessionalService'
export type WebsiteTemplateCategory =
  | 'service'
  | 'retail'
  | 'healthcare'
  | 'restaurant'
  | 'consulting'
  | 'manufacturing'
  | 'education'
  | 'general'

// ============================================================================
// Sub-Interfaces
// ============================================================================

export interface DnsRecord {
  type: string       // "CNAME", "A", "TXT"
  name: string       // "@" or "www"
  value: string      // "cname.vercel-dns.com"
  verified: boolean
}

export interface WaasNavigationItem {
  pageId: string
  title: string      // "About Us"
  slug: string       // "about"
  isVisible: boolean
  order: number
}

export interface PublishRecord {
  publishedAt: string   // ISO 8601
  publishedBy: string   // User ID
  status: 'success' | 'failed'
}

export interface WebsiteBranding {
  logo?: string          // Firebase Storage URL
  favicon?: string       // Firebase Storage URL
  primaryColor: string   // Hex, e.g. "#2563EB"
  secondaryColor: string // Hex
  accentColor?: string   // Hex
  headingFont: string    // Default: "Poppins"
  bodyFont: string       // Default: "Inter"
}

// ============================================================================
// Brand Kit (Phase 3 — Extended Branding)
// ============================================================================

export type BorderRadiusOption = 'none' | 'sm' | 'md' | 'lg' | 'full'
export type ButtonStyleOption = 'filled' | 'outline' | 'ghost'
export type ShadowIntensityOption = 'none' | 'subtle' | 'medium' | 'dramatic'
export type SpacingOption = 'compact' | 'comfortable' | 'spacious'
export type NavStyleOption = 'solid' | 'transparent' | 'glass'

export interface BrandKitColors {
  primary: string
  secondary: string
  accent: string
  background: string
  surface: string
  text: string
  textMuted: string
  border: string
}

export interface BrandKitTypography {
  headingFont: string
  bodyFont: string
  fontPairId: string
  baseSize: 16 | 18
  scaleRatio: number
}

export interface BrandKitStyle {
  borderRadius: BorderRadiusOption
  buttonStyle: ButtonStyleOption
  shadowIntensity: ShadowIntensityOption
  spacing: SpacingOption
  navStyle: NavStyleOption
}

export interface BrandKitDarkMode {
  enabled: boolean
  colors?: Partial<BrandKitColors>
}

export interface WebsiteBrandKit {
  colors: BrandKitColors
  typography: BrandKitTypography
  style: BrandKitStyle
  darkMode: BrandKitDarkMode
  colorPresetId?: string
  logo?: string
  favicon?: string
}

export interface WebsiteDomainConfig {
  subdomain: string          // e.g. "sharma-electronics"
  customDomain?: string      // e.g. "www.sharmaelectronics.in"
  domainStatus: DomainStatus
  sslStatus: SslStatus
  dnsRecords?: DnsRecord[]
}

export interface StructuredDataAddress {
  streetAddress?: string
  addressLocality: string  // City
  addressRegion: string    // State
  postalCode: string
}

export interface WebsiteStructuredData {
  type: StructuredDataType
  name: string
  address?: StructuredDataAddress
  phone?: string
  email?: string
  openingHours?: string[]  // ["Mo-Sa 09:00-20:00"]
  gstin?: string           // "29AABCS1429B1Z5"
}

export interface WebsiteSeo {
  title: string               // "Sharma Electronics — Trusted Since 1995"
  description: string         // Meta description (150-160 chars)
  ogImage?: string            // Firebase Storage URL
  keywords?: string[]         // ["electronics", "repair", "jaipur"]
  structuredData?: WebsiteStructuredData
  language: string            // Primary: 'en'
  alternateLanguages?: string[] // ['hi']
}

export interface WebsiteNavigation {
  pages: WaasNavigationItem[]
  style: NavigationStyle
}

export interface WebsiteSettings {
  language: string              // Primary language code
  supportedLanguages: string[]  // ['en', 'hi']
  whatsappNumber?: string       // "+919876543210"
  whatsappMessage?: string      // "Hi, I found you on your website!"
  contactEmail?: string
  contactPhone?: string
  socialLinks?: Record<string, string>  // { instagram: "...", facebook: "..." }
  showPoweredByJulley: boolean  // Default: true (free tier)
}

// ============================================================================
// Primary Documents
// ============================================================================

/** Website configuration — one per company (MVP) */
export interface Website {
  id: string
  companyId: string
  name: string                    // "Sharma Electronics Website"
  templateId: string              // Reference to source template
  templateName: string            // Denormalized for display

  branding: WebsiteBranding
  brandKit?: WebsiteBrandKit       // Phase 3 extended branding (takes precedence over branding)
  domain: WebsiteDomainConfig
  seo: WebsiteSeo
  navigation: WebsiteNavigation
  settings: WebsiteSettings

  // Publishing
  publishStatus: WebsitePublishStatus
  publishedAt?: string            // ISO 8601
  publishedUrl?: string           // "https://sharma-electronics.julley.app"
  publishHistory: PublishRecord[]

  // Metadata
  status: WebsiteStatus
  createdBy: string               // User ID
  createdAt: string               // ISO 8601
  updatedAt: string               // ISO 8601
}

/** Page content — subcollection under Website */
export interface PageContent {
  html: string        // GrapesJS rendered HTML (sanitized with DOMPurify)
  css: string         // Page-specific CSS
  components: object  // GrapesJS JSON component tree (for re-editing)
}

export interface PageSeo {
  title?: string         // Override site-wide title
  description?: string   // Override site-wide description
  ogImage?: string       // Page-specific OG image
  noIndex?: boolean      // Exclude from search engines
}

export interface WebsitePage {
  id: string
  websiteId: string
  title: string          // "About Us"
  slug: string           // "about"

  content: PageContent
  localizedContent?: Record<string, PageContent>

  seo: PageSeo

  isHomePage: boolean    // Only one per website
  isPublished: boolean   // Can hide draft pages
  order: number          // Display order in navigation
  createdBy: string      // User ID
  createdAt: string      // ISO 8601
  updatedAt: string      // ISO 8601
}

/** Platform-managed template — root-level collection */
export interface WebsiteTemplate {
  id: string
  name: string           // "Modern Service Business"
  description: string    // "Perfect for consultants, agencies, and..."
  thumbnail: string      // Firebase Storage URL (preview image)

  category: WebsiteTemplateCategory
  industries: string[]   // ["consulting", "accounting", "legal"]
  tags: string[]         // ["modern", "minimal", "professional"]

  colorScheme: {
    primary: string      // "#2563EB"
    secondary: string    // "#1E40AF"
    accent: string       // "#F59E0B"
  }

  fonts: {
    heading: string      // "Poppins"
    body: string         // "Inter"
  }

  defaultPages: string[] // ["home", "about", "services", "contact"]

  isActive: boolean      // Visible in template gallery
  isFeatured: boolean    // Shown first / highlighted
  popularity: number     // Usage count (for sorting)

  createdAt: string
  updatedAt: string
}

/** Domain index for tenant resolution */
export interface WebsiteDomain {
  id: string
  websiteId: string      // Reference to parent website
  subdomain: string      // "sharma-electronics"
  customDomain?: string  // "www.sharmaelectronics.in"
  status: WebsiteDomainStatus
}

// ============================================================================
// Input Types
// ============================================================================

export type CreateWebsiteInput = Omit<
  Website,
  'id' | 'createdAt' | 'updatedAt' | 'publishedAt' | 'publishedUrl' | 'publishHistory'
>

export type UpdateWebsiteInput = Partial<
  Omit<Website, 'id' | 'companyId' | 'createdBy' | 'createdAt'>
>

export type CreatePageInput = Omit<WebsitePage, 'id' | 'createdAt' | 'updatedAt'>

export type UpdatePageInput = Partial<
  Omit<WebsitePage, 'id' | 'websiteId' | 'createdBy' | 'createdAt'>
>

// ============================================================================
// Cross-Boundary Types (used by waas-sites for ISR)
// ============================================================================

/** Cached in Redis for fast tenant resolution */
export interface WaasResolutionCache {
  groupId: string
  companyId: string
  websiteId: string
}

/** Payload sent to waas-sites /api/revalidate */
export interface RevalidationPayload {
  paths: string[]       // Page paths to revalidate, e.g. ["/", "/about"]
  subdomain: string     // For cache invalidation
  secret: string        // REVALIDATION_SECRET
}
