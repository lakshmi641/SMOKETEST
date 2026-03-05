'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Loader2 } from 'lucide-react'

export interface DeleteConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
  title?: string
  description?: string
  itemName: string
  itemType: 'project' | 'workspace' | 'task' | 'custom'
  customTypeName?: string
  cascadeInfo?: {
    projects?: number
    tasks?: number
  }
  confirmText?: string
  variant?: 'danger' | 'warning'
}

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  itemName,
  itemType,
  customTypeName,
  cascadeInfo,
  confirmText,
  variant = 'danger'
}: DeleteConfirmationDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const typeDisplayName = customTypeName || itemType

  const defaultTitle = title || `Delete ${typeDisplayName}?`
  const defaultDescription = description || 
    `Are you sure you want to delete "${itemName}"? This action cannot be undone.`

  const handleConfirm = async () => {
    setIsDeleting(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (error) {
      console.error('Error during deletion:', error)
      // Error handling will be done by the parent component
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCancel = () => {
    if (!isDeleting) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`rounded-full p-2 ${
              variant === 'danger' ? 'bg-red-100' : 'bg-amber-100'
            }`}>
              <AlertTriangle className={`h-6 w-6 ${
                variant === 'danger' ? 'text-red-600' : 'text-amber-600'
              }`} />
            </div>
            <DialogTitle className="text-xl">{defaultTitle}</DialogTitle>
          </div>
          <DialogDescription className="pt-4 text-base">
            {defaultDescription}
          </DialogDescription>
        </DialogHeader>

        {/* Cascade Information */}
        {cascadeInfo && (
          (cascadeInfo.projects !== undefined && cascadeInfo.projects > 0) || 
          (cascadeInfo.tasks !== undefined && cascadeInfo.tasks > 0)
        ) && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
            <p className="font-semibold text-amber-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              This will also delete:
            </p>
            <ul className="space-y-1 text-sm text-amber-800 ml-6">
              {cascadeInfo.projects !== undefined && cascadeInfo.projects > 0 && (
                <li className="list-disc">
                  <span className="font-semibold">{cascadeInfo.projects}</span> project
                  {cascadeInfo.projects !== 1 ? 's' : ''}
                </li>
              )}
              {cascadeInfo.tasks !== undefined && cascadeInfo.tasks > 0 && (
                <li className="list-disc">
                  <span className="font-semibold">{cascadeInfo.tasks}</span> task
                  {cascadeInfo.tasks !== 1 ? 's' : ''}
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Warning Box */}
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-800">
            <span className="font-semibold">Warning:</span> This action cannot be undone. 
            All data will be permanently deleted.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              confirmText || `Delete ${typeDisplayName}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

