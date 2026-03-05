'use client'

import { useParams } from 'next/navigation'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import { useEffect, useState } from 'react'
import { WebsiteService } from '@/lib/services'
import { BlockEditor } from '@/components/features/website-builder/BlockEditor'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import type { Website } from '@/types/website-schema'

export default function EditorPage() {
  const params = useParams()
  const pageId = params.pageId as string
  const { companyId, groupId } = useCompany()
  const { user } = useAuthStore()
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
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    )
  }

  if (!website || !companyId || !groupId) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <p className="text-gray-500 mb-4">No website found</p>
          <Link href="/website" className="text-blue-600 hover:underline">Go back</Link>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Mini header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-900 text-white">
        <Link href="/website" className="p-1 hover:bg-gray-800 rounded">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm font-medium">{website.name}</span>
        <div className="w-px h-4 bg-gray-700" />
        {/* Page selector */}
        <div className="flex items-center gap-2">
          {website.navigation.pages
            .sort((a, b) => a.order - b.order)
            .map((navPage) => (
              <Link
                key={navPage.pageId}
                href={`/website/editor/${navPage.pageId}`}
                className={`px-2 py-1 rounded text-xs ${
                  navPage.pageId === pageId
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {navPage.title}
              </Link>
            ))}
        </div>
      </div>

      {/* Editor */}
      <BlockEditor
        pageId={pageId}
        websiteId={website.id}
        companyId={companyId}
        groupId={groupId}
        supportedLanguages={website.settings.supportedLanguages}
      />
    </div>
  )
}
