'use client'

import { useState, useEffect } from 'react'
import { TemplateService } from '@/lib/services'
import { Loader2, Check, Star } from 'lucide-react'
import type { WebsiteTemplate, WebsiteTemplateCategory } from '@/types/website-schema'

const CATEGORIES: { key: WebsiteTemplateCategory | 'all' | 'featured'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'featured', label: 'Featured' },
  { key: 'general', label: 'General' },
  { key: 'service', label: 'Service' },
  { key: 'retail', label: 'Retail' },
  { key: 'restaurant', label: 'Restaurant' },
  { key: 'consulting', label: 'Consulting' },
  { key: 'healthcare', label: 'Healthcare' },
  { key: 'manufacturing', label: 'Manufacturing' },
  { key: 'education', label: 'Education' },
]

interface TemplateGalleryProps {
  selectedTemplateId?: string
  onSelect: (template: WebsiteTemplate) => void
}

export function TemplateGallery({ selectedTemplateId, onSelect }: TemplateGalleryProps) {
  const [templates, setTemplates] = useState<WebsiteTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<WebsiteTemplateCategory | 'all' | 'featured'>('all')

  useEffect(() => {
    setLoading(true)
    TemplateService.getTemplates({ isActive: true })
      .then(setTemplates)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = category === 'all'
    ? templates
    : category === 'featured'
      ? templates.filter((t) => t.isFeatured)
      : templates.filter((t) => t.category === category)

  const getCategoryCount = (key: string) => {
    if (key === 'all') return templates.length
    if (key === 'featured') return templates.filter((t) => t.isFeatured).length
    return templates.filter((t) => t.category === key).length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => {
          const count = getCategoryCount(cat.key)
          return (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                category === cat.key
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat.key === 'featured' && <Star className="h-3 w-3" />}
              {cat.label}
              {count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  category === cat.key ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Template Grid */}
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">
          No templates available. Run the seed script to add templates.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((template) => {
            const isSelected = selectedTemplateId === template.id
            return (
              <button
                key={template.id}
                onClick={() => onSelect(template)}
                className={`text-left rounded-lg border-2 overflow-hidden transition-all ${
                  isSelected
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Thumbnail */}
                <div className="h-40 bg-gray-100 flex items-center justify-center relative">
                  {template.thumbnail ? (
                    <img src={template.thumbnail} alt={template.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full" style={{ background: `linear-gradient(135deg, ${template.colorScheme.primary}, ${template.colorScheme.secondary})` }}>
                      <span className="text-white text-lg font-bold">{template.name.charAt(0)}</span>
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
                {/* Info */}
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">{template.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{template.category}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{template.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
