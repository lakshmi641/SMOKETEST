'use client'

import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { TaskTemplateManagement } from '@/components/templates/TaskTemplateManagement'

export default function TaskTemplatesPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <TaskTemplateManagement />
      </div>
    </DashboardLayout>
  )
}
