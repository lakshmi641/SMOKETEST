'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  File,
  Download,
  Trash2,
  Image as ImageIcon,
  FileText,
  FileSpreadsheet,
  FileCode,
  Archive,
  X
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  deleteTaskAttachment,
  getAttachmentDownloadURL,
  formatFileSize,
  type TaskAttachment
} from '@/lib/services/storage/task-attachment-service'
import { useAuthStore } from '@/store/authStore'
import { formatDate } from './utils'

interface TaskAttachmentsListProps {
  attachments: TaskAttachment[]
  taskId: string
  companyId: string
  onDelete?: (attachment: TaskAttachment) => void
  canDelete?: boolean
}

export function TaskAttachmentsList({
  attachments,
  taskId,
  companyId,
  onDelete,
  canDelete = true
}: TaskAttachmentsListProps) {
  const { user } = useAuthStore()
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set())

  const getFileIcon = (contentType: string) => {
    if (contentType.startsWith('image/')) {
      return <ImageIcon className="h-5 w-5 text-blue-500" />
    }
    if (contentType.includes('spreadsheet') || contentType.includes('excel')) {
      return <FileSpreadsheet className="h-5 w-5 text-green-500" />
    }
    if (contentType.includes('pdf')) {
      return <FileText className="h-5 w-5 text-red-500" />
    }
    if (contentType.includes('zip') || contentType.includes('rar') || contentType.includes('7z')) {
      return <Archive className="h-5 w-5 text-purple-500" />
    }
    if (contentType.includes('code') || contentType.includes('text')) {
      return <FileCode className="h-5 w-5 text-gray-500" />
    }
    return <File className="h-5 w-5 text-gray-500" />
  }

  const handleDownload = async (attachment: TaskAttachment) => {
    setDownloadingIds(prev => new Set(prev).add(attachment.id))

    try {
      const url = await getAttachmentDownloadURL(attachment)
      window.open(url, '_blank')
    } catch (error: any) {
      console.error('Download error:', error)
      toast.error(`Failed to download ${attachment.name}`)
    } finally {
      setDownloadingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(attachment.id)
        return newSet
      })
    }
  }

  const handleDelete = async (attachment: TaskAttachment) => {
    if (!confirm(`Are you sure you want to delete "${attachment.name}"?`)) {
      return
    }

    setDeletingIds(prev => new Set(prev).add(attachment.id))

    try {
      await deleteTaskAttachment(taskId, companyId, attachment)
      toast.success('Attachment deleted successfully')

      if (onDelete) {
        onDelete(attachment)
      }
    } catch (error: any) {
      console.error('Delete error:', error)
      toast.error(`Failed to delete ${attachment.name}`)
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(attachment.id)
        return newSet
      })
    }
  }

  const canUserDelete = (attachment: TaskAttachment) => {
    if (!canDelete) return false
    // Allow deletion if user uploaded it or is admin
    return user?.id === attachment.uploadedBy || user?.role === 'admin'
  }

  if (attachments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <File className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No attachments yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {attachments.map((attachment) => {
        const isDeleting = deletingIds.has(attachment.id)
        const isDownloading = downloadingIds.has(attachment.id)
        const canDeleteThis = canUserDelete(attachment)

        return (
          <div
            key={attachment.id}
            className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 transition-colors group"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0">
                {getFileIcon(attachment.contentType)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{attachment.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.size)}
                  </p>
                  <span className="text-xs text-muted-foreground">•</span>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(attachment.uploadedAt)}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDownload(attachment)}
                disabled={isDownloading || isDeleting}
                title="Download"
              >
                <Download className="h-4 w-4" />
              </Button>
              {canDeleteThis && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(attachment)}
                  disabled={isDeleting || isDownloading}
                  className="text-destructive hover:text-destructive"
                  title="Delete"
                >
                  {isDeleting ? (
                    <X className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

