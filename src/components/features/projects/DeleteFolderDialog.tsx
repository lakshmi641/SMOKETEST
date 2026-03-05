'use client'

import { useState, useMemo } from 'react'
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog'
import { deleteFolderRecursive, type DocumentFolder } from '@/lib/services/storage/document-folder-service'
import toast from 'react-hot-toast'

interface DeleteFolderDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    companyId: string
    projectId: string
    groupId?: string | null
    folder: DocumentFolder | null
    allFolders: DocumentFolder[]
    documents: any[]
    defaultFolderId: string
    onFolderDeleted?: () => void
}

export function DeleteFolderDialog({
    open,
    onOpenChange,
    companyId,
    projectId,
    groupId,
    folder,
    allFolders,
    documents,
    defaultFolderId,
    onFolderDeleted
}: DeleteFolderDialogProps) {
    const [isDeleting, setIsDeleting] = useState(false)

    const stats = useMemo(() => {
        if (!folder) return { docCount: 0, subFolderCount: 0 }

        const subFolderIds = new Set<string>()
        const getChildren = (parentId: string) => {
            const children = allFolders.filter(f => f.parentFolderId === parentId)
            children.forEach(child => {
                subFolderIds.add(child.id)
                getChildren(child.id)
            })
        }
        getChildren(folder.id)

        const affectedFolderIds = [folder.id, ...Array.from(subFolderIds)]
        const affectedDocs = documents.filter(doc => affectedFolderIds.includes(doc.folderId))

        return {
            docCount: affectedDocs.length,
            subFolderCount: subFolderIds.size
        }
    }, [folder, allFolders, documents])

    const handleDelete = async () => {
        if (!folder || !defaultFolderId) return

        try {
            setIsDeleting(true)
            await deleteFolderRecursive(companyId, projectId, folder.id, defaultFolderId, groupId ?? undefined)
            toast.success('Folder and sub-folders deleted successfully')
            onOpenChange(false)
            if (onFolderDeleted) {
                onFolderDeleted()
            }
        } catch (error: any) {
            console.error('Error deleting folder:', error)
            toast.error(error.message || 'Failed to delete folder')
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600 font-bold">
                        <AlertTriangle className="h-5 w-5" />
                        Delete Folder?
                    </DialogTitle>
                    <DialogDescription className="pt-2">
                        Are you sure you want to delete <strong>"{folder?.name}"</strong>?
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 px-1">
                    <div className="bg-red-50 border border-red-100 rounded-lg p-4 space-y-3">
                        <div className="flex items-start gap-3">
                            <div className="bg-red-100 p-2 rounded-full mt-0.5">
                                <Trash2 className="h-4 w-4 text-red-600" />
                            </div>
                            <div className="text-sm">
                                <p className="font-semibold text-red-900">Impact Analysis:</p>
                                <ul className="list-disc list-inside mt-1 text-red-800 space-y-1">
                                    <li><strong>{stats.docCount}</strong> files will be moved to Default</li>
                                    <li><strong>{stats.subFolderCount}</strong> sub-folders will be permanently removed</li>
                                </ul>
                            </div>
                        </div>
                        <p className="text-xs text-red-700 leading-relaxed">
                            The folder structure will be permanently destroyed. All documents within these folders will be safely relocated to the <strong>Default</strong> folder to prevent data loss.
                        </p>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="bg-red-600 hover:bg-red-700"
                    >
                        {isDeleting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Deleting...
                            </>
                        ) : (
                            'Confirm Deletion'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
