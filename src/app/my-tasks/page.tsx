'use client'

import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { TaskDashboard } from '@/components/features/tasks'

export default function MyTasksPage() {
  return (
    <DashboardLayout>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <TaskDashboard />
      </div>
    </DashboardLayout>
  )
}
