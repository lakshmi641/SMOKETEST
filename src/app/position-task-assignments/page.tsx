'use client'

import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PositionTaskAssignmentManagement } from '@/components/features/org'

export default function PositionTaskAssignmentsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PositionTaskAssignmentManagement />
      </div>
    </DashboardLayout>
  )
}
