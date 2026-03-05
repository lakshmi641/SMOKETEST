'use client'

import { useCompany } from '@/contexts/CompanyContext'
import { AlertTriangle, Ban } from 'lucide-react'
import { MaintenanceView } from '@/components/maintenance/MaintenanceView'

export function TenantGuard({ children }: { children: React.ReactNode }) {
    const { error, isLoading, currentCompany, tenantProfile } = useCompany()

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50"></div>
        )
    }

    // Maintenance mode (system down / migration / system breach) – controlled from Platform
    if (tenantProfile?.maintenanceMode?.enabled && tenantProfile.maintenanceMode.reason) {
        return (
            <MaintenanceView
                maintenance={tenantProfile.maintenanceMode}
                companyName={tenantProfile.name ?? currentCompany?.name}
            />
        )
    }

    // Check if company is suspended or inactive
    const isCompanySuspendedOrInactive = currentCompany && (currentCompany.status === 'suspended' || currentCompany.status === 'inactive')
    // Also check tenant status (should be synced, but check both for safety)
    const isTenantInactive = tenantProfile && tenantProfile.status === 'inactive'
    
    if (isCompanySuspendedOrInactive || isTenantInactive) {
        // Determine if suspended (only company can be suspended, tenant can only be inactive)
        const isSuspended = currentCompany?.status === 'suspended'
        const statusMessage = isSuspended 
            ? 'Your company account has been suspended.'
            : 'Your company account is currently inactive.'
        const statusDetails = isSuspended
            ? 'Access to the platform has been temporarily restricted. Please contact your administrator or support for assistance.'
            : 'Access to the platform is currently unavailable. Please contact your administrator or support for assistance.'

        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8 text-center">
                    <div className="mb-6">
                        {isSuspended ? (
                            <Ban className="mx-auto h-16 w-16 text-orange-500" />
                        ) : (
                            <AlertTriangle className="mx-auto h-16 w-16 text-gray-400" />
                        )}
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                        {isSuspended ? 'Account Suspended' : 'Account Inactive'}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-300 mb-4">
                        {statusMessage}
                    </p>
                    <div className={`border rounded-md p-4 mb-6 ${
                        isSuspended 
                            ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' 
                            : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                    }`}>
                        <p className={`font-medium ${
                            isSuspended 
                                ? 'text-orange-800 dark:text-orange-200' 
                                : 'text-gray-800 dark:text-gray-200'
                        }`}>
                            {statusDetails}
                        </p>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        {currentCompany && (
                            <p className="mb-2">Company: <span className="font-semibold text-gray-700 dark:text-gray-300">{currentCompany.name}</span></p>
                        )}
                        <p>If you believe this is an error, please contact support.</p>
                    </div>
                </div>
            </div>
        )
    }

    if (error === 'Please onboard Julley Project management system') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8 text-center">
                    <div className="mb-6">
                        <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Tenant Not Found</h2>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                        We couldn't identify the company associated with this domain.
                    </p>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-md p-4 mb-6">
                        <p className="text-blue-800 dark:text-blue-200 font-medium">
                            Please onboard Julley Project Management System
                        </p>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        If you believe this is an error, please contact support.
                    </p>
                </div>
            </div>
        )
    }

    return <>{children}</>
}
