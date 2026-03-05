'use client'

import { useState, useEffect } from 'react'
import { Folder, FolderOpen, File, ChevronRight, ChevronDown, Download, Eye, Trash2, Plus, Pencil } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
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

interface FolderTreeViewProps {
  folders: DocumentFolder[]
  documents: FlattenedDoc[]
  selectedFolderId: string | null
  onFolderSelect: (folderId: string | null) => void
  onDocumentClick: (doc: FlattenedDoc) => void
  onDocumentDownload: (doc: FlattenedDoc) => void
  onDocumentDelete?: (doc: FlattenedDoc) => void
  onFolderEdit?: (folder: DocumentFolder) => void
  onFolderDelete?: (folder: DocumentFolder) => void
  onAddSubFolder?: (folder: DocumentFolder) => void
  getFileIcon: (type: string) => React.ReactNode
  isAdmin: boolean
}

export function FolderTreeView({
  folders,
  documents,
  selectedFolderId,
  onFolderSelect,
  onDocumentClick,
  onDocumentDownload,
  onDocumentDelete,
  onFolderEdit,
  onFolderDelete,
  onAddSubFolder,
  getFileIcon,
  isAdmin
}: FolderTreeViewProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  // Auto-expand selected folder
  useEffect(() => {
    if (selectedFolderId) {
      setExpandedFolders(prev => new Set([...prev, selectedFolderId]))
    }
  }, [selectedFolderId])

  const toggleFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }

  // Get documents for selected folder (or root if selectedFolderId is null)
  const filteredDocuments = documents.filter(doc => (doc.folderId || null) === (selectedFolderId || null))

  const renderFolderItems = (parentId: string | null = null, level = 0) => {
    const levelFolders = folders.filter(f => (f.parentFolderId || null) === parentId)

    // Sort default first at top level
    const sortedFolders = parentId === null
      ? [...levelFolders].sort((a, b) => (a.isDefault ? -1 : b.isDefault ? 1 : a.name.localeCompare(b.name)))
      : [...levelFolders].sort((a, b) => a.name.localeCompare(b.name))

    return sortedFolders.map(folder => {
      const isExpanded = expandedFolders.has(folder.id)
      const hasChildren = folders.some(f => f.parentFolderId === folder.id)
      const docCount = documents.filter(d => d.folderId === folder.id).length

      return (
        <div key={folder.id}>
          <div
            onClick={() => onFolderSelect(folder.id)}
            className={cn(
              'group flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors cursor-pointer',
              selectedFolderId === folder.id
                ? 'bg-primary/10 text-primary font-medium'
                : 'hover:bg-slate-100 text-slate-700'
            )}
            style={{ paddingLeft: `${(level * 16) + 8}px` }}
          >
            <div
              className="w-4 h-4 flex items-center justify-center -ml-1 mr-0.5"
              onClick={(e) => hasChildren && toggleFolder(folder.id, e)}
            >
              {hasChildren && (
                isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
              )}
            </div>
            {isExpanded ? (
              <FolderOpen className={cn("h-4 w-4", selectedFolderId === folder.id ? "text-primary" : "text-slate-400")} />
            ) : (
              <Folder className={cn("h-4 w-4", selectedFolderId === folder.id ? "text-primary" : "text-slate-400")} />
            )}
            <span className="flex-1 truncate">{folder.name}</span>
            <span className="text-[10px] opacity-70 bg-slate-200/50 px-1.5 py-0.5 rounded-full">
              {docCount}
            </span>

            {/* Admin Actions */}
            {isAdmin && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                <button
                  onClick={(e) => { e.stopPropagation(); onAddSubFolder?.(folder) }}
                  className="p-1 hover:bg-white rounded text-slate-400 hover:text-primary transition-colors"
                  title="Add Sub-folder"
                >
                  <Plus className="h-3 w-3" />
                </button>
                {!folder.isDefault && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); onFolderEdit?.(folder) }}
                      className="p-1 hover:bg-white rounded text-slate-400 hover:text-primary transition-colors"
                      title="Rename Folder"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onFolderDelete?.(folder) }}
                      className="p-1 hover:bg-white rounded text-slate-400 hover:text-red-600 transition-colors"
                      title="Delete Folder"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          {isExpanded && renderFolderItems(folder.id, level + 1)}
        </div>
      )
    })
  }

  return (
    <div className="flex h-full">
      {/* Folder Sidebar */}
      <div className="w-72 border-r bg-slate-50 flex flex-col">
        <div className="p-3 border-b flex items-center justify-between">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            File Directory
          </h4>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            <div
              onClick={() => onFolderSelect(null)}
              className={cn(
                'group flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors cursor-pointer',
                selectedFolderId === null
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'hover:bg-slate-100 text-slate-700'
              )}
            >
              <FolderOpen className={cn("h-4 w-4", selectedFolderId === null ? "text-primary" : "text-slate-400")} />
              <span className="flex-1 truncate">Files</span>
              <span className="text-[10px] opacity-70 bg-slate-200/50 px-1.5 py-0.5 rounded-full">
                {documents.filter(d => !d.folderId).length}
              </span>
            </div>
            <div className="my-2 border-t border-slate-200/50" />
            {renderFolderItems(null)}
          </div>
        </ScrollArea>
      </div>

      {/* Document List */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        <div className="p-4 border-b flex items-center justify-between bg-white/50 backdrop-blur-sm sticky top-0 z-10">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {selectedFolderId === null ? 'Files (Root)' : folders.find(f => f.id === selectedFolderId)?.name || 'Select a folder'}
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">
              {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''} in this location
            </p>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {filteredDocuments.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed text-slate-300">
                  <File className="h-8 w-8" />
                </div>
                <p className="text-slate-500 font-medium">No documents in this folder</p>
              </div>
            ) : (
              filteredDocuments.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-primary/20 hover:bg-primary/[0.02] transition-all cursor-pointer group"
                  onClick={() => onDocumentClick(doc)}
                >
                  <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:bg-white transition-colors">
                    {getFileIcon(doc.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{doc.name}</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                      {doc.uploadSource !== 'manual' && `${doc.taskName} • `}{doc.uploadedAt} • {doc.size}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); onDocumentClick(doc) }}
                      className="p-1.5 hover:bg-white rounded-md text-slate-400 hover:text-primary transition-colors border border-transparent hover:border-slate-100"
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDocumentDownload(doc) }}
                      className="p-1.5 hover:bg-white rounded-md text-slate-400 hover:text-primary transition-colors border border-transparent hover:border-slate-100"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    {isAdmin && onDocumentDelete && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDocumentDelete(doc) }}
                        className="p-1.5 hover:bg-red-50 rounded-md text-slate-400 hover:text-red-500 transition-colors border border-transparent hover:border-red-100"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

