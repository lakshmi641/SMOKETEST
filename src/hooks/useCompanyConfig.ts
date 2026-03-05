'use client'

import { useMemo } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { CompanyConfig } from '@/config/company'

/**
 * Hook to get company configuration from company provider
 * Falls back to default config if company data is not available
 */
export function useCompanyConfig(): CompanyConfig {
  const { currentCompany, tenantProfile } = useCompany()

  return useMemo(() => {
    const sourceCompany = currentCompany || tenantProfile

    const ensureArray = <T,>(value: T[] | undefined | null): T[] => {
      return Array.isArray(value) ? value : []
    }

    if (!sourceCompany) {
      // Return default config if company is not loaded
      return {
        name: 'Company',
        industry: 'General',
        description: '',
        logo: undefined,
        primaryColor: '#1e40af',
        secondaryColor: '#3b82f6',
        features: [],
        equipmentTypes: [],
        manufacturingPhases: [],
        qualityStandards: [],
        complianceRequirements: []
      }
    }

    if ('pmsConfig' in sourceCompany) {
      // Prefer company branding; fall back to tenant profile (e.g. when platform syncs logo to tenant only)
      const branding = sourceCompany.branding
      const tenantBranding = tenantProfile?.branding
      return {
        name: sourceCompany.name,
        industry: sourceCompany.pmsConfig?.industry || sourceCompany.description || 'General',
        description: sourceCompany.pmsConfig?.description || sourceCompany.description || '',
        logo: branding?.logo ?? tenantBranding?.logo,
        primaryColor: (branding?.primaryColor ?? tenantBranding?.primaryColor) || '#1e40af',
        secondaryColor: (branding?.secondaryColor ?? tenantBranding?.secondaryColor) || '#3b82f6',
        features: ensureArray(sourceCompany.pmsConfig?.features),
        equipmentTypes: ensureArray(sourceCompany.pmsConfig?.equipmentTypes),
        manufacturingPhases: ensureArray(sourceCompany.pmsConfig?.manufacturingPhases),
        qualityStandards: ensureArray(sourceCompany.pmsConfig?.qualityStandards),
        complianceRequirements: ensureArray(sourceCompany.pmsConfig?.complianceRequirements)
      }
    }

    // Fallback branch: sourceCompany is a TenantProfile (from `tenants` collection)
    const tenant = sourceCompany as any

    return {
      name: tenant.name,
      industry: tenant.tagline || 'General',
      description: tenant.tagline || '',
      logo: tenant.branding?.logo,
      primaryColor: tenant.branding?.primaryColor || '#1e40af',
      secondaryColor: tenant.branding?.secondaryColor || '#3b82f6',
      features: ensureArray(tenant.features),
      equipmentTypes: [],
      manufacturingPhases: [],
      qualityStandards: [],
      complianceRequirements: []
    }
  }, [currentCompany, tenantProfile])
}

