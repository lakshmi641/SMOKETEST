'use client'

import { useState, useEffect } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ProtectedPage } from '@/components/auth/ProtectedPage'
import { WebsiteService } from '@/lib/services'
import { ContactInbox } from '@/components/features/website-builder/ContactInbox'
import { ArrowLeft, Loader2, Inbox } from 'lucide-react'
import Link from 'next/link'
import type { Website } from '@/types/website-schema'

export default function WebsiteInboxPage() {
  const { companyId, groupId } = useCompany()
  const [website, setWebsite] = useState<Website | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!companyId || !groupId) return
    WebsiteService.getWebsiteByCompany(groupId, companyId)
      .then(setWebsite)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [companyId, groupId])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    )
  }

  if (!website || !groupId || !companyId) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-24">
          <Inbox className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 mb-4">No website found. Create one first.</p>
          <Link href="/website" className="text-blue-600 hover:underline">Go back</Link>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <ProtectedPage>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Link href="/website" className="p-1.5 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="h-4 w-4 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Contact Inbox</h1>
              <p className="text-sm text-gray-500 mt-0.5">{website.name}</p>
            </div>
          </div>

          <ContactInbox
            websiteId={website.id}
            groupId={groupId}
            companyId={companyId}
          />
        </div>
      </DashboardLayout>
    </ProtectedPage>
  )
}
