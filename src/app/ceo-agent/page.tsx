'use client'

import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { CeoAgentPanel } from '@/components/features/ceo-agent/CeoAgentPanel'

export default function CeoAgentPage() {
  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        <div className="flex-1 max-w-5xl mx-auto w-full p-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 h-full overflow-hidden">
            <CeoAgentPanel />
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
