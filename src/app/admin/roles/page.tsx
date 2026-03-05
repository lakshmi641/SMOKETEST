'use client'

import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RoleManagement } from '@/components/features/access-control/RoleManagement'
import { Shield } from 'lucide-react'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import { Can } from '@/components/features/access-control/Can'

export default function RolesPage() {
  const { currentCompany, groupId } = useCompany()
  const { user } = useAuthStore()
  const companyId = currentCompany?.id || ''
  const userId = user?.id || ''

  if (!currentCompany) {
    return (
      <DashboardLayout>
        <p className="text-gray-500">Please select a company to manage roles and permissions.</p>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div>
        <Can
          permission="admin.role.manage"
          companyId={companyId}
          userId={userId}
          groupId={groupId}
          loading={
            <div className="mt-8 p-6">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-3 text-gray-600">Loading roles and permissions...</span>
              </div>
            </div>
          }
          fallback={
            <div className="mt-8 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-yellow-600" />
                <div>
                  <h3 className="font-semibold text-yellow-900">Access Denied</h3>
                  <p className="text-sm text-yellow-800">
                    You don't have permission to manage roles and permissions. Please contact your administrator.
                  </p>
                </div>
              </div>
            </div>
          }
        >
          <RoleManagement />
        </Can>
      </div>
    </DashboardLayout>
  )
}

