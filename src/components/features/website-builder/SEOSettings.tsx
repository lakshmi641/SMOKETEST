'use client'

import { useState } from 'react'
import { WebsiteService } from '@/lib/services'
import { Save, Loader2, X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import type { Website, StructuredDataType, WebsiteStructuredData } from '@/types/website-schema'

interface SEOSettingsProps {
  website: Website
  groupId: string
  companyId: string
  onUpdated: () => void
}

export function SEOSettings({ website, groupId, companyId, onUpdated }: SEOSettingsProps) {
  const [title, setTitle] = useState(website.seo.title)
  const [description, setDescription] = useState(website.seo.description)
  const [keywords, setKeywords] = useState<string[]>(website.seo.keywords || [])
  const [newKeyword, setNewKeyword] = useState('')
  const [businessType, setBusinessType] = useState<StructuredDataType>(
    website.seo.structuredData?.type || 'LocalBusiness'
  )
  const [businessName, setBusinessName] = useState(website.seo.structuredData?.name || website.name)
  const [phone, setPhone] = useState(website.seo.structuredData?.phone || '')
  const [email, setEmail] = useState(website.seo.structuredData?.email || '')
  const [gstin, setGstin] = useState(website.seo.structuredData?.gstin || '')
  const [city, setCity] = useState(website.seo.structuredData?.address?.addressLocality || '')
  const [state, setState] = useState(website.seo.structuredData?.address?.addressRegion || '')
  const [postalCode, setPostalCode] = useState(website.seo.structuredData?.address?.postalCode || '')
  const [saving, setSaving] = useState(false)

  const addKeyword = () => {
    const kw = newKeyword.trim().toLowerCase()
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw])
      setNewKeyword('')
    }
  }

  const removeKeyword = (kw: string) => {
    setKeywords(keywords.filter((k) => k !== kw))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const structuredData: WebsiteStructuredData = {
        type: businessType,
        name: businessName,
        ...(phone ? { phone } : {}),
        ...(email ? { email } : {}),
        ...(gstin ? { gstin } : {}),
        ...(city ? {
          address: {
            addressLocality: city,
            addressRegion: state || '',
            postalCode: postalCode || '',
          },
        } : {}),
      }
      await WebsiteService.updateSeo(groupId, companyId, website.id, {
        title,
        description,
        keywords,
        structuredData,
      })
      toast.success('SEO settings saved')
      onUpdated()
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Basic SEO */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Basic SEO</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Site Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="My Business — Tagline" />
            <p className="text-xs text-gray-400 mt-1">{title.length}/70 characters</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Meta Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Brief description of your business..." />
            <p className="text-xs text-gray-400 mt-1">{description.length}/160 characters</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Keywords</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {keywords.map((kw) => (
                <span key={kw} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                  {kw}
                  <button onClick={() => removeKeyword(kw)}><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Add keyword" />
              <button onClick={addKeyword} className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">Add</button>
            </div>
          </div>
        </div>
      </div>

      {/* Structured Data (JSON-LD) */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Business Information (JSON-LD)</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
            <select value={businessType} onChange={(e) => setBusinessType(e.target.value as StructuredDataType)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="LocalBusiness">Local Business</option>
              <option value="Organization">Organization</option>
              <option value="ProfessionalService">Professional Service</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
              <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN</label>
              <input type="text" value={gstin} onChange={(e) => setGstin(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="29AABCS1429B1Z5" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input type="text" value={state} onChange={(e) => setState(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PIN Code</label>
              <input type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saving ? 'Saving...' : 'Save SEO Settings'}
      </button>
    </div>
  )
}
