'use client'

import { useState, useEffect } from 'react'
import { Pencil, Loader2 } from 'lucide-react'
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
import { updateFolder, type DocumentFolder } from '@/lib/services/storage/document-folder-service'
import toast from 'react-hot-toast'

interface EditFolderDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    companyId: string
    projectId: string
    groupId?: string | null
    folder: DocumentFolder | null
    onFolderUpdated?: () => void
}

export function EditFolderDialog({
    open,
    onOpenChange,
    companyId,
    projectId,
    groupId,
    folder,
    onFolderUpdated
}: EditFolderDialogProps) {
    const [folderName, setFolderName] = useState('')
    const [isUpdating, setIsUpdating] = useState(false)

    useEffect(() => {
        if (folder) {
            setFolderName(folder.name)
        }
    }, [folder])

    const handleUpdate = async () => {
        if (!folder) return

        if (!folderName.trim()) {
            toast.error('Please enter a folder name')
            return
        }

        if (folderName.trim() === folder.name) {
            onOpenChange(false)
            return
        }

        try {
            setIsUpdating(true)
            await updateFolder(companyId, projectId, folder.id, { name: folderName.trim() }, groupId ?? undefined)
            toast.success('Folder renamed successfully')
            onOpenChange(false)
            if (onFolderUpdated) {
                onFolderUpdated()
            }
        } catch (error: any) {
            console.error('Error updating folder:', error)
            toast.error(error.message || 'Failed to update folder')
        } finally {
            setIsUpdating(false)
        }
    }

    const handleCancel = () => {
        if (folder) setFolderName(folder.name)
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
                        <Pencil className="h-5 w-5 text-primary" />
                        Rename Folder
                    </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="editFolderName">Folder Name</Label>
                        <Input
                            id="editFolderName"
                            placeholder="Enter folder name"
                            value={folderName}
                            onChange={(e) => setFolderName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && folderName.trim() && !isUpdating) {
                                    handleUpdate()
                                }
                            }}
                            disabled={isUpdating}
                            maxLength={100}
                        />
                        <p className="text-xs text-muted-foreground">
                            Maximum 100 characters
                        </p>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={handleCancel} disabled={isUpdating}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleUpdate}
                        disabled={!folderName.trim() || isUpdating || folderName.trim() === folder?.name}
                        className="bg-primary"
                    >
                        {isUpdating ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Updating...
                            </>
                        ) : (
                            'Save Changes'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
