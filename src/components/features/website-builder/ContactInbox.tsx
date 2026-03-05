'use client'

import { useState, useEffect, useCallback } from 'react'
import { QueryDocumentSnapshot } from 'firebase/firestore'
import { ContactSubmissionService } from '@/lib/services/website'
import type { ContactSubmission } from '@/lib/services/website'
import { Inbox, Mail, MailOpen, Trash2, ChevronDown, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'react-hot-toast'

interface ContactInboxProps {
  websiteId: string
  groupId: string
  companyId: string
}

const PAGE_SIZE = 20

export function ContactInbox({ websiteId, groupId, companyId }: ContactInboxProps) {
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadSubmissions = useCallback(async () => {
    setLoading(true)
    try {
      const page = await ContactSubmissionService.getSubmissions(groupId, companyId, websiteId, PAGE_SIZE)
      setSubmissions(page.items)
      setLastDoc(page.lastDoc)
      setHasMore(page.hasMore)
    } catch (error) {
      console.error('Failed to load submissions:', error)
      toast.error('Failed to load submissions')
    } finally {
      setLoading(false)
    }
  }, [groupId, companyId, websiteId])

  const loadMore = async () => {
    if (!lastDoc || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await ContactSubmissionService.getMoreSubmissions(groupId, companyId, websiteId, lastDoc, PAGE_SIZE)
      setSubmissions((prev) => [...prev, ...page.items])
      setLastDoc(page.lastDoc)
      setHasMore(page.hasMore)
    } catch (error) {
      console.error('Failed to load more:', error)
      toast.error('Failed to load more')
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    loadSubmissions()
  }, [loadSubmissions])

  const toggleRead = async (submission: ContactSubmission) => {
    const newRead = !submission.read
    try {
      await ContactSubmissionService.markRead(groupId, companyId, websiteId, submission.id, newRead)
      setSubmissions((prev) =>
        prev.map((s) => (s.id === submission.id ? { ...s, read: newRead } : s))
      )
    } catch {
      toast.error('Failed to update')
    }
  }

  const deleteSubmission = async (id: string) => {
    try {
      await ContactSubmissionService.deleteSubmission(groupId, companyId, websiteId, id)
      setSubmissions((prev) => prev.filter((s) => s.id !== id))
      if (expandedId === id) setExpandedId(null)
      toast.success('Deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  const handleExpand = (submission: ContactSubmission) => {
    const isExpanding = expandedId !== submission.id
    setExpandedId(isExpanding ? submission.id : null)
    // Auto-mark as read when expanding
    if (isExpanding && !submission.read) {
      toggleRead(submission)
    }
  }

  const unreadCount = submissions.filter((s) => !s.read).length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (submissions.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <Inbox className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No inquiries yet</p>
        <p className="text-sm text-gray-400 mt-1">
          Contact form submissions from your website will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {unreadCount > 0 && (
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-blue-600">{unreadCount}</span> unread
        </p>
      )}

      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {submissions.map((submission) => {
          const isExpanded = expandedId === submission.id
          return (
            <div key={submission.id}>
              <button
                onClick={() => handleExpand(submission)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    {submission.read ? (
                      <MailOpen className="h-4 w-4 text-gray-400 shrink-0" />
                    ) : (
                      <Mail className="h-4 w-4 text-blue-600 shrink-0" />
                    )}
                    <span className={`text-sm truncate ${submission.read ? 'text-gray-600' : 'font-semibold text-gray-900'}`}>
                      {submission.name}
                    </span>
                    <span className="text-xs text-gray-400 truncate">{submission.email}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-xs text-gray-400">
                      {format(new Date(submission.createdAt), 'MMM d, h:mm a')}
                    </span>
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                {!isExpanded && (
                  <p className="text-xs text-gray-400 mt-1 truncate ml-7">
                    {submission.message}
                  </p>
                )}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 ml-7 space-y-3">
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Email:</span>{' '}
                        <a href={`mailto:${submission.email}`} className="text-blue-600 hover:underline">{submission.email}</a>
                      </div>
                      {submission.phone && (
                        <div>
                          <span className="text-gray-400">Phone:</span>{' '}
                          <a href={`tel:${submission.phone}`} className="text-blue-600 hover:underline">{submission.phone}</a>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{submission.message}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleRead(submission) }}
                      className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                    >
                      {submission.read ? <Mail className="h-3.5 w-3.5" /> : <MailOpen className="h-3.5 w-3.5" />}
                      Mark as {submission.read ? 'unread' : 'read'}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSubmission(submission.id) }}
                      className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {loadingMore ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  )
}
