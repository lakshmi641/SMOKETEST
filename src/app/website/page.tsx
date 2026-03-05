'use client'

import { useState, useEffect } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ProtectedPage } from '@/components/auth/ProtectedPage'
import { WebsiteService } from '@/lib/services'
import { WebsiteDashboard } from '@/components/features/website-builder/WebsiteDashboard'
import { PublishWorkflow } from '@/components/features/website-builder/PublishWorkflow'
import { Globe, Loader2, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { Website } from '@/types/website-schema'

export default function WebsitePage() {
  const { companyId, groupId } = useCompany()
  const { user } = useAuthStore()
  const [website, setWebsite] = useState<Website | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPublish, setShowPublish] = useState(false)

  const loadWebsite = () => {
    if (!companyId || !groupId) return
    setLoading(true)
    WebsiteService.getWebsiteByCompany(groupId, companyId)
      .then(setWebsite)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadWebsite()
  }, [companyId, groupId])

  return (
    <DashboardLayout>
      <ProtectedPage>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Website</h1>
              <p className="text-sm text-gray-500 mt-1">Create and manage your company website</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : website && groupId && companyId ? (
            <>
              <WebsiteDashboard website={website} groupId={groupId} companyId={companyId} onPublish={() => setShowPublish(true)} />
              {showPublish && user && (
                <PublishWorkflow
                  website={website}
                  groupId={groupId}
                  companyId={companyId}
                  userId={user.id}
                  onClose={() => setShowPublish(false)}
                  onPublished={() => { setShowPublish(false); loadWebsite() }}
                />
              )}
            </>
          ) : (
            /* Empty state — no website yet */
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-lg border border-gray-200">
              <div className="flex items-center justify-center w-16 h-16 bg-blue-50 rounded-full mb-4">
                <Globe className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Build your website</h2>
              <p className="text-gray-500 text-center max-w-md mb-6">
                Create a professional website for your business in minutes.
                Choose a template, customize it, and publish.
              </p>
              <Link
                href="/website/setup"
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </ProtectedPage>
    </DashboardLayout>
  )
}
