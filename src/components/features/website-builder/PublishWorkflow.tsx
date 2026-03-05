'use client'

import { useState, useEffect } from 'react'
import { PublishService, type ChecklistItem } from '@/lib/services/website/publish-service'
import { CheckCircle2, XCircle, AlertTriangle, Loader2, ExternalLink, Share2 } from 'lucide-react'
import type { Website } from '@/types/website-schema'

interface PublishWorkflowProps {
  website: Website
  groupId: string
  companyId: string
  userId: string
  onClose: () => void
  onPublished: () => void
}

export function PublishWorkflow({ website, groupId, companyId, userId, onClose, onPublished }: PublishWorkflowProps) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null)

  useEffect(() => {
    PublishService.runChecklist(groupId, companyId, website.id)
      .then(setChecklist)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [groupId, companyId, website.id])

  const hasErrors = checklist.some((item) => !item.passed && item.severity === 'error')

  const handlePublish = async () => {
    setPublishing(true)
    const result = await PublishService.publish(groupId, companyId, website.id, userId)
    setPublishing(false)

    if (result.success && result.publishedUrl) {
      setPublishedUrl(result.publishedUrl)
      onPublished()
    }
  }

  const shareOnWhatsApp = () => {
    if (!publishedUrl) return
    const text = `Check out our new website: ${publishedUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  // Success state
  if (publishedUrl) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl w-full max-w-md p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Website Published!</h2>
          <p className="text-sm text-gray-500 mb-4">Your website is now live at:</p>
          <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium">
            {publishedUrl}
            <ExternalLink className="h-4 w-4" />
          </a>
          <div className="flex items-center gap-3 mt-6">
            <button onClick={shareOnWhatsApp} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium">
              <Share2 className="h-4 w-4" />
              Share on WhatsApp
            </button>
            <button onClick={onClose} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium">
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Publish Website</h2>
        <p className="text-sm text-gray-500 mb-4">Review the checklist before publishing.</p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {checklist.map((item) => (
              <div key={item.key} className="flex items-center gap-3">
                {item.passed ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                ) : item.severity === 'error' ? (
                  <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                )}
                <span className={`text-sm ${item.passed ? 'text-gray-600' : item.severity === 'error' ? 'text-red-700' : 'text-yellow-700'}`}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
            Cancel
          </button>
          <button
            onClick={handlePublish}
            disabled={hasErrors || publishing || loading}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {publishing ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  )
}
