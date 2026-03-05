'use client'

import { useState } from 'react'
import { FolderPlus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { createFolder } from '@/lib/services/storage/document-folder-service'
import toast from 'react-hot-toast'

interface CreateFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
  projectId: string
  userId: string
  groupId?: string | null
  onFolderCreated?: () => void
  parentFolderId?: string | null
  parentFolderName?: string | null
}

export function CreateFolderDialog({
  open,
  onOpenChange,
  companyId,
  projectId,
  userId,
  groupId,
  onFolderCreated,
  parentFolderId,
  parentFolderName
}: CreateFolderDialogProps) {
  const [folderName, setFolderName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    if (!folderName.trim()) {
      toast.error('Please enter a folder name')
      return
    }

    try {
      setIsCreating(true)
      await createFolder(companyId, projectId, folderName.trim(), userId, parentFolderId || undefined, groupId ?? undefined)
      toast.success(parentFolderName ? `Sub-folder created in ${parentFolderName}` : 'Folder created successfully')
      setFolderName('')
      onOpenChange(false)
      if (onFolderCreated) {
        onFolderCreated()
      }
    } catch (error: any) {
      console.error('Error creating folder:', error)
      toast.error(error.message || 'Failed to create folder')
    } finally {
      setIsCreating(false)
    }
  }

  const handleCancel = () => {
    setFolderName('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <FolderPlus className="h-5 w-5 text-primary" />
            {parentFolderName ? `Create Sub-folder in ${parentFolderName}` : 'Create New Folder'}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="folderName">Folder Name</Label>
            <Input
              id="folderName"
              placeholder="Enter folder name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && folderName.trim() && !isCreating) {
                  handleCreate()
                }
              }}
              disabled={isCreating}
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">
              Maximum 100 characters
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!folderName.trim() || isCreating}
            className="bg-primary"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Folder'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

