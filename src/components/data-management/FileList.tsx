'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/utils/date-utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RefreshCw, ExternalLink, Eye, Loader2, ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react'

interface FileWithStatus {
  name: string
  path: string
  size: number
  contentType: string
  created: string
  updated: string
  bucket: string
  fullPath: string
  processingStatus: {
    status: 'success' | 'fail' | 'in_progress' | 'skipped_duplicate'
    lastProcessed: string | null
    lastSuccess: string | null
    lastFailure: string | null
    sourceRowCount: number | null
    targetRowCount: number | null
    lastError: string | null
  } | null
}

interface FileGroup {
  id: string
  name: string
  path: string
  type: 'batch' | 'folder' | 'file'
  files: FileWithStatus[]
  subGroups?: FileGroup[]
  created?: string
  totalSize?: number
  statusSummary?: {
    success: number
    failed: number
    inProgress: number
    total: number
  }
}

interface FileListProps {
  onFileSelect?: (file: FileWithStatus) => void
  refreshInterval?: number
}

export function FileList({ onFileSelect, refreshInterval = 30000 }: FileListProps) {
  const [files, setFiles] = useState<FileWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAuthError, setIsAuthError] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [bucketName, setBucketName] = useState<string>('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const fetchFiles = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/pipeline/files')
      const result = await response.json()

      if (result.success) {
        console.log('[FileList] Received files:', result.data?.length || 0)
        setFiles(result.data || [])
        setBucketName(result.bucket || '')
        // Show warning if present (e.g., GCP connection issues)
        if (result.warning) {
          setError(result.warning)
          setIsAuthError(result.isAuthError || false)
        } else {
          setError(null)
          setIsAuthError(false)
        }
      } else {
        setError(result.error || 'Failed to fetch files')
        setIsAuthError(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch files')
      setIsAuthError(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFiles()
    const interval = setInterval(fetchFiles, refreshInterval)
    return () => clearInterval(interval)
  }, [refreshInterval])

  // Extract batch ID from path (e.g., raw/batches/2025/11/20251109_143000/...)
  const extractBatchId = (path: string): string | null => {
    const batchMatch = path.match(/raw\/batches\/(\d{4})\/(\d{2})\/(\d{8}_\d{6})/)
    if (batchMatch) {
      return `${batchMatch[1]}/${batchMatch[2]}/${batchMatch[3]}`
    }
    return null
  }

  // Extract folder structure from path
  const extractFolderPath = (path: string): string[] => {
    // Remove 'raw/' prefix and split by '/'
    const parts = path.replace(/^raw\//, '').split('/')
    // Remove filename (last part)
    return parts.slice(0, -1)
  }

  // Group files by batch and folder structure
  const groupedFiles = useMemo(() => {
    console.log('[FileList] Grouping files:', files.length, 'files, filter:', statusFilter, 'search:', searchQuery)

    const filtered = files.filter((file) => {
      const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.path.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus =
        statusFilter === 'all' ||
        file.processingStatus?.status === statusFilter ||
        (!file.processingStatus && (statusFilter === 'unknown' || statusFilter === 'not_processed'))

      return matchesSearch && matchesStatus
    })

    console.log('[FileList] Filtered files:', filtered.length)

    // Group by batch first
    const batchGroups = new Map<string, FileWithStatus[]>()
    const nonBatchFiles: FileWithStatus[] = []

    filtered.forEach((file) => {
      const batchId = extractBatchId(file.path)
      if (batchId) {
        if (!batchGroups.has(batchId)) {
          batchGroups.set(batchId, [])
        }
        batchGroups.get(batchId)!.push(file)
      } else {
        nonBatchFiles.push(file)
      }
    })

    const groups: FileGroup[] = []

    // Create batch groups
    batchGroups.forEach((batchFiles, batchId) => {
      const batchPath = `raw/batches/${batchId}`
      const parts = batchId.split('/')
      const batchTimestamp = parts[2] // YYYYMMDD_HHMMSS

      // Skip if batchTimestamp is missing or invalid
      if (!batchTimestamp || batchTimestamp.length < 15) {
        // Fallback: create a group with batchId as name
        groups.push({
          id: batchId,
          name: `Batch: ${batchId}`,
          path: batchPath,
          type: 'batch',
          files: batchFiles,
          totalSize: batchFiles.reduce((sum, f) => sum + f.size, 0),
          statusSummary: {
            success: batchFiles.filter(f => f.processingStatus?.status === 'success').length,
            failed: batchFiles.filter(f => f.processingStatus?.status === 'fail').length,
            inProgress: batchFiles.filter(f => f.processingStatus?.status === 'in_progress').length,
            total: batchFiles.length,
          },
        })
        return
      }

      // Parse timestamp to readable date
      const year = batchTimestamp.substring(0, 4)
      const month = batchTimestamp.substring(4, 6)
      const day = batchTimestamp.substring(6, 8)
      const hour = batchTimestamp.substring(9, 11)
      const minute = batchTimestamp.substring(11, 13)
      const second = batchTimestamp.substring(13, 15)
      const batchDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`)

      // Group files within batch by folder
      const folderGroups = new Map<string, FileWithStatus[]>()
      const rootFiles: FileWithStatus[] = []

      batchFiles.forEach((file) => {
        const folderPath = extractFolderPath(file.path)
        // Remove 'batches/YYYY/MM/YYYYMMDD_HHMMSS' prefix (3 parts)
        const remainingPath = folderPath.slice(3)

        if (remainingPath.length === 0) {
          // File is directly in batch folder
          rootFiles.push(file)
        } else {
          // File is in a subfolder
          const folderKey = remainingPath.join('/')
          if (!folderGroups.has(folderKey)) {
            folderGroups.set(folderKey, [])
          }
          folderGroups.get(folderKey)!.push(file)
        }
      })

      // Calculate status summary
      const statusSummary = {
        success: batchFiles.filter(f => f.processingStatus?.status === 'success').length,
        failed: batchFiles.filter(f => f.processingStatus?.status === 'fail').length,
        inProgress: batchFiles.filter(f => f.processingStatus?.status === 'in_progress').length,
        total: batchFiles.length,
      }

      const totalSize = batchFiles.reduce((sum, f) => sum + f.size, 0)

      // Create sub-groups for folders within batch
      const subGroups: FileGroup[] = []

      // Add root files as a group if they exist
      if (rootFiles.length > 0) {
        subGroups.push({
          id: `${batchId}/root`,
          name: 'Root',
          path: batchPath,
          type: 'folder',
          files: rootFiles,
        })
      }

      // Add subfolder groups
      folderGroups.forEach((folderFiles, folderKey) => {
        subGroups.push({
          id: `${batchId}/${folderKey}`,
          name: folderKey.split('/').pop() || folderKey,
          path: `${batchPath}/${folderKey}`,
          type: 'folder',
          files: folderFiles,
        })
      })

      groups.push({
        id: batchId,
        name: `Batch: ${formatDate(batchDate)}`,
        path: batchPath,
        type: 'batch',
        files: batchFiles,
        subGroups: subGroups.length > 0 ? subGroups : undefined,
        created: batchDate.toISOString(),
        totalSize,
        statusSummary,
      })
    })

    // Group non-batch files by folder structure
    // Separate sales files from master data files
    // Handle files from raw/, processed/, and failed/ folders
    const salesFiles: FileWithStatus[] = []
    const masterDataFiles: FileWithStatus[] = []
    const otherFiles: FileWithStatus[] = []

    nonBatchFiles.forEach((file) => {
      // Check for sales files in any location (raw/, processed/, failed/)
      if (file.path.includes('/sales/')) {
        salesFiles.push(file)
      } else if (file.path.includes('/master-data/')) {
        masterDataFiles.push(file)
      } else {
        otherFiles.push(file)
      }
    })

    // Group sales files by location (raw/processed/failed) and year/month
    const salesGroups = new Map<string, FileWithStatus[]>()
    salesFiles.forEach((file) => {
      // Extract location and year/month from path: {raw|processed|failed}/sales/YYYY/MM/filename
      const match = file.path.match(/(raw|processed|failed)\/sales\/(\d{4})\/(\d{2})\//)
      if (match && match[1] && match[2] && match[3]) {
        const location = match[1] // raw, processed, or failed
        const year = match[2]
        const month = match[3]
        const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('en-US', { month: 'long' })
        const key = `${location}/${year}/${month}`
        if (!salesGroups.has(key)) {
          salesGroups.set(key, [])
        }
        salesGroups.get(key)!.push(file)
      } else {
        // Sales file not in expected structure
        const location = file.path.startsWith('processed/') ? 'processed' :
          file.path.startsWith('failed/') ? 'failed' : 'raw'
        const key = `${location}/other`
        if (!salesGroups.has(key)) {
          salesGroups.set(key, [])
        }
        salesGroups.get(key)!.push(file)
      }
    })

    salesGroups.forEach((folderFiles, key) => {
      const [location, ...rest] = key.split('/')
      if (!location) return

      const locationLabel = location === 'processed' ? 'Processed' :
        location === 'failed' ? 'Failed' : 'Raw'

      if (rest[0] === 'other') {
        groups.push({
          id: `sales-${location}-other`,
          name: `Sales (${locationLabel} - Other)`,
          path: `${location}/sales/`,
          type: 'folder',
          files: folderFiles,
        })
      } else {
        const [year, month] = rest
        if (year && month) {
          const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('en-US', { month: 'long' })
          groups.push({
            id: `sales-${location}-${year}-${month}`,
            name: `Sales (${locationLabel}): ${monthName} ${year}`,
            path: `${location}/sales/${year}/${month}`,
            type: 'folder',
            files: folderFiles,
          })
        }
      }
    })

    // Group master data files by location (raw/processed/failed) and type
    const masterDataGroups = new Map<string, FileWithStatus[]>()
    masterDataFiles.forEach((file) => {
      // Extract location and type from path: {raw|processed|failed}/master-data/{type}/filename
      const match = file.path.match(/(raw|processed|failed)\/master-data\/([^/]+)\//)
      if (match && match[1] && match[2]) {
        const location = match[1] // raw, processed, or failed
        const type = match[2]
        const key = `${location}/${type}`
        if (!masterDataGroups.has(key)) {
          masterDataGroups.set(key, [])
        }
        masterDataGroups.get(key)!.push(file)
      } else {
        // Master data file not in expected structure
        const location = file.path.startsWith('processed/') ? 'processed' :
          file.path.startsWith('failed/') ? 'failed' : 'raw'
        const key = `${location}/other`
        if (!masterDataGroups.has(key)) {
          masterDataGroups.set(key, [])
        }
        masterDataGroups.get(key)!.push(file)
      }
    })

    masterDataGroups.forEach((folderFiles, key) => {
      const [location, type] = key.split('/')
      if (!location) return

      const locationLabel = location === 'processed' ? 'Processed' :
        location === 'failed' ? 'Failed' : 'Raw'

      if (type === 'other') {
        groups.push({
          id: `master-data-${location}-other`,
          name: `Master Data (${locationLabel} - Other)`,
          path: `${location}/master-data/`,
          type: 'folder',
          files: folderFiles,
        })
      } else if (type) {
        const typeName = type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        groups.push({
          id: `master-data-${location}-${type}`,
          name: `Master Data (${locationLabel}): ${typeName}`,
          path: `${location}/master-data/${type}`,
          type: 'folder',
          files: folderFiles,
        })
      }
    })

    // Add other files
    if (otherFiles.length > 0) {
      groups.push({
        id: 'other-files',
        name: 'Other Files',
        path: 'raw/',
        type: 'folder',
        files: otherFiles,
      })
    }

    // Sort groups: batches by date (newest first), then folders
    return groups.sort((a, b) => {
      if (a.type === 'batch' && b.type === 'batch') {
        return (b.created || '') > (a.created || '') ? 1 : -1
      }
      if (a.type === 'batch') return -1
      if (b.type === 'batch') return 1
      return a.name.localeCompare(b.name)
    })
  }, [files, searchQuery, statusFilter])

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }


  const getStatusBadge = (status: string | null) => {
    if (!status) {
      return <Badge variant="outline" className="bg-gray-100 text-gray-800">Not Processed</Badge>
    }

    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800">Success</Badge>
      case 'fail':
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>
      case 'in_progress':
        return <Badge className="bg-yellow-100 text-yellow-800">In Progress</Badge>
      case 'skipped_duplicate':
        return <Badge className="bg-gray-100 text-gray-800">Skipped</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const renderFileRow = (file: FileWithStatus, indent: number = 0) => (
    <TableRow
      key={file.path}
      className={`hover:bg-gray-50 ${onFileSelect ? 'cursor-pointer' : ''}`}
      onClick={() => {
        if (onFileSelect) {
          onFileSelect(file)
        }
      }}
    >
      <TableCell style={{ paddingLeft: `${indent * 24 + 16}px` }}>
        <div className="flex items-center gap-2">
          <span className="font-medium">{file.name}</span>
        </div>
      </TableCell>
      <TableCell className="text-sm text-gray-600 max-w-xs truncate">
        {file.path}
      </TableCell>
      <TableCell>{formatFileSize(file.size)}</TableCell>
      <TableCell>{formatDate(file.created)}</TableCell>
      <TableCell>
        {getStatusBadge(file.processingStatus?.status || null)}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {onFileSelect && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onFileSelect(file)
              }}
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              window.open(file.fullPath, '_blank')
            }}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )

  const renderGroup = (group: FileGroup, indent: number = 0): JSX.Element => {
    const isExpanded = expandedGroups.has(group.id)
    const hasSubGroups = group.subGroups && group.subGroups.length > 0
    const Icon = isExpanded ? FolderOpen : Folder

    return (
      <React.Fragment key={group.id}>
        <TableRow
          className="bg-gray-50 hover:bg-gray-100 cursor-pointer"
          onClick={() => toggleGroup(group.id)}
        >
          <TableCell colSpan={6} style={{ paddingLeft: `${indent * 24 + 16}px` }}>
            <div className="flex items-center gap-2">
              {hasSubGroups || group.files.length > 0 ? (
                isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                )
              ) : (
                <div className="w-4" />
              )}
              <Icon className="h-4 w-4 text-blue-600" />
              <span className="font-semibold text-gray-900">{group.name}</span>
              {group.type === 'batch' && group.statusSummary && (
                <div className="flex items-center gap-2 ml-4">
                  <Badge variant="outline" className="text-xs">
                    {group.statusSummary.total} files
                  </Badge>
                  {group.statusSummary.success > 0 && (
                    <Badge className="bg-green-100 text-green-800 text-xs">
                      {group.statusSummary.success} success
                    </Badge>
                  )}
                  {group.statusSummary.failed > 0 && (
                    <Badge className="bg-red-100 text-red-800 text-xs">
                      {group.statusSummary.failed} failed
                    </Badge>
                  )}
                  {group.statusSummary.inProgress > 0 && (
                    <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                      {group.statusSummary.inProgress} in progress
                    </Badge>
                  )}
                  {group.totalSize && (
                    <span className="text-xs text-gray-500">
                      {formatFileSize(group.totalSize)}
                    </span>
                  )}
                </div>
              )}
              {group.type === 'folder' && (
                <Badge variant="outline" className="text-xs ml-2">
                  {group.files.length} {group.files.length === 1 ? 'file' : 'files'}
                </Badge>
              )}
            </div>
          </TableCell>
        </TableRow>
        {isExpanded && (
          <>
            {hasSubGroups && group.subGroups?.map((subGroup) => renderGroup(subGroup, indent + 1))}
            {group.files.map((file) => renderFileRow(file, indent + 1))}
          </>
        )}
      </React.Fragment>
    )
  }

  if (loading && files.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border p-8 ${isAuthError ? 'border-orange-200 bg-orange-50' : 'border-red-200'
        }`}>
        <div className="text-center">
          <p className={`font-semibold mb-2 ${isAuthError ? 'text-orange-700' : 'text-red-600'
            }`}>
            {isAuthError ? 'GCP Authentication Required' : 'Error loading files'}
          </p>
          <div className={`text-sm mb-4 ${isAuthError ? 'text-orange-700' : 'text-gray-600'
            }`}>
            <p className="mb-3">{error}</p>
            {isAuthError && (
              <div className="mt-4 p-4 bg-white rounded border border-orange-200 text-left">
                <p className="font-semibold text-orange-800 mb-2">To fix this issue:</p>
                <ol className="list-decimal list-inside space-y-2 text-orange-700">
                  <li>
                    <strong>Quick fix (Local Development):</strong>
                    <br />
                    Run this command in your terminal:
                    <br />
                    <code className="bg-gray-100 px-2 py-1 rounded text-xs mt-1 inline-block font-mono">
                      gcloud auth application-default login
                    </code>
                    <br />
                    <span className="text-xs text-orange-600 mt-1 block">
                      Then refresh this page.
                    </span>
                  </li>
                  <li>
                    <strong>If using a service account:</strong>
                    <br />
                    Verify the <code className="bg-gray-100 px-1 rounded text-xs">GOOGLE_APPLICATION_CREDENTIALS</code> environment variable
                    <br />
                    points to a valid service account key JSON file.
                  </li>
                  <li>
                    <strong>For production:</strong>
                    <br />
                    Ensure your service account has the <code className="bg-gray-100 px-1 rounded text-xs">Storage Object Viewer</code> role
                    <br />
                    for the bucket: <code className="bg-gray-100 px-1 rounded text-xs">{bucketName || 'your-bucket'}</code>
                  </li>
                </ol>
                <div className="mt-3 pt-3 border-t border-orange-200">
                  <p className="text-xs text-orange-600">
                    📖 See <code className="bg-gray-100 px-1 rounded">docs/GCP_AUTHENTICATION_SETUP.md</code> for detailed setup instructions.
                  </p>
                </div>
              </div>
            )}
          </div>
          <Button onClick={fetchFiles} className="mt-4" variant="outline">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">File Management</h3>
          <p className="text-sm text-gray-500 mt-1">
            GCP Bucket: <span className="font-medium">{bucketName}</span>
          </p>
        </div>
        <Button onClick={fetchFiles} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-gray-200 flex gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search files or paths..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="fail">Failed</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="skipped_duplicate">Skipped</SelectItem>
            <SelectItem value="not_processed">Not Processed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Path</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Upload Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && files.length > 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto" />
                </TableCell>
              </TableRow>
            ) : groupedFiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  {files.length === 0
                    ? 'No files found in GCP bucket. Upload files to see them here.'
                    : `No files match your filters. ${files.length} file(s) available.`}
                </TableCell>
              </TableRow>
            ) : (
              groupedFiles.map((group) => renderGroup(group))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
