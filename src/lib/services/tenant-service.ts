import { collection, doc, getDoc, getDocs, limit, query, where, Timestamp } from 'firebase/firestore'
import { getFirestoreInstance } from '@/lib/firebase'
import { TenantProfile } from '@/types/tenant-schema'

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

export class TenantService {
  static async getTenantProfile(companyId: string): Promise<TenantProfile | null> {
    try {
      if (!companyId) return null
      const firestore = getFirestoreInstance()
      if (!firestore) {
        console.error('Firestore instance is not available')
        return null
      }
      const tenantDoc = await getDoc(doc(firestore, 'tenants', companyId))
      if (!tenantDoc.exists()) return null
      return {
        id: tenantDoc.id,
        ...convertTimestamps(tenantDoc.data())
      } as TenantProfile
    } catch (error) {
      console.error('Error getting tenant profile:', error)
      return null
    }
  }

  static async getTenantByDomain(domain: string): Promise<TenantProfile | null> {
    try {
      if (!domain) return null
      const firestore = getFirestoreInstance()
      if (!firestore) {
        console.error('Firestore instance is not available')
        return null
      }
      const q = query(
        collection(firestore, 'tenants'),
        where('domain', '==', domain.toLowerCase()),
        limit(1)
      )
      const snapshot = await getDocs(q)
      if (snapshot.empty) return null
      const tenantDoc = snapshot.docs[0]
      if (!tenantDoc) return null
      return {
        id: tenantDoc.id,
        ...convertTimestamps(tenantDoc.data())
      } as TenantProfile
    } catch (error) {
      console.error('Error getting tenant by domain:', error)
      return null
    }
  }

  static async getTenantBySubdomain(subdomain: string): Promise<TenantProfile | null> {
    try {
      if (!subdomain) return null
      const firestore = getFirestoreInstance()
      if (!firestore) {
        console.error('Firestore instance is not available')
        return null
      }
      const q = query(
        collection(firestore, 'tenants'),
        where('subdomain', '==', subdomain.toLowerCase()),
        limit(1)
      )
      const snapshot = await getDocs(q)
      if (snapshot.empty) return null
      const tenantDoc = snapshot.docs[0]
      if (!tenantDoc) return null
      return {
        id: tenantDoc.id,
        ...convertTimestamps(tenantDoc.data())
      } as TenantProfile
    } catch (error) {
      console.error('Error getting tenant by subdomain:', error)
      return null
    }
  }
  /**
   * Updates tenant theme via API so permission is enforced server-side.
   * Client Firestore rules allow only platform admins to write to tenants;
   * the API verifies the user is in the tenant's enterprise group (or platform admin).
   */
  static async updateTenantTheme(tenantId: string, theme: string): Promise<void> {
    if (!tenantId) throw new Error('Tenant ID is required')
    const { auth } = await import('@/lib/firebase')
    const currentUser = auth?.currentUser
    if (!currentUser) {
      throw new Error('You must be signed in to update the theme')
    }
    const idToken = await currentUser.getIdToken()
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    const res = await fetch(`${base}/api/tenant/theme`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ tenantId, theme }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data?.error ?? `Failed to update theme (${res.status})`)
    }
  }
}


