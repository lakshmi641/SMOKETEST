'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { useCompany } from '@/contexts/CompanyContext'
import { TenantService } from '@/lib/services/tenant-service'
import { cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'

const themes = [
    { name: 'blue', color: 'bg-blue-500' },
    { name: 'green', color: 'bg-green-500' },
    { name: 'orange', color: 'bg-orange-500' },
    { name: 'red', color: 'bg-red-500' },
    { name: 'rose', color: 'bg-rose-500' },
    { name: 'violet', color: 'bg-violet-500' },
    { name: 'yellow', color: 'bg-yellow-500' },
] as const

export function ThemeSelector() {
    const { tenantProfile, refreshCompany } = useCompany()
    const [isLoading, setIsLoading] = useState(false)

    const currentTheme = tenantProfile?.branding?.theme || 'default'

    const handleThemeChange = async (themeName: string) => {
        if (!tenantProfile?.id) return

        try {
            setIsLoading(true)
            await TenantService.updateTenantTheme(tenantProfile.id, themeName)
            await refreshCompany() // Refresh to update context
            toast.success('Theme updated successfully')
        } catch (error) {
            console.error('Failed to update theme:', error)
            toast.error('Failed to update theme')
        } finally {
            setIsLoading(false)
        }
    }

    if (!tenantProfile) return null

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Appearance</h3>
            </div>
            <div className="grid grid-cols-4 gap-4 sm:grid-cols-8">
                {themes.map((theme) => (
                    <button
                        key={theme.name}
                        onClick={() => handleThemeChange(theme.name)}
                        disabled={isLoading}
                        className={cn(
                            "group relative flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2",
                            currentTheme === theme.name
                                ? "border-primary ring-2 ring-primary ring-offset-2"
                                : "border-transparent hover:border-border",
                            isLoading && "opacity-50 cursor-not-allowed"
                        )}
                        title={theme.name.charAt(0).toUpperCase() + theme.name.slice(1)}
                    >
                        <span className={cn("h-8 w-8 rounded-full", theme.color)} />
                        {currentTheme === theme.name && (
                            <span className="absolute inset-0 flex items-center justify-center">
                                <Check className="h-4 w-4 text-white" />
                            </span>
                        )}
                        <span className="sr-only">{theme.name}</span>
                    </button>
                ))}
            </div>
            <p className="text-sm text-muted-foreground">
                Select a theme color for your workspace. This will apply to all users in your organization.
            </p>
        </div>
    )
}
