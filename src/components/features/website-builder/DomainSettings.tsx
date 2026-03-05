'use client'

import { useState } from 'react'
import { WebsiteService } from '@/lib/services'
import { TemplateService } from '@/lib/services'
import { Check, Copy, AlertCircle, Loader2, Globe } from 'lucide-react'
import { toast } from 'react-hot-toast'
import type { Website } from '@/types/website-schema'

interface DomainSettingsProps {
  website: Website
  groupId: string
  companyId: string
  onUpdated: () => void
}

export function DomainSettings({ website, groupId, companyId, onUpdated }: DomainSettingsProps) {
  const [subdomain, setSubdomain] = useState(website.domain.subdomain)
  const [customDomain, setCustomDomain] = useState(website.domain.customDomain || '')
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null)

  const baseDomain = process.env.NEXT_PUBLIC_WAAS_DOMAIN || 'julley.app'

  const checkSubdomain = async () => {
    if (!subdomain.trim() || subdomain === website.domain.subdomain) return
    setChecking(true)
    try {
      const available = await TemplateService.isSubdomainAvailable(subdomain)
      setSubdomainAvailable(available)
    } catch {
      toast.error('Failed to check availability')
    } finally {
      setChecking(false)
    }
  }

  const saveSubdomain = async () => {
    if (!subdomain.trim()) return
    setSaving(true)
    try {
      await WebsiteService.updateDomain(groupId, companyId, website.id, { subdomain })
      toast.success('Subdomain updated')
      onUpdated()
    } catch (error) {
      toast.error('Failed to update subdomain')
    } finally {
      setSaving(false)
    }
  }

  const saveCustomDomain = async () => {
    if (!customDomain.trim()) return
    setSaving(true)
    try {
      await WebsiteService.updateDomain(groupId, companyId, website.id, {
        customDomain,
        domainStatus: 'pending',
      })
      toast.success('Custom domain saved. Configure DNS to activate.')
      onUpdated()
    } catch (error) {
      toast.error('Failed to save custom domain')
    } finally {
      setSaving(false)
    }
  }

  const copyDnsValue = (value: string) => {
    navigator.clipboard.writeText(value)
    toast.success('Copied to clipboard')
  }

  return (
    <div className="space-y-6">
      {/* Subdomain */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Subdomain</label>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden flex-1">
            <input
              type="text"
              value={subdomain}
              onChange={(e) => {
                setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                setSubdomainAvailable(null)
              }}
              onBlur={checkSubdomain}
              className="flex-1 px-3 py-2 text-sm focus:outline-none"
              placeholder="my-business"
            />
            <span className="px-3 py-2 bg-gray-50 text-sm text-gray-500 border-l">.{baseDomain}</span>
          </div>
          {checking && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          {subdomainAvailable === true && <Check className="h-4 w-4 text-green-500" />}
          {subdomainAvailable === false && <AlertCircle className="h-4 w-4 text-red-500" />}
        </div>
        {subdomainAvailable === false && (
          <p className="text-xs text-red-500 mt-1">This subdomain is already taken</p>
        )}
        {subdomain !== website.domain.subdomain && (
          <button onClick={saveSubdomain} disabled={saving || subdomainAvailable === false} className="mt-2 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Update Subdomain'}
          </button>
        )}
      </div>

      {/* Custom Domain */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Custom Domain (optional)</label>
        <input
          type="text"
          value={customDomain}
          onChange={(e) => setCustomDomain(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="www.mybusiness.com"
        />
        {customDomain && customDomain !== website.domain.customDomain && (
          <button onClick={saveCustomDomain} disabled={saving} className="mt-2 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50">
            Save Custom Domain
          </button>
        )}
      </div>

      {/* DNS Instructions */}
      {website.domain.customDomain && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">DNS Configuration</h4>
          <p className="text-xs text-gray-500 mb-3">Add the following CNAME record to your DNS provider:</p>
          <div className="bg-white rounded border border-gray-200 p-3 flex items-center justify-between">
            <div className="text-sm">
              <span className="text-gray-500">CNAME</span>
              <span className="mx-2 text-gray-300">|</span>
              <span className="font-mono">{website.domain.customDomain}</span>
              <span className="mx-2 text-gray-300">&rarr;</span>
              <span className="font-mono text-blue-600">cname.vercel-dns.com</span>
            </div>
            <button onClick={() => copyDnsValue('cname.vercel-dns.com')} className="p-1 hover:bg-gray-100 rounded">
              <Copy className="h-4 w-4 text-gray-400" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Globe className="h-4 w-4 text-gray-400" />
            <span className="text-xs text-gray-500">
              Domain status: <span className="font-medium">{website.domain.domainStatus}</span>
            </span>
            {website.domain.sslStatus === 'active' && (
              <span className="text-xs text-green-600 font-medium">SSL Active</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
