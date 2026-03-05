// Company Context for Multi-Tenant Project Management System

'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react'
import { Company, CompanyUser } from '@/types/company-schema'
import { CompanyService, CompanyUserService, TenantService } from '@/lib/services'
import { PermissionService } from '@/lib/services/permission-service'
import { logger } from '@/lib/logger'
import { useAuthStore } from '@/store/authStore'
import { TenantProfile } from '@/types/tenant-schema'

interface CompanyContextType {
  // Current Company
  currentCompany: Company | null
  setCurrentCompany: (company: Company | null) => void

  tenantProfile: TenantProfile | null
  tenantLoading: boolean

  // Enterprise group ID (tenant/subdomain). All company-scoped data lives under enterpriseGroups/{groupId}/companies/{companyId}/...
  groupId: string | null

  // Current User in Company
  currentCompanyUser: CompanyUser | null
  setCurrentCompanyUser: (user: CompanyUser | null) => void

  // Company ID (for easy access)
  companyId: string | null

  // Loading States
  isLoading: boolean
  setIsLoading: (loading: boolean) => void

  // Company Management
  switchCompany: (companyId: string) => Promise<void>
  refreshCompany: () => Promise<void>

  // User Companies
  userCompanies: Company[]
  setUserCompanies: (companies: Company[]) => void

  // Error Handling
  error: string | null
  setError: (error: string | null) => void
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined)

const SELECTED_COMPANY_STORAGE_KEY_PREFIX = 'pms_selected_company'

function getSelectedCompanyStorageKey(groupId: string | null): string {
  return groupId ? `${SELECTED_COMPANY_STORAGE_KEY_PREFIX}_${groupId}` : SELECTED_COMPANY_STORAGE_KEY_PREFIX
}

function getStoredSelectedCompanyId(groupId: string | null): string | null {
  if (typeof window === 'undefined') return null
  try {
    const key = getSelectedCompanyStorageKey(groupId)
    const stored = localStorage.getItem(key)
    return stored ? stored : null
  } catch {
    return null
  }
}

function setStoredSelectedCompanyId(groupId: string | null, companyId: string): void {
  if (typeof window === 'undefined') return
  try {
    const key = getSelectedCompanyStorageKey(groupId)
    localStorage.setItem(key, companyId)
  } catch (e) {
    logger.warn('Could not persist selected company to localStorage', e)
  }
}

interface CompanyProviderProps {
  children: ReactNode
  initialCompanyId?: string
}

export function CompanyProvider({ children, initialCompanyId }: CompanyProviderProps) {
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null)
  const [currentCompanyUser, setCurrentCompanyUser] = useState<CompanyUser | null>(null)
  const [userCompanies, setUserCompanies] = useState<Company[]>([])
  const [tenantProfile, setTenantProfile] = useState<TenantProfile | null>(null)
  const [tenantLoading, setTenantLoading] = useState(true)
  const [companyLoading, setCompanyLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user: authUser, loading: authLoading } = useAuthStore()

  // companyId: the selected company. When switching, only this changes; groupId stays the same.
  const companyId =
    currentCompany?.id ??
    tenantProfile?.companyId ??
    authUser?.primaryCompanyId ??
    (authUser?.companyIds?.length ? authUser.companyIds[0] : undefined) ??
    initialCompanyId ??
    null
  const loadingCompanyRef = useRef<string | null>(null)
  const isMountedRef = useRef(true)
  const groupIdRef = useRef<string | null>(null)

  // groupId: enterprise/tenant ID. Persist in ref so it never changes when switching companies.
  const resolvedGroupId =
    authUser?.enterpriseGroupId ?? tenantProfile?.enterpriseGroupId ?? initialCompanyId ?? null

  if (authUser && resolvedGroupId) {
    groupIdRef.current = resolvedGroupId
  }
  if (!authUser) {
    groupIdRef.current = null
  }
  const groupId = groupIdRef.current ?? resolvedGroupId ?? null

  console.log('[CompanyContext] Resolution Debug:', {
    initialCompanyId,
    resolvedGroupId,
    authGroupId: authUser?.enterpriseGroupId,
    tenantGroupId: tenantProfile?.enterpriseGroupId,
    finalGroupId: groupId
  });

  // Load company by ID. When groupId is set (multi-org), reads from enterprise group path.
  const loadCompany = useCallback(async (targetCompanyId: string, currentAuthUserId?: string) => {
    if (loadingCompanyRef.current === targetCompanyId) {
      return
    }
    loadingCompanyRef.current = targetCompanyId

    try {
      logger.debug('Loading company:', targetCompanyId, 'groupId:', groupId)
      setCompanyLoading(true)
      setError(null)

      const company = await CompanyService.getCompany(targetCompanyId, groupId ?? undefined)

      if (!isMountedRef.current) {
        return
      }

      if (company) {
        logger.debug('Company loaded successfully:', company)
        setCurrentCompany(company)

        const userIdToMatch = currentAuthUserId || authUser?.id
        if (userIdToMatch) {
          try {
            const companyUser = await CompanyUserService.getCompanyUser(
              targetCompanyId,
              userIdToMatch,
              groupId ?? undefined
            )

            // Check again if component is still mounted
            if (!isMountedRef.current) {
              return
            }

            if (companyUser) {
              logger.debug('Company user found for authenticated user:', companyUser)
              setCurrentCompanyUser(companyUser)
              if (loadingCompanyRef.current === targetCompanyId) {
                logger.debug('[CompanyContext] Company switched:', {
                  companyId: targetCompanyId,
                  groupId: groupId ?? null,
                  company: { id: company.id, name: company.name },
                  currentCompanyUser: { id: companyUser.id, role: companyUser.role, companyId: companyUser.companyId }
                })
                console.log('[CompanyContext] Company switched:', {
                  companyId: targetCompanyId,
                  groupId: groupId ?? null,
                  company: { id: company.id, name: company.name },
                  currentCompanyUser: { id: companyUser.id, role: companyUser.role, companyId: companyUser.companyId }
                })
              }
            } else if (
              groupId &&
              authUser?.enterpriseGroupId &&
              (authUser.companyIds?.includes(targetCompanyId) ?? authUser.companyId === targetCompanyId)
            ) {
              // Multi-org: group user exists but company-level user doc may not (migration only created group users).
              // Build synthetic CompanyUser: resolve role from group user doc (source of truth), not just auth store.
              const groupUser = await CompanyUserService.getEnterpriseGroupUser(groupId, userIdToMatch)
              const roleRaw = authUser.isGroupAdmin
                ? 'group_admin'
                : (groupUser?.roles?.[targetCompanyId] as string) ??
                  authUser.roles?.[targetCompanyId] ??
                  authUser.role ??
                  'employee'
              const validRoles: CompanyUser['role'][] = ['owner', 'admin', 'manager', 'employee', 'viewer', 'group_admin']
              const role: CompanyUser['role'] = validRoles.includes(roleRaw as CompanyUser['role'])
                ? (roleRaw as CompanyUser['role'])
                : 'employee'
              const now = new Date().toISOString()
              const syntheticCompanyUser: CompanyUser = {
                id: authUser.id,
                userId: authUser.id,
                companyId: targetCompanyId,
                role,
                permissions: PermissionService.getDefaultPermissions(role),
                invitedBy: '',
                invitedAt: now,
                status: 'active',
                joinedAt: now,
                lastActiveAt: now,
                createdAt: now,
                updatedAt: now
              }
              logger.debug('Using synthetic CompanyUser from group user for sidebar/permissions:', syntheticCompanyUser.role)
              setCurrentCompanyUser(syntheticCompanyUser)
              if (loadingCompanyRef.current === targetCompanyId) {
                logger.debug('[CompanyContext] Company switched (synthetic user):', {
                  companyId: targetCompanyId,
                  groupId: groupId ?? null,
                  company: { id: company.id, name: company.name },
                  currentCompanyUser: { id: syntheticCompanyUser.id, role: syntheticCompanyUser.role, companyId: syntheticCompanyUser.companyId }
                })
                console.log('[CompanyContext] Company switched (synthetic user):', {
                  companyId: targetCompanyId,
                  groupId: groupId ?? null,
                  company: { id: company.id, name: company.name },
                  currentCompanyUser: { id: syntheticCompanyUser.id, role: syntheticCompanyUser.role, companyId: syntheticCompanyUser.companyId }
                })
              }
            } else {
              logger.warn('No CompanyUser found for authenticated user', {
                userId: userIdToMatch,
                companyId: targetCompanyId,
                message: 'User is authenticated but does not have a CompanyUser record in this company. This may occur during onboarding or if the user was removed from the company.'
              })
              setCurrentCompanyUser(null)
            }
          } catch (err) {
            logger.error('Error loading company user:', err)
            setCurrentCompanyUser(null)
          }
        } else {
          logger.warn('No authenticated user found, cannot load CompanyUser')
          setCurrentCompanyUser(null)
        }
      } else {
        logger.warn('Company not found:', targetCompanyId)
        setError('Company not found')
      }
    } catch (err) {
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        logger.error('Error loading company:', err)
        setError('Failed to load company')
      }
    } finally {
      if (isMountedRef.current) {
        setCompanyLoading(false)
      }
      loadingCompanyRef.current = null
    }
  }, [authUser?.id, groupId])

  // Switch to a different company: persist to localStorage and log context after load
  const switchCompany = useCallback(async (targetCompanyId: string) => {
    setStoredSelectedCompanyId(groupId, targetCompanyId)
    await loadCompany(targetCompanyId)
  }, [loadCompany, groupId])

  // Refresh current company data
  const refreshCompany = useCallback(async () => {
    if (companyId) {
      await loadCompany(companyId)
    }
    if (groupId) {
      const tenant = await TenantService.getTenantProfile(groupId)
      if (tenant) {
        setTenantProfile(tenant)
      }
    }
  }, [companyId, groupId, loadCompany])

  // Load user's companies
  const loadUserCompanies = useCallback(async () => {
    if (!authUser) {
      logger.debug('No authenticated user, skipping company load')
      setCurrentCompany(null)
      setCurrentCompanyUser(null)
      setUserCompanies([])
      setCompanyLoading(false)
      setError(null)
      return
    }

    try {
      logger.debug('Loading user companies...', 'groupId:', groupId)
      // When groupId is set (multi-org), load companies from enterprise group; optionally filter by authUser.companyIds
      const companies = await CompanyService.getCompanies(groupId ?? undefined)
      const filtered = authUser?.companyIds?.length
        ? companies.filter(c => authUser.companyIds!.includes(c.id))
        : companies

      if (isMountedRef.current) {
        logger.debug('Loaded companies:', filtered.length)
        setUserCompanies(filtered)

        if (filtered.length === 0) {
          setCompanyLoading(false)
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        logger.error('Error loading user companies:', err)
        setCompanyLoading(false)
      }
    } finally {
      // loadingCompanyRef.current = null // This is for loadCompany, not here
    }
  }, [authUser, groupId])

  // Initialize
  useEffect(() => {
    isMountedRef.current = true

    if (!authLoading) {
      const initialize = async () => {
        await loadUserCompanies()
      }

      initialize()
    }

    return () => {
      isMountedRef.current = false
    }
  }, [loadUserCompanies, authLoading])

  // Auto-select company after userCompanies are loaded. Use primaryCompanyId when available (multi-org).
  useEffect(() => {
    logger.debug('Auto-select effect triggered:', {
      userCompanies: userCompanies.length,
      currentCompany: !!currentCompany,
      initialCompanyId,
      primaryCompanyId: authUser?.primaryCompanyId
    })
    if (loadingCompanyRef.current) return
    if (authLoading || !authUser) return

    if (!groupId) {
      logger.warn('No company ID resolved from subdomain')
      setError('Please onboard Julley Project management system')
      setCompanyLoading(false)
      return
    }

    // Prefer localStorage (last selected), then primary company, then first in list
    const storedId = getStoredSelectedCompanyId(groupId)
    const userHasAccessToStored =
      storedId &&
      (authUser?.companyIds?.includes(storedId) || userCompanies.some(c => c.id === storedId))
    const targetCompanyId = userHasAccessToStored
      ? storedId
      : authUser.primaryCompanyId ?? (authUser.companyIds?.length ? authUser.companyIds[0] : undefined) ?? groupId

    // Only auto-select on initial load (no company selected). Do not overwrite when user has switched to a non-primary company.
    if (!currentCompany) {
      logger.debug('Loading initial company:', targetCompanyId, '(stored:', storedId ?? 'none', ', primaryCompanyId:', authUser.primaryCompanyId, ')')
      loadCompany(targetCompanyId, authUser.id)
    }
  }, [userCompanies.length, currentCompany, groupId, authUser?.id, authUser?.primaryCompanyId, authUser?.companyIds, loadCompany, authLoading])

  useEffect(() => {
    const resolveTenantProfile = async () => {
      if (!initialCompanyId) {
        setTenantProfile(null)
        setError('Please onboard Julley Project management system')
        setTenantLoading(false)
        return
      }

      try {
        setTenantLoading(true)
        const tenant = await TenantService.getTenantProfile(initialCompanyId)
        if (tenant) {
          setTenantProfile(tenant)
          setError(null)
        } else {
          setTenantProfile(null)
          setError('Please onboard Julley Project management system')
        }
      } catch (err) {
        logger.error('Error loading tenant profile:', err)
        setTenantProfile(null)
        setError('Failed to resolve tenant information')
      } finally {
        setTenantLoading(false)
      }
    }

    resolveTenantProfile()
  }, [initialCompanyId])

  const combinedLoading = tenantLoading || companyLoading

  const value: CompanyContextType = {
    currentCompany,
    setCurrentCompany,
    tenantProfile,
    tenantLoading,
    groupId: groupId ?? null,
    currentCompanyUser,
    setCurrentCompanyUser,
    companyId,
    isLoading: combinedLoading,
    setIsLoading: setCompanyLoading,
    switchCompany,
    refreshCompany,
    userCompanies,
    setUserCompanies,
    error,
    setError
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
      loadingCompanyRef.current = null
    }
  }, [])

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  )
}

// Hook to use company context
export function useCompany() {
  const context = useContext(CompanyContext)
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider')
  }
  return context
}

// Hook to get company ID (for easy access in components)
export function useCompanyId() {
  const { companyId } = useCompany()
  return companyId
}

// Hook to get enterprise group ID (required for all company-scoped Firestore paths)
export function useGroupId() {
  const { groupId } = useCompany()
  return groupId
}

// Hook to check if user has permission
export function useCompanyPermission(permission: keyof CompanyUser['permissions']) {
  const { currentCompanyUser } = useCompany()
  return currentCompanyUser?.permissions[permission] || false
}

// Hook to check if user is admin, owner, or group_admin
export function useIsCompanyAdmin() {
  const { currentCompanyUser } = useCompany()
  return currentCompanyUser?.role === 'admin' || currentCompanyUser?.role === 'owner' || currentCompanyUser?.role === 'group_admin'
}

// Hook to check if user is owner
export function useIsCompanyOwner() {
  const { currentCompanyUser } = useCompany()
  return currentCompanyUser?.role === 'owner'
}
