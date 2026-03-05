'use client'

import { Globe, Edit, Eye, Upload, ExternalLink, Clock, Inbox } from 'lucide-react'
import Link from 'next/link'
import type { Website } from '@/types/website-schema'
import { format } from 'date-fns'

interface WebsiteDashboardProps {
  website: Website
  groupId: string
  companyId: string
  onPublish?: () => void
}

export function WebsiteDashboard({ website, groupId, companyId, onPublish }: WebsiteDashboardProps) {
  const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    publishing: 'bg-blue-100 text-blue-800',
    published: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  }

  const homePage = website.navigation.pages.find((p) => p.slug === 'home' || p.order === 0)

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-50 rounded-full">
              <Globe className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{website.name}</h2>
              <p className="text-sm text-gray-500">
                Template: {website.templateName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColors[website.publishStatus] || 'bg-gray-100 text-gray-800'}`}>
              {website.publishStatus.charAt(0).toUpperCase() + website.publishStatus.slice(1)}
            </span>
            {onPublish && (
              <button
                onClick={onPublish}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                <Upload className="h-4 w-4" />
                {website.publishStatus === 'published' ? 'Republish' : 'Publish'}
              </button>
            )}
          </div>
        </div>

        {website.publishedUrl && (
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
            <ExternalLink className="h-4 w-4" />
            <a href={website.publishedUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              {website.publishedUrl}
            </a>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href={`/website/editor/${homePage?.pageId || ''}`}
          className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
        >
          <Edit className="h-5 w-5 text-blue-600" />
          <div>
            <p className="font-medium text-gray-900">Edit Pages</p>
            <p className="text-xs text-gray-500">Open visual editor</p>
          </div>
        </Link>

        <Link
          href="/website/inbox"
          className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
        >
          <Inbox className="h-5 w-5 text-blue-600" />
          <div>
            <p className="font-medium text-gray-900">Inbox</p>
            <p className="text-xs text-gray-500">View contact inquiries</p>
          </div>
        </Link>

        <Link
          href="/website/settings"
          className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
        >
          <Globe className="h-5 w-5 text-blue-600" />
          <div>
            <p className="font-medium text-gray-900">Settings & SEO</p>
            <p className="text-xs text-gray-500">Domain, SEO, branding</p>
          </div>
        </Link>

        {website.publishedUrl && (
          <a
            href={website.publishedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
          >
            <Eye className="h-5 w-5 text-blue-600" />
            <div>
              <p className="font-medium text-gray-900">View Live Site</p>
              <p className="text-xs text-gray-500">Open in new tab</p>
            </div>
          </a>
        )}
      </div>

      {/* Pages List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Pages</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {website.navigation.pages
            .sort((a, b) => a.order - b.order)
            .map((page) => (
              <Link
                key={page.pageId}
                href={`/website/editor/${page.pageId}`}
                className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900">{page.title}</span>
                  <span className="text-xs text-gray-400">/{page.slug}</span>
                </div>
                <Edit className="h-4 w-4 text-gray-400" />
              </Link>
            ))}
        </div>
      </div>

      {/* Publish History */}
      {website.publishHistory.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Publish History</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {website.publishHistory.slice(-5).reverse().map((record, idx) => (
              <div key={idx} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {format(new Date(record.publishedAt), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
                <span className={`text-xs font-medium ${record.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                  {record.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
