'use client'

import { useEffect, useMemo } from 'react'
import { useAuthStore } from '@/store/authStore'
import { authService } from '@/lib/auth'

/**
 * Extract companyId from current subdomain
 * Supports: subdomain.julley.app, subdomain.localhost
 */
function getCompanyIdFromSubdomain(): string | undefined {
  if (typeof window === 'undefined') return undefined
  
  const hostname = window.location.hostname
  const domain = hostname.split(':')[0] || ''
  
  // Extract subdomain
  let subdomain: string | null = null
  if (domain.endsWith('.julley.app')) {
    const parts = domain.split('.julley.app')
    if (parts[0]) {
      subdomain = parts[0]
    }
  } else if (domain.endsWith('.localhost')) {
    const parts = domain.split('.localhost')
    if (parts[0]) {
      subdomain = parts[0]
    }
  }
  
  // For now, return subdomain as companyId (assuming 1:1 mapping)
  // In production, you might want to resolve this via an API call or context
  return subdomain || undefined
}

export function AuthProvider({ children, initialCompanyId }: { children: React.ReactNode; initialCompanyId?: string }) {
  const { setUser, setLoading } = useAuthStore()

  // Get companyId from prop or extract from subdomain
  const companyIdGetter = useMemo(() => {
    return () => {
      // First try the prop (from server-side layout)
      if (initialCompanyId) {
        return initialCompanyId
      }
      // Fallback to extracting from subdomain
      return getCompanyIdFromSubdomain()
    }
  }, [initialCompanyId])

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged((user) => {
      setUser(user)
      setLoading(false)
    }, companyIdGetter)

    return unsubscribe
  }, [setUser, setLoading, companyIdGetter])

  return <>{children}</>
}
