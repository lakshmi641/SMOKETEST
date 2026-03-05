'use client'

import { useState, useEffect } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { WebsiteService } from '@/lib/services'
import { SEOSettings } from '@/components/features/website-builder/SEOSettings'
import { DomainSettings } from '@/components/features/website-builder/DomainSettings'
import { BrandKitSettings } from '@/components/features/website-builder/BrandKitSettings'
import { ArrowLeft, Loader2, Palette, Search, Globe, Settings } from 'lucide-react'
import Link from 'next/link'
import type { Website } from '@/types/website-schema'

const TABS = [
  { id: 'brand-kit', label: 'Brand Kit', icon: Palette },
  { id: 'seo', label: 'SEO', icon: Search },
  { id: 'domain', label: 'Domain', icon: Globe },
  { id: 'general', label: 'General', icon: Settings },
] as const

type TabId = (typeof TABS)[number]['id']

export default function WebsiteSettingsPage() {
  const { companyId, groupId } = useCompany()
  const { user } = useAuthStore()
  const [website, setWebsite] = useState<Website | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>('brand-kit')

  const loadWebsite = () => {
    if (!companyId || !groupId) return
    WebsiteService.getWebsiteByCompany(groupId, companyId)
      .then(setWebsite)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadWebsite()
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
          <p className="text-gray-500 mb-4">No website found. Create one first.</p>
          <Link href="/website" className="text-blue-600 hover:underline">Go back</Link>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/website" className="p-1.5 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="h-4 w-4 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Website Settings</h1>
            <p className="text-sm text-gray-500 mt-0.5">{website.name}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-6">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          {activeTab === 'brand-kit' && (
            <BrandKitSettings
              website={website}
              onUpdated={loadWebsite}
            />
          )}
          {activeTab === 'seo' && (
            <SEOSettings
              website={website}
              groupId={groupId}
              companyId={companyId}
              onUpdated={loadWebsite}
            />
          )}
          {activeTab === 'domain' && (
            <DomainSettings
              website={website}
              groupId={groupId}
              companyId={companyId}
              onUpdated={loadWebsite}
            />
          )}
          {activeTab === 'general' && (
            <GeneralSettings
              website={website}
              groupId={groupId}
              companyId={companyId}
              onUpdated={loadWebsite}
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

/* Inline General Settings — lightweight, no separate file needed */
function GeneralSettings({
  website,
  groupId,
  companyId,
  onUpdated,
}: {
  website: Website
  groupId: string
  companyId: string
  onUpdated: () => void
}) {
  const [name, setName] = useState(website.name)
  const [navStyle, setNavStyle] = useState(website.navigation.style)
  const [hindiEnabled, setHindiEnabled] = useState(
    website.settings.supportedLanguages?.includes('hi') || false
  )
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await WebsiteService.updateWebsite(groupId, companyId, website.id, { name })
      await WebsiteService.updateNavigation(groupId, companyId, website.id, {
        style: navStyle,
      })
      // Update supported languages
      const supportedLanguages = hindiEnabled ? ['en', 'hi'] : ['en']
      await WebsiteService.updateSettings(groupId, companyId, website.id, {
        supportedLanguages,
      })
      onUpdated()
    } catch {
      // toast handled in service layer
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Site Identity</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Website Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Navigation</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Navigation Style</label>
          <select
            value={navStyle}
            onChange={(e) => setNavStyle(e.target.value as 'horizontal' | 'hamburger')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="horizontal">Horizontal Menu</option>
            <option value="hamburger">Hamburger Menu</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">How navigation appears on the public site</p>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Languages</h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={hindiEnabled}
            onChange={(e) => setHindiEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <span className="text-sm font-medium text-gray-700">Enable Hindi</span>
            <span className="text-sm text-gray-400 ml-1">(&#x0939;&#x093F;&#x0928;&#x094D;&#x0926;&#x0940;)</span>
          </div>
        </label>
        <p className="text-xs text-gray-400 mt-1.5 ml-7">
          When enabled, the visual editor will show a language toggle for creating Hindi versions of your pages.
          Visitors will see a language switcher on your published site.
        </p>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save General Settings'}
      </button>
    </div>
  )
}
