'use client'

import { useEffect } from 'react'
import { useCompany } from '@/contexts/CompanyContext'

export function TenantThemeProvider({ children }: { children: React.ReactNode }) {
    const { tenantProfile } = useCompany()

    useEffect(() => {
        // Remove all existing theme classes
        const themes = [
            'theme-blue',
            'theme-green',
            'theme-orange',
            'theme-red',
            'theme-rose',
            'theme-violet',
            'theme-yellow'
        ]
        document.body.classList.remove(...themes)

        // Add the new theme class if it exists and is not default
        if (tenantProfile?.branding?.theme && tenantProfile.branding.theme !== 'default') {
            document.body.classList.add(`theme-${tenantProfile.branding.theme}`)
        }
    }, [tenantProfile?.branding?.theme])

    return <>{children}</>
}
