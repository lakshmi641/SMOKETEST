'use client'

import { useState, useEffect } from 'react'
import { TemplateService } from '@/lib/services'
import { X, Monitor, Smartphone, Loader2 } from 'lucide-react'
import type { WebsiteTemplate, WebsitePage } from '@/types/website-schema'

// Template preview content is platform-managed (not user-generated)
// and is rendered in a sandboxed preview context

interface TemplatePreviewProps {
  template: WebsiteTemplate
  onClose: () => void
  onSelect: () => void
}

export function TemplatePreview({ template, onClose, onSelect }: TemplatePreviewProps) {
  const [pages, setPages] = useState<WebsitePage[]>([])
  const [loading, setLoading] = useState(true)
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop')

  useEffect(() => {
    TemplateService.getTemplatePages(template.id)
      .then(setPages)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [template.id])

  const homePage = pages.find((p) => p.isHomePage) || pages[0]

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{template.name}</h2>
            <p className="text-sm text-gray-500">{template.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button onClick={() => setViewport('desktop')} className={`p-1.5 rounded ${viewport === 'desktop' ? 'bg-white shadow-sm' : ''}`}>
                <Monitor className="h-4 w-4 text-gray-600" />
              </button>
              <button onClick={() => setViewport('mobile')} className={`p-1.5 rounded ${viewport === 'mobile' ? 'bg-white shadow-sm' : ''}`}>
                <Smartphone className="h-4 w-4 text-gray-600" />
              </button>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Preview — template content is platform-managed, pre-sanitized */}
        <div className="flex-1 overflow-auto bg-gray-50 p-4 flex justify-center">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : homePage ? (
            <div
              className={`bg-white shadow-lg transition-all ${viewport === 'mobile' ? 'w-[375px]' : 'w-full max-w-[1024px]'}`}
              style={{ fontFamily: `${template.fonts.body}, sans-serif`, minHeight: '400px' }}
            >
              {homePage.content.css && <style dangerouslySetInnerHTML={{ __html: homePage.content.css }} />}
              <div dangerouslySetInnerHTML={{ __html: homePage.content.html }} />
            </div>
          ) : (
            <p className="text-sm text-gray-500">No preview available</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{template.defaultPages.length} pages</span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: template.colorScheme.primary }} />
              {template.colorScheme.primary}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button onClick={onSelect} className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">Use This Template</button>
          </div>
        </div>
      </div>
    </div>
  )
}
