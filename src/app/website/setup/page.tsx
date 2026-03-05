'use client'

import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { SetupWizard } from '@/components/features/website-builder/SetupWizard'

export default function WebsiteSetupPage() {
  return (
    <DashboardLayout>
      <SetupWizard />
    </DashboardLayout>
  )
}
