import { headers } from 'next/headers'
import { getCompanyIdFromSubdomain } from '@/lib/redis'

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY

// Dummy values set by next.config.js when env vars are missing at build time
const isDummyProject =
    !PROJECT_ID ||
    PROJECT_ID === 'build-time-dummy-project' ||
    !API_KEY ||
    API_KEY === 'build-time-dummy-key'

/**
 * Edge-compatible function to find tenant ID by subdomain via Firestore REST API
 */
async function getCompanyIdBySubdomainREST(subdomain: string): Promise<string | null> {
    if (isDummyProject) {
        return null
    }

    try {
        const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery?key=${API_KEY}`
        const body = {
            structuredQuery: {
                from: [{ collectionId: 'tenants' }],
                where: {
                    fieldFilter: {
                        field: { fieldPath: 'subdomain' },
                        op: 'EQUAL',
                        value: { stringValue: subdomain.toLowerCase() }
                    }
                },
                limit: 1
            }
        }

        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' }
        })

        if (!response.ok) {
            console.error('❌ Firestore REST API error:', await response.text())
            return null
        }

        const data = await response.json()
        if (data.length > 0 && data[0].document) {
            const docPath = data[0].document.name
            const companyId = docPath.split('/').pop() || null
            return companyId
        }
        return null
    } catch (err) {
        console.error('❌ Error in getCompanyIdBySubdomainREST:', err)
        return null
    }
}

/**
 * Edge-compatible function to get tenant branding via Firestore REST API
 */
async function getTenantBrandingREST(companyId: string): Promise<any | null> {
    if (isDummyProject) return null
    try {
        const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/tenants/${companyId}?key=${API_KEY}`
        const response = await fetch(url)
        if (!response.ok) return null

        const doc = await response.json()
        const data: any = {}
        if (doc.fields) {
            Object.keys(doc.fields).forEach(key => {
                const val = doc.fields[key]
                if (val.stringValue) data[key] = val.stringValue
                if (val.booleanValue !== undefined) data[key] = val.booleanValue
                if (val.mapValue) {
                    data[key] = {}
                    const fields = val.mapValue.fields
                    if (fields) {
                        Object.keys(fields).forEach(mKey => {
                            if (fields[mKey].stringValue) data[key][mKey] = fields[mKey].stringValue
                            if (fields[mKey].booleanValue !== undefined) data[key][mKey] = fields[mKey].booleanValue
                        })
                    }
                }
            })
        }
        return data
    } catch (err) {
        return null
    }
}

/**
 * Extract subdomain from hostname
 */
function extractSubdomain(hostname: string): string | null {
    const domain = hostname.split(':')[0] || ''
    let subdomain: string | null = null

    if (domain.endsWith('.julley.app')) {
        const parts = domain.split('.julley.app')
        if (parts[0]) subdomain = parts[0]
    } else if (domain.endsWith('.localhost')) {
        const parts = domain.split('.localhost')
        if (parts[0]) subdomain = parts[0]
    } else if (domain.endsWith('.vercel.app')) {
        const parts = domain.split('.vercel.app')
        if (parts[0]) subdomain = parts[0]
    } else if (domain.endsWith('.julley.in')) {
        const parts = domain.split('.julley.in')
        if (parts[0]) subdomain = parts[0]
    } else if (domain.endsWith('.julleyonline.in')) {
        const parts = domain.split('.julleyonline.in')
        if (parts[0]) subdomain = parts[0]
    }

    return subdomain
}

/**
 * Resolve company ID from request headers (hostname/subdomain)
 * This replaces the middleware functionality
 */
export async function resolveCompanyIdFromRequest(): Promise<{
    companyId: string | null
    tenantData: any | null
}> {
    try {
        const headersList = await headers()
        const hostname = headersList.get('host') || ''
        const domain = hostname.split(':')[0] || ''

        const subdomain = extractSubdomain(hostname)

        console.log(`[Proxy] Domain: ${domain}, Subdomain: ${subdomain}`)

        if (!subdomain && !domain) {
            return { companyId: null, tenantData: null }
        }

        let companyId: string | null = null
        const normalizedSubdomain = subdomain?.toLowerCase()

        // 1) Resolve companyId from Redis (Fast Path)
        if (normalizedSubdomain) {
            // Try exact match
            companyId = await getCompanyIdFromSubdomain(normalizedSubdomain)

            // Smart fallback: try prefixes if exact match fails
            if (!companyId) {
                const prefixedCompanyId = await Promise.race([
                    getCompanyIdFromSubdomain(`dev-${normalizedSubdomain}`),
                    getCompanyIdFromSubdomain(`stage-${normalizedSubdomain}`)
                ])
                if (prefixedCompanyId) companyId = prefixedCompanyId
            }

            console.log(`[Proxy] Redis lookup result: ${companyId}`)
        }

        // 2) Fallback to Firestore REST API (Edge-safe path)
        if (!companyId && normalizedSubdomain) {
            companyId = await getCompanyIdBySubdomainREST(normalizedSubdomain)

            // Smart fallback for Firestore
            if (!companyId) {
                companyId = await getCompanyIdBySubdomainREST(`dev-${normalizedSubdomain}`)
            }
            if (!companyId) {
                companyId = await getCompanyIdBySubdomainREST(`stage-${normalizedSubdomain}`)
            }

            console.log(`[Proxy] Firestore REST lookup result: ${companyId}`)
        }

        // 3) Try looking up by FULL DOMAIN (for custom domains or exact matches)
        if (!companyId && domain) {
            // Future optimization: add getCompanyIdByDomainREST here
            console.log(`[Proxy] No company found by subdomain, could try domain lookup for: ${domain}`)
        }

        let tenantData: any | null = null
        if (companyId) {
            tenantData = await getTenantBrandingREST(companyId)
            console.log(`[Proxy] ✅ Resolved Group ID: ${companyId}`)
        } else {
            console.warn(`⚠️ No tenant found for subdomain/domain: ${subdomain || domain}`)
        }

        return { companyId, tenantData }
    } catch (error) {
        console.error('❌ Proxy execution error:', error)
        return { companyId: null, tenantData: null }
    }
}

