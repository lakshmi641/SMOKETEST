'use client'

import { Folder, FolderOpen, File, ChevronRight, ChevronLeft, Eye, Download, Trash2, Pencil } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { DocumentFolder } from '@/lib/services/storage/document-folder-service'

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

interface FolderTilesViewProps {
  folders: DocumentFolder[]
  documents: FlattenedDoc[]
  currentFolderId: string | null
  onFolderClick: (folderId: string | null) => void
  onDocumentClick: (doc: FlattenedDoc) => void
  onDocumentDownload: (doc: FlattenedDoc) => void
  onDocumentDelete?: (doc: FlattenedDoc) => void
  onFolderEdit?: (folder: DocumentFolder) => void
  onFolderDelete?: (folder: DocumentFolder) => void
  getFileIcon: (type: string) => React.ReactNode
  isAdmin: boolean
}

export function FolderTilesView({
  folders,
  documents,
  currentFolderId,
  onFolderClick,
  onDocumentClick,
  onDocumentDownload,
  onDocumentDelete,
  onFolderEdit,
  onFolderDelete,
  getFileIcon,
  isAdmin
}: FolderTilesViewProps) {
  // Get current folder
  const currentFolder = currentFolderId
    ? folders.find(f => f.id === currentFolderId)
    : null

  // Get items for current level
  // If no folder selected, show top-level folders (parentFolderId is null or undefined)
  // If folder selected, show sub-folders (parentFolderId === currentFolderId) AND documents
  const levelFolders = folders.filter(f => (f.parentFolderId || null) === (currentFolderId || null))
  const levelDocuments = documents.filter(doc => (doc.folderId || null) === (currentFolderId || null))

  const hasItems = levelFolders.length > 0 || levelDocuments.length > 0

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <ScrollArea className="flex-1">
        <div className="p-6">
          {!hasItems ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
              <Folder className="h-16 w-16 text-slate-200 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900">This folder is empty</h3>
              <p className="text-slate-500 text-sm mt-1 max-w-xs mx-auto">
                There are no folders or documents here yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* Folders first in the mixed grid */}
              {levelFolders.map(folder => {
                const subDocs = documents.filter(d => d.folderId === folder.id).length
                const subFolders = folders.filter(f => f.parentFolderId === folder.id).length
                return (
                  <div
                    key={folder.id}
                    className="group relative flex flex-col p-5 bg-white border border-slate-200 rounded-2xl hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all cursor-pointer min-h-[160px]"
                    onClick={() => onFolderClick(folder.id)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <Folder className="h-6 w-6 fill-current opacity-80" />
                      </div>
                      {isAdmin && !folder.isDefault && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); onFolderEdit?.(folder) }}
                            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-primary transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onFolderDelete?.(folder) }}
                            className="p-2 hover:bg-red-50 rounded-full text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="mt-auto">
                      <p className="text-sm font-bold text-slate-900 truncate mb-1" title={folder.name}>
                        {folder.name}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                        <span className="flex items-center gap-1">
                          {subDocs} file{subDocs !== 1 ? 's' : ''}
                        </span>
                        {subFolders > 0 && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                            <span>{subFolders} sub-folders</span>
                          </>
                        )}
                      </div>
                    </div>
                    {folder.isDefault && (
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-slate-100 text-slate-500 border-none font-bold uppercase tracking-tighter">
                          System
                        </Badge>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Documents side-by-side with folders */}
              {levelDocuments.map(doc => (
                <div
                  key={doc.id}
                  className="flex flex-col p-4 bg-white border border-slate-200 rounded-2xl hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all cursor-pointer group min-h-[160px]"
                >
                  <div
                    className="flex items-start gap-4 flex-1 mb-4"
                    onClick={() => onDocumentClick(doc)}
                  >
                    <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:bg-primary/[0.03] transition-colors">
                      {getFileIcon(doc.type)}
                    </div>
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-bold text-slate-900 truncate mb-1" title={doc.name}>
                        {doc.name}
                      </p>
                      {doc.uploadSource !== 'manual' && (
                        <p className="text-[10px] text-slate-500 font-medium line-clamp-1 mb-1" title={doc.taskName}>
                          {doc.taskName}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                        {doc.size}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1 mt-auto pt-3 border-t border-slate-100 -mx-1 -mb-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); onDocumentClick(doc) }}
                      className="p-2 hover:bg-primary/5 rounded-full text-slate-400 hover:text-primary transition-colors"
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDocumentDownload(doc) }}
                      className="p-2 hover:bg-primary/5 rounded-full text-slate-400 hover:text-primary transition-colors"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    {isAdmin && onDocumentDelete && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDocumentDelete(doc) }}
                        className="p-2 hover:bg-red-50 rounded-full text-slate-400 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
