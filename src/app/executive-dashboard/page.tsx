'use client'

import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ProtectedPage } from '@/components/auth/ProtectedPage'
import { ExecutiveDashboard } from '@/components/features/executive-dashboard/ExecutiveDashboard'

export default function ExecutiveDashboardPage() {
    return (
        <DashboardLayout>
            <ProtectedPage className="flex-1 flex flex-col min-h-0">
                <ExecutiveDashboard />
            </ProtectedPage>
        </DashboardLayout>
    )
}
