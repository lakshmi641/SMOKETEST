'use client'

import React from 'react'
import { X } from 'lucide-react'

interface DeleteCommentDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isDeleting: boolean
}

export function DeleteCommentDialog({
  isOpen,
  onClose,
  onConfirm,
  isDeleting
}: DeleteCommentDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right">
      {/* Compact Toast */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
          <span className="text-sm font-medium text-gray-700">Delete comment?</span>
          <button
            onClick={onClose}
            className="p-0.5 hover:bg-gray-200 rounded transition-colors"
            disabled={isDeleting}
          >
            <X className="h-3.5 w-3.5 text-gray-500" />
          </button>
        </div>
        
        {/* Content */}
        <div className="px-3 py-2.5">
          <p className="text-xs text-gray-600">
            This action cannot be undone.
          </p>
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-3 py-2 bg-gray-50 border-t">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
          >
            No
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-2.5 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {isDeleting ? (
              <>
                <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              'Yes, delete'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

