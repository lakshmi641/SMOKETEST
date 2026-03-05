'use client'

import React, { useState } from 'react'
import { formatDate as parserFormatDate } from '@/lib/utils/date-utils'
import type { TaskComment, CommentAttachment } from '@/types/task-comment'
import type { User } from '@/types'
import { CommentForm } from './CommentForm'
import { Edit2, Trash2, Download, Loader2 } from 'lucide-react'
import { auth } from '@/lib/firebase'

interface CommentItemProps {
  comment: TaskComment
  allUsers: User[]
  currentUserId: string
  taskId: string
  onEdit: (
    commentId: string,
    text: string,
    plainText: string,
    mentions: string[],
    attachments: CommentAttachment[]
  ) => Promise<void>
  onDelete: (commentId: string) => Promise<void>
}

export function CommentItem({
  comment,
  allUsers,
  currentUserId,
  taskId,
  onEdit,
  onDelete
}: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDownloading, setIsDownloading] = useState<string | null>(null)

  const isAuthor = comment.userId === currentUserId

  function getInitials(name: string): string {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`

    return parserFormatDate(date)
  }

  async function handleDownload(url: string, name: string) {
    try {
      setIsDownloading(url)

      // 1. Get current user's auth token
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error('User must be authenticated to download files')
      }
      const token = await currentUser.getIdToken()

      // 2. Call the server-side download proxy route
      const params = new URLSearchParams({
        path: url,        // can be a storage path or signed URL
        filename: name,   // desired download filename
      })

      const response = await fetch(`/api/storage/download?${params.toString()}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Download failed with status ${response.status}`)
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)

      const safeName = name.replace(/[^\x20-\x7E]/g, '_')
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = safeName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      URL.revokeObjectURL(objectUrl)
    } catch (error: any) {
      console.error('Download error:', error)
      // Fallback: search for a way to show toast or just alert
      alert(error.message || 'Failed to download document')
      // Open in new tab as final fallback
      window.open(url, '_blank')
    } finally {
      setIsDownloading(null)
    }
  }

  async function handleEdit(
    text: string,
    plainText: string,
    mentions: string[],
    attachments: CommentAttachment[]
  ) {
    await onEdit(comment.id, text, plainText, mentions, attachments)
    setIsEditing(false)
  }

  async function handleDeleteConfirm() {
    setIsDeleting(true)
    try {
      await onDelete(comment.id)
      setShowDeleteDialog(false)
    } catch (error) {
      console.error('Error deleting comment:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  if (isEditing) {
    return (
      <div className="py-2">
        <CommentForm
          allUsers={allUsers}
          onSubmit={handleEdit}
          submitting={false}
          initialValue={comment.text}
          initialAttachments={comment.attachments}
          taskId={taskId}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    )
  }

  return (
    <div
      className="flex gap-2.5 py-3 hover:bg-gray-50/50 transition-colors relative group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex-shrink-0">
        {comment.userAvatar ? (
          <img
            src={comment.userAvatar}
            alt={comment.userName}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium text-xs">
            {getInitials(comment.userName)}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="font-medium text-sm text-gray-900">
            {comment.userName}
          </span>
          <span className="text-xs text-gray-400">
            {formatDate(comment.createdAt)}
          </span>
          {comment.isEdited && (
            <span className="text-xs text-gray-400 italic">(edited)</span>
          )}
        </div>

        <div
          className="prose prose-sm max-w-none text-gray-700 text-sm leading-relaxed comment-content"
          dangerouslySetInnerHTML={{ __html: comment.text }}
        />

        {/* Attached Images */}
        {comment.attachments && comment.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {comment.attachments.map((att, i) => (
              <div key={i} className="relative group rounded border border-gray-200 overflow-hidden bg-gray-50">
                <img
                  src={att.url}
                  alt={att.name}
                  className="h-24 w-24 object-cover block"
                />
                {/* Download button — visible on hover */}
                <button
                  onClick={() => handleDownload(att.url, att.name)}
                  disabled={isDownloading === att.url}
                  className="absolute inset-0 flex items-end justify-center pb-1 bg-black/0 group-hover:bg-black/30 transition-colors w-full"
                  title={`Download ${att.name}`}
                >
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-gray-800 rounded px-1.5 py-0.5 flex items-center gap-1 text-xs font-medium shadow-sm">
                    {isDownloading === att.url ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Download className="h-3 w-3" />
                    )}
                    {isDownloading === att.url ? 'Downloading...' : 'Download'}
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}

        <style jsx global>{`
          .comment-content ul,
          .comment-content ol {
            padding-left: 1.5rem;
            margin: 0.5rem 0;
          }
          .comment-content ul {
            list-style-type: disc;
          }
          .comment-content ol {
            list-style-type: decimal;
          }
          .comment-content li {
            margin: 0.25rem 0;
          }
          .comment-content p {
            margin: 0.25rem 0;
          }
          .comment-content code {
            background-color: #f3f4f6;
            padding: 0.125rem 0.25rem;
            border-radius: 0.25rem;
            font-size: 0.875em;
          }
          .comment-content pre {
            background-color: #1f2937;
            color: #f9fafb;
            padding: 0.75rem;
            border-radius: 0.375rem;
            overflow-x: auto;
            margin: 0.5rem 0;
          }
          .comment-content pre code {
            background-color: transparent;
            padding: 0;
            color: inherit;
          }
        `}</style>
      </div>

      {isAuthor && showActions && (
        <div className="absolute top-2 right-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Delete Confirmation Popover */}
          {showDeleteDialog && (
            <div className="absolute top-0 right-full mr-2 z-50 min-w-[200px] bg-white rounded-lg shadow-xl border border-gray-200 p-3 animate-in fade-in zoom-in-95 duration-200">
              <p className="text-xs font-medium text-gray-900 mb-2">Delete this comment?</p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowDeleteDialog(false)}
                  disabled={isDeleting}
                  className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center gap-1"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          )}

          <button
            onClick={() => setIsEditing(true)}
            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Edit comment"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setShowDeleteDialog(!showDeleteDialog)}
            className={`p-1 rounded transition-colors ${showDeleteDialog
              ? 'text-red-600 bg-red-50'
              : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
              }`}
            title="Delete comment"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
