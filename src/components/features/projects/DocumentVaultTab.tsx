'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { Search, Upload, FileText, File, Image as ImageIcon, FileCode, Download, Eye, FolderOpen, Loader2, FolderPlus, Trash2, X, Folder, ChevronRight, ChevronLeft, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuthStore } from '@/store/authStore'
import { auth } from '@/lib/firebase'
import { uploadTaskAttachments, deleteTaskAttachment, deleteTaskEvidence, addTaskLink } from '@/lib/services/storage/task-attachment-service'
import { getFolders, getDefaultFolder, type DocumentFolder } from '@/lib/services/storage/document-folder-service'
import { DocumentVaultViewToggle, type DocumentVaultViewType } from './DocumentVaultViewToggle'
import { CreateFolderDialog } from './CreateFolderDialog'
import { EditFolderDialog } from './EditFolderDialog'
import { AddLinkDialog } from './AddLinkDialog'
import { DeleteFolderDialog } from './DeleteFolderDialog'
import { FolderTreeView } from './FolderTreeView'
import { FolderTilesView } from './FolderTilesView'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Link as LinkIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { GeneratedTask } from '@/types/task-template-schema'
import { formatDate } from '@/lib/utils/date-utils'

interface DocumentVaultTabProps {
    projectId: string
    companyId: string
    groupId?: string | null
    tasks: GeneratedTask[]
    projectUsers?: any[]
    onUploadSuccess?: () => void
    userRole?: string
    projectCreatedBy?: string
    projectManager?: string | null
}

interface FlattenedDoc {
    id: string
    name: string
    type: string
    size: string
    uploadedAt: string
    uploader: string
    taskId: string
    taskName: string
    url: string
    source: 'attachment' | 'evidence'
    referredUserName?: string
    folderId?: string
    folderName?: string
    uploadSource?: 'task' | 'subtask' | 'manual'
}

export function DocumentVaultTab({
    projectId,
    companyId,
    groupId,
    tasks = [],
    projectUsers = [],
    onUploadSuccess,
    userRole = 'employee',
    projectCreatedBy,
    projectManager
}: DocumentVaultTabProps) {
    const { user: currentUser } = useAuthStore()
    const normalizedRole = userRole?.toLowerCase()

    // Check if current user is the project creator or assigned manager
    const isProjectOwner =
        (!!projectCreatedBy && currentUser?.id === projectCreatedBy) ||
        (!!projectManager && currentUser?.id === projectManager)

    // isAdmin here refers to "can manage folders" - includes platform admins, managers, and project leads
    const isAdmin =
        normalizedRole === 'admin' ||
        normalizedRole === 'owner' ||
        normalizedRole === 'manager' ||
        isProjectOwner

    const canUpload = isAdmin || normalizedRole === 'employee' || normalizedRole === 'rpg' || normalizedRole === 'epc'

    // View state
    const [viewMode, setViewMode] = useState<DocumentVaultViewType>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('documentVaultViewMode')
            if (saved === 'tree' || saved === 'tiles' || saved === 'list') {
                return saved
            }
        }
        return 'list'
    })

    // Folder state
    const [folders, setFolders] = useState<DocumentFolder[]>([])
    const [loadingFolders, setLoadingFolders] = useState(true)
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
    const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false)
    const [isAddLinkDialogOpen, setIsAddLinkDialogOpen] = useState(false)
    const [isEditFolderDialogOpen, setIsEditFolderDialogOpen] = useState(false)
    const [isDeleteFolderDialogOpen, setIsDeleteFolderDialogOpen] = useState(false)
    const [activeFolder, setActiveFolder] = useState<DocumentFolder | null>(null)
    const [parentFolderId, setParentFolderId] = useState<string | null>(null)
    const [parentFolderName, setParentFolderName] = useState<string | null>(null)

    // Search and filter
    const [searchQuery, setSearchQuery] = useState('')
    const [folderFilter, setFolderFilter] = useState<string>('')

    // Upload state
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [deletingDocId, setDeletingDocId] = useState<string | null>(null)

    // Preview state
    const [previewDoc, setPreviewDoc] = useState<FlattenedDoc | null>(null)

    // Load folders
    useEffect(() => {
        const loadFolders = async () => {
            // Don't load if user is not authenticated
            if (!currentUser?.id) {
                setLoadingFolders(false)
                return
            }

            if (!companyId || !projectId) {
                setLoadingFolders(false)
                return
            }

            try {
                setLoadingFolders(true)
                const foldersData = await getFolders(companyId, projectId, groupId ?? undefined)
                setFolders(foldersData)

                // Set default folder as selected if available
                const defaultFolder = foldersData.find(f => f.isDefault)
                if (defaultFolder) {
                    setSelectedFolderId(defaultFolder.id)
                    setFolderFilter(defaultFolder.id)
                }
            } catch (error: any) {
                console.error('Error loading folders:', error)
                // Only show error toast if it's not an auth error (which is expected during initial load)
                if (error?.message && !error.message.includes('authenticated')) {
                    toast.error('Failed to load folders')
                }
            } finally {
                setLoadingFolders(false)
            }
        }

        loadFolders()
    }, [companyId, projectId, groupId, currentUser?.id])

    // Persist view mode
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('documentVaultViewMode', viewMode)
        }
    }, [viewMode])

    const formatBytes = (bytes: number, decimals = 2) => {
        if (!bytes) return '0 Bytes'
        const k = 1024
        const dm = decimals < 0 ? 0 : decimals
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
    }

    const getUserName = (userId: string) => {
        const user = projectUsers.find(u => u.id === userId)
        return user?.name || userId || 'System'
    }

    const documents = useMemo(() => {
        const docs: FlattenedDoc[] = []

        tasks.forEach(task => {
            // Extract from attachments
            if (task.attachments && Array.isArray(task.attachments)) {
                task.attachments.forEach(att => {
                    docs.push({
                        id: att.id,
                        name: att.name,
                        type: att.contentType || 'application/octet-stream',
                        size: formatBytes(att.size),
                        uploadedAt: att.uploadedAt ? formatDate(att.uploadedAt) : 'N/A',
                        uploader: getUserName(att.uploadedBy),
                        taskId: task.id,
                        taskName: task.title,
                        url: att.url,
                        source: 'attachment',
                        referredUserName: att.referredUserId ? getUserName(att.referredUserId) : undefined,
                        folderId: att.folderId,
                        folderName: att.folderName,
                        uploadSource: att.source || 'task'
                    })
                })
            }

            // Extract from DoD evidence
            if (task.definitionOfDone && Array.isArray(task.definitionOfDone)) {
                task.definitionOfDone.forEach(dod => {
                    if (dod.evidence && Array.isArray(dod.evidence)) {
                        dod.evidence.forEach(ev => {
                            if (ev.type === 'file') {
                                // ev.content holds either a full signed URL or a raw storage path.
                                // The /api/storage/download route handles both formats.
                                // 'name' fallback: prefer metadata.name, then derive from path/url while stripping query params.
                                const name = ev.metadata?.name ||
                                    (ev.content.startsWith('http')
                                        ? decodeURIComponent(ev.content.split('/').pop()?.split('?')[0] || 'Unnamed File')
                                        : ev.content.split('/').pop() || 'Unnamed File')

                                docs.push({
                                    id: ev.id,
                                    name: name,
                                    type: ev.metadata?.contentType || 'application/octet-stream',
                                    size: ev.metadata?.size ? formatBytes(ev.metadata.size) : 'N/A',
                                    uploadedAt: ev.uploadedAt ? formatDate(ev.uploadedAt) : 'N/A',
                                    uploader: getUserName(ev.uploadedBy),
                                    taskId: task.id,
                                    taskName: task.title,
                                    url: ev.content,
                                    source: 'evidence',
                                    uploadSource: 'task'
                                })
                            }
                        })
                    }
                })
            }
        })

        return docs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    }, [tasks, projectUsers])

    // Filter documents by search first (global scope)
    const searchFilteredDocuments = useMemo(() => {
        if (!searchQuery.trim()) return documents
        return documents.filter(doc =>
            doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            doc.taskName.toLowerCase().includes(searchQuery.toLowerCase())
        )
    }, [documents, searchQuery])

    // Filter documents by folder for the current view listing
    const filteredDocuments = useMemo(() => {
        if (searchQuery.trim()) {
            // If searching, we show all matches in current folder if one is selected, 
            // otherwise all matches globally
            if (selectedFolderId) {
                return searchFilteredDocuments.filter(doc => doc.folderId === selectedFolderId)
            }
            return searchFilteredDocuments
        }
        // If not searching, strictly filter by current folder level
        return searchFilteredDocuments.filter(doc => (doc.folderId || null) === (selectedFolderId || null))
    }, [searchFilteredDocuments, searchQuery, selectedFolderId])

    const getFileIcon = (type: string) => {
        const t = type.toLowerCase()
        if (t.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />
        if (t.includes('image') || t.includes('png') || t.includes('jpg')) return <ImageIcon className="h-5 w-5 text-blue-500" />
        if (t.includes('excel') || t.includes('spreadsheet') || t.includes('xlsx') || t.includes('csv')) return <FileCode className="h-5 w-5 text-green-500" />
        if (t.includes('link')) return <LinkIcon className="h-5 w-5 text-purple-500" />
        return <File className="h-5 w-5 text-slate-400" />
    }

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !currentUser?.id) {
            return
        }

        // Validate required IDs
        if (!companyId || !projectId) {
            toast.error('Company ID or Project ID is missing')
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
            return
        }

        if (!currentUser?.id) {
            toast.error('User ID is missing. Please log in again.')
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
            return
        }

        // Use first available task for admin uploads
        const firstTask = tasks.length > 0 ? tasks[0] : null
        if (!firstTask) {
            toast.error('No tasks available. Please create a task first.')
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
            return
        }

        try {
            setIsUploading(true)

            // Determine target folder: use selected folder if available
            let targetFolderId: string | undefined = undefined

            if (selectedFolderId) {
                // Verify the selected folder exists
                const selectedFolder = folders.find(f => f.id === selectedFolderId)
                if (selectedFolder) {
                    targetFolderId = selectedFolderId
                }
            }

            // Determine if this is a subtask
            const isSubtask = firstTask.parentTaskId !== undefined

            // Upload to the selected folder (or default if none selected)
            await uploadTaskAttachments([file], {
                taskId: firstTask.id,
                companyId,
                projectId,
                userId: currentUser.id,
                groupId: groupId ?? undefined,
                isSubtask: isSubtask,
                folderId: targetFolderId,
                source: 'manual',
            })

            toast.success('Document uploaded successfully')

            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }

            if (onUploadSuccess) {
                await onUploadSuccess()
            }

            // Reload folders to update counts
            try {
                const foldersData = await getFolders(companyId, projectId, groupId ?? undefined)
                setFolders(foldersData)
            } catch (folderError) {
                console.error('Error reloading folders:', folderError)
                // Non-critical error, don't show to user
            }
        } catch (error: any) {
            console.error('Upload failed:', error)
            const errorMessage = error?.message || 'Failed to upload document'
            toast.error(errorMessage.includes('folder')
                ? 'Failed to create default folder. Please try again.'
                : errorMessage)
        } finally {
            setIsUploading(false)
        }
    }

    const handleUploadClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click()
        }
    }

    const handleAddLink = async (name: string, url: string) => {
        if (!currentUser?.id || !companyId || !projectId) {
            toast.error('Missing required information')
            return
        }

        // Use first available task for admin uploads
        const firstTask = tasks.length > 0 ? tasks[0] : null
        if (!firstTask) {
            toast.error('No tasks available. Please create a task first.')
            return
        }

        try {
            // Determine target folder: use selected folder if available
            let targetFolderId: string | undefined = undefined

            if (selectedFolderId) {
                // Verify the selected folder exists
                const selectedFolder = folders.find(f => f.id === selectedFolderId)
                if (selectedFolder) {
                    targetFolderId = selectedFolderId
                }
            }

            // Determine if this is a subtask
            const isSubtask = firstTask.parentTaskId !== undefined

            await addTaskLink({
                taskId: firstTask.id,
                companyId,
                projectId,
                userId: currentUser.id,
                groupId: groupId ?? undefined,
                url,
                name,
                folderId: targetFolderId,
                isSubtask
            })

            toast.success('Link added successfully')

            if (onUploadSuccess) {
                await onUploadSuccess()
            }

            // Reload folders to update counts
            try {
                const foldersData = await getFolders(companyId, projectId, groupId ?? undefined)
                setFolders(foldersData)
            } catch (folderError) {
                console.error('Error reloading folders:', folderError)
            }
        } catch (error: any) {
            console.error('Add link failed:', error)
            toast.error('Failed to add link')
        }
    }

    const handleDeleteDocument = async (doc: FlattenedDoc) => {
        if (!isAdmin) return

        if (!confirm(`Are you sure you want to delete "${doc.name}"?`)) {
            return
        }

        setDeletingDocId(doc.id)

        try {
            const task = tasks.find(t => t.id === doc.taskId)
            if (!task) {
                throw new Error('Task not found')
            }

            if (doc.source === 'attachment') {
                // PATH A: Regular task attachment (stored in task.attachments[])
                const attachment = task.attachments?.find(att => att.id === doc.id)
                if (!attachment) {
                    throw new Error('Attachment record not found in task')
                }
                // Phase 1 fix: pass groupId
                await deleteTaskAttachment(doc.taskId, companyId, attachment, groupId ?? undefined)

            } else if (doc.source === 'evidence') {
                // PATH B: DoD evidence file (stored in task.definitionOfDone[].evidence[])
                // Phase 2 fix: use dedicated evidence deletion function
                await deleteTaskEvidence(doc.taskId, companyId, doc.id, groupId ?? undefined)
            }

            toast.success('Document deleted successfully')

            if (onUploadSuccess) {
                await onUploadSuccess()
            }

            // Reload folders to update counts
            try {
                const foldersData = await getFolders(companyId, projectId, groupId ?? undefined)
                setFolders(foldersData)
            } catch (folderError) {
                console.error('Error reloading folders after delete:', folderError)
            }
        } catch (error) {
            console.error('Delete failed:', error)
            toast.error('Failed to delete document')
        } finally {
            setDeletingDocId(null)
        }
    }

    const handleFolderCreated = async () => {
        const foldersData = await getFolders(companyId, projectId, groupId ?? undefined)
        setFolders(foldersData)
        setParentFolderId(null)
        setParentFolderName(null)
    }

    const handleFolderEdit = (folder: DocumentFolder) => {
        setActiveFolder(folder)
        setIsEditFolderDialogOpen(true)
    }

    const handleFolderDelete = (folder: DocumentFolder) => {
        setActiveFolder(folder)
        setIsDeleteFolderDialogOpen(true)
    }

    const handleAddSubFolder = (folder: DocumentFolder) => {
        setParentFolderId(folder.id)
        setParentFolderName(folder.name)
        setIsCreateFolderDialogOpen(true)
    }

    const handleMainCreateFolderClick = () => {
        if (selectedFolderId) {
            const currentFolder = folders.find(f => f.id === selectedFolderId)
            if (currentFolder) {
                setParentFolderId(currentFolder.id)
                setParentFolderName(currentFolder.name)
            }
        } else {
            setParentFolderId(null)
            setParentFolderName(null)
        }
        setIsCreateFolderDialogOpen(true)
    }

    const handleDocumentClick = (doc: FlattenedDoc) => {
        setPreviewDoc(doc)
    }

    const handleDocumentDownload = async (doc: FlattenedDoc) => {
        try {
            // 1. Get current user's auth token
            const currentUser = auth.currentUser
            if (!currentUser) {
                toast.error('You must be logged in to download files')
                return
            }
            const token = await currentUser.getIdToken()

            // 2. Call the server-side download proxy route
            const params = new URLSearchParams({
                path: doc.url,        // storage path or signed URL
                filename: doc.name,   // desired download filename
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

            // 3. Trigger native browser download
            const blob = await response.blob()
            const downloadUrl = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = downloadUrl
            link.setAttribute('download', doc.name)
            document.body.appendChild(link)
            link.click()
            link.parentNode?.removeChild(link)
            window.URL.revokeObjectURL(downloadUrl)

        } catch (error: any) {
            console.error('Download failed:', error)
            toast.error(error?.message || 'Failed to download document. Please try again.')
        }
    }

    // Render list/table view
    const renderListView = () => {
        const subFolders = folders.filter(f => (f.parentFolderId || null) === (selectedFolderId || null))

        return (
            <div className="flex-1 flex flex-col bg-white overflow-hidden">
                <ScrollArea className="flex-1">
                    <div className="min-w-[900px]">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-muted/50 text-xs font-semibold tracking-tight text-foreground sticky top-0 z-10 border-b">
                                <tr>
                                    <th className="px-6 py-4">Name</th>
                                    <th className="px-4 py-4">Details / Source</th>
                                    <th className="px-4 py-4 text-center">Size / Count</th>
                                    <th className="px-4 py-4">Uploader / System</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {/* Sub-folders */}
                                {subFolders.map((folder) => (
                                    <tr
                                        key={folder.id}
                                        className="group hover:bg-primary/[0.02] transition-all cursor-pointer"
                                        onClick={() => {
                                            setSelectedFolderId(folder.id)
                                        }}
                                    >
                                        <td className="px-6 py-3">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center group-hover:bg-primary/10 transition-all">
                                                    <Folder className="h-5 w-5 text-primary fill-current opacity-70" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold tracking-tight text-foreground leading-tight group-hover:text-primary transition-colors truncate max-w-[250px]" title={folder.name}>
                                                        {folder.name}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider font-semibold">
                                                        Folder
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-[10px] text-slate-400 font-medium italic">
                                                Directory location
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Badge variant="secondary" className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 border-none">
                                                {documents.filter(d => d.folderId === folder.id).length} Files
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 border border-slate-200 uppercase">
                                                    S
                                                </div>
                                                <span className="text-xs text-slate-600 font-medium">System Folder</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {isAdmin && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-full text-slate-400 hover:text-primary hover:bg-primary/5"
                                                        onClick={(e) => { e.stopPropagation(); handleAddSubFolder(folder) }}
                                                        title="Add Sub-folder"
                                                    >
                                                        <FolderPlus className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                {isAdmin && !folder.isDefault && (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 rounded-full text-slate-400 hover:text-primary hover:bg-primary/5"
                                                            onClick={(e) => { e.stopPropagation(); handleFolderEdit(folder) }}
                                                            title="Rename Folder"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                            onClick={(e) => { e.stopPropagation(); handleFolderDelete(folder) }}
                                                            title="Delete Folder"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}

                                {/* Documents */}
                                {filteredDocuments.map((doc) => (
                                    <tr key={doc.id} className="group hover:bg-slate-50/50 transition-all">
                                        <td className="px-6 py-4" onClick={() => handleDocumentClick(doc)}>
                                            <div className="flex items-center gap-4 cursor-pointer">
                                                <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all">
                                                    {getFileIcon(doc.type)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold tracking-tight text-foreground leading-tight group-hover:text-primary transition-colors truncate max-w-[200px]" title={doc.name}>
                                                        {doc.name}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {doc.uploadedAt} • {doc.type.split('/').pop()?.toUpperCase()}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex flex-col gap-1">
                                                {doc.uploadSource !== 'manual' && (
                                                    <p className="text-xs font-semibold tracking-tight text-foreground truncate max-w-[250px]" title={doc.taskName}>
                                                        {doc.taskName}
                                                    </p>
                                                )}
                                                <Badge variant="outline" className="w-fit text-xs px-1 py-0 h-4 font-normal text-slate-400 border-slate-200">
                                                    {doc.source === 'evidence' ? 'DoD Evidence' : 'Attachment'}
                                                </Badge>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                                {doc.size}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                                    {doc.uploader.charAt(0).toUpperCase()}
                                                </div>
                                                <p className="text-xs font-medium text-muted-foreground truncate max-w-[100px]">{doc.uploader}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-full"
                                                    onClick={() => {
                                                        if (doc.type === 'application/link') {
                                                            window.open(doc.url, '_blank')
                                                        } else {
                                                            setPreviewDoc(doc)
                                                        }
                                                    }}
                                                    title={doc.type === 'application/link' ? "Open Link" : "Preview Document"}
                                                >
                                                    {doc.type === 'application/link' ? (
                                                        <LinkIcon className="h-4 w-4" />
                                                    ) : (
                                                        <Eye className="h-4 w-4" />
                                                    )}
                                                </Button>
                                                {doc.type !== 'application/link' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-full"
                                                        onClick={() => handleDocumentDownload(doc)}
                                                        title="Download Document"
                                                    >
                                                        <Download className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                {isAdmin && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                                                        onClick={() => handleDeleteDocument(doc)}
                                                        disabled={deletingDocId === doc.id}
                                                        title="Delete Document"
                                                    >
                                                        {deletingDocId === doc.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {subFolders.length === 0 && filteredDocuments.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="py-24 text-center">
                                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-slate-200">
                                                <FolderOpen className="h-8 w-8 text-slate-300" />
                                            </div>
                                            <p className="text-slate-600 font-semibold">No documents found.</p>
                                            <p className="text-xs text-slate-400 mt-1">Upload documents to tasks to see them here.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </ScrollArea >
            </div >
        )
    }

    return (
        <div className="flex flex-col h-[600px] border rounded-xl bg-white overflow-hidden shadow-sm">
            <div className="px-6 py-4 flex flex-col gap-1 border-b">
                <h3 className="text-xl font-semibold tracking-tight text-foreground">Document vault</h3>
                <p className="text-sm text-muted-foreground">Manage and view all project related documents.</p>
            </div>

            {/* Top Toolbar */}
            <div className="flex items-center justify-between p-4 bg-white border-b gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search documents or tasks..."
                        className="pl-9 bg-slate-50 border-none focus-visible:ring-primary/20"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <DocumentVaultViewToggle
                        currentView={viewMode}
                        onViewChange={setViewMode}
                    />
                    {viewMode === 'list' && (
                        <Select
                            value={selectedFolderId || ''}
                            onValueChange={(val) => {
                                setSelectedFolderId(val)
                            }}
                        >
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="All folders" />
                            </SelectTrigger>
                            <SelectContent>
                                {folders.filter(f => !f.parentFolderId).map(folder => (
                                    <SelectItem key={folder.id} value={folder.id}>
                                        {folder.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    {isAdmin && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="flex items-center gap-2"
                            onClick={handleMainCreateFolderClick}
                        >
                            <FolderPlus className="h-4 w-4" /> Create Folder
                        </Button>
                    )}
                    <Badge variant="secondary" className="font-medium mr-2">
                        {filteredDocuments.length} Documents
                    </Badge>
                    {canUpload && (
                        <>
                            <input
                                ref={fileInputRef}
                                type="file"
                                onChange={handleFileSelect}
                                className="hidden"
                                accept="*/*"
                                disabled={isUploading}
                            />
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        size="sm"
                                        className="bg-primary hover:bg-primary/90 flex items-center gap-2 px-4 shadow-sm"
                                        disabled={isUploading}
                                    >
                                        {isUploading ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="h-4 w-4" /> Upload
                                            </>
                                        )}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={handleUploadClick}>
                                        <Upload className="mr-2 h-4 w-4" /> Upload File
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setIsAddLinkDialogOpen(true)}>
                                        <LinkIcon className="mr-2 h-4 w-4" /> Add Link
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </>
                    )}
                </div>
            </div>

            <AddLinkDialog
                open={isAddLinkDialogOpen}
                onOpenChange={setIsAddLinkDialogOpen}
                onAddLink={handleAddLink}
            />

            {/* Breadcrumb Navigation for List/Tiles */}
            {viewMode !== 'tree' && selectedFolderId && (
                <div className="px-6 py-3 border-b bg-white flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-slate-400 hover:text-primary hover:bg-primary/5"
                        onClick={() => {
                            const parentId = folders.find(f => f.id === selectedFolderId)?.parentFolderId || null
                            setSelectedFolderId(parentId)
                        }}
                        title="Go back"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-2 text-sm">
                        <button
                            onClick={() => setSelectedFolderId(null)}
                            className="text-slate-400 hover:text-primary transition-colors font-medium"
                        >
                            Files
                        </button>
                        {(() => {
                            const path: DocumentFolder[] = []
                            let curr: DocumentFolder | undefined = folders.find(f => f.id === selectedFolderId)
                            while (curr) {
                                path.unshift(curr)
                                const parentId: string | null | undefined = curr.parentFolderId
                                curr = parentId ? folders.find(f => f.id === parentId) : undefined
                            }
                            return path.map((crumb, idx) => (
                                <div key={crumb.id} className="flex items-center gap-2">
                                    <ChevronRight className="h-4 w-4 text-slate-300" />
                                    <button
                                        onClick={() => setSelectedFolderId(crumb.id)}
                                        disabled={idx === path.length - 1}
                                        className={cn(
                                            "font-semibold transition-colors",
                                            idx === path.length - 1 ? "text-slate-900" : "text-slate-400 hover:text-primary"
                                        )}
                                    >
                                        {crumb.name}
                                    </button>
                                </div>
                            ))
                        })()}
                    </div>
                </div>
            )}

            {/* View Container */}
            <div className={`flex-1 flex flex-col bg-white overflow-hidden ${viewMode !== 'tree' ? 'bg-slate-50/30' : ''}`}>
                {loadingFolders ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : viewMode === 'tree' ? (
                    <FolderTreeView
                        folders={folders}
                        documents={searchFilteredDocuments}
                        selectedFolderId={selectedFolderId}
                        onFolderSelect={setSelectedFolderId}
                        onDocumentClick={handleDocumentClick}
                        onDocumentDownload={handleDocumentDownload}
                        onDocumentDelete={isAdmin ? handleDeleteDocument : undefined}
                        onFolderEdit={isAdmin ? handleFolderEdit : undefined}
                        onFolderDelete={isAdmin ? handleFolderDelete : undefined}
                        onAddSubFolder={isAdmin ? handleAddSubFolder : undefined}
                        getFileIcon={getFileIcon}
                        isAdmin={isAdmin}
                    />
                ) : viewMode === 'tiles' ? (
                    <FolderTilesView
                        folders={folders}
                        documents={searchFilteredDocuments}
                        currentFolderId={selectedFolderId}
                        onFolderClick={setSelectedFolderId}
                        onDocumentClick={handleDocumentClick}
                        onDocumentDownload={handleDocumentDownload}
                        onDocumentDelete={isAdmin ? handleDeleteDocument : undefined}
                        onFolderEdit={isAdmin ? handleFolderEdit : undefined}
                        onFolderDelete={isAdmin ? handleFolderDelete : undefined}
                        getFileIcon={getFileIcon}
                        isAdmin={isAdmin}
                    />
                ) : (
                    renderListView()
                )}
            </div>

            {/* Create Folder Dialog */}
            {isAdmin && currentUser && (
                <CreateFolderDialog
                    open={isCreateFolderDialogOpen}
                    onOpenChange={(open) => {
                        setIsCreateFolderDialogOpen(open);
                        if (!open) { setParentFolderId(null); setParentFolderName(null); }
                    }}
                    companyId={companyId}
                    projectId={projectId}
                    userId={currentUser.id}
                    groupId={groupId}
                    onFolderCreated={handleFolderCreated}
                    parentFolderId={parentFolderId}
                    parentFolderName={parentFolderName}
                />
            )}

            {isAdmin && currentUser && (
                <EditFolderDialog
                    open={isEditFolderDialogOpen}
                    onOpenChange={setIsEditFolderDialogOpen}
                    companyId={companyId}
                    projectId={projectId}
                    groupId={groupId}
                    folder={activeFolder}
                    onFolderUpdated={handleFolderCreated}
                />
            )}

            {isAdmin && currentUser && (
                <DeleteFolderDialog
                    open={isDeleteFolderDialogOpen}
                    onOpenChange={setIsDeleteFolderDialogOpen}
                    companyId={companyId}
                    projectId={projectId}
                    groupId={groupId}
                    folder={activeFolder}
                    allFolders={folders}
                    documents={documents}
                    defaultFolderId={folders.find(f => f.isDefault)?.id || ''}
                    onFolderDeleted={handleFolderCreated}
                />
            )}


            {/* Document Preview Dialog */}
            <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
                <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
                    <DialogHeader className="px-6 py-4 border-b flex-shrink-0 bg-white z-10 rounded-t-lg">
                        <div className="flex items-center justify-between w-full">
                            <DialogTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
                                {previewDoc && getFileIcon(previewDoc.type)}
                                <span className="truncate max-w-[600px]">{previewDoc?.name}</span>
                            </DialogTitle>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-foreground rounded-full"
                                onClick={() => setPreviewDoc(null)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </DialogHeader>
                    <div className="flex-1 bg-slate-100 relative overflow-hidden flex items-center justify-center p-4">
                        {previewDoc && (
                            <>
                                {previewDoc.type.includes('image') ? (
                                    /* eslint-disable-next-line -- img used for dynamic document thumbnails */
                                    <img
                                        src={previewDoc.url}
                                        alt={previewDoc.name}
                                        className="max-w-full max-h-full object-contain shadow-lg rounded-md"
                                    />
                                ) : previewDoc.type.includes('pdf') ? (
                                    <iframe
                                        src={previewDoc.url}
                                        className="w-full h-full rounded-md shadow-sm bg-white"
                                        title={previewDoc.name}
                                    />
                                ) : (previewDoc.type.includes('word') ||
                                    previewDoc.type.includes('document') ||
                                    previewDoc.name.endsWith('.docx') ||
                                    previewDoc.name.endsWith('.doc') ||
                                    previewDoc.type.includes('sheet') ||
                                    previewDoc.type.includes('excel') ||
                                    previewDoc.name.endsWith('.xlsx') ||
                                    previewDoc.name.endsWith('.xls') ||
                                    previewDoc.name.endsWith('.csv') ||
                                    previewDoc.type.includes('presentation') ||
                                    previewDoc.name.endsWith('.pptx')) ? (
                                    <iframe
                                        src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewDoc.url)}&embedded=true`}
                                        className="w-full h-full rounded-md shadow-sm bg-white"
                                        title={previewDoc.name}
                                    />
                                ) : (
                                    <div className="text-center p-12 bg-white rounded-xl shadow-sm border max-w-md">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <File className="h-8 w-8 text-slate-300" />
                                        </div>
                                        <h3 className="font-semibold text-lg mb-2">Preview not available</h3>
                                        <p className="text-sm text-muted-foreground mb-6">
                                            This file type cannot be previewed directly in the browser.
                                        </p>
                                        <Button asChild>
                                            <a href={previewDoc.url} download={previewDoc.name} className="gap-2">
                                                <Download className="h-4 w-4" /> Download File
                                            </a>
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
