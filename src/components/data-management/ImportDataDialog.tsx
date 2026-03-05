'use client'

import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface ImportDataDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  objectName: string
  companyId: string
  userId?: string
  onImportSuccess?: () => void
}

interface FileUploadResult {
  fileName: string
  uploadedFileName: string
  filePath: string
  fileType: string
  status: 'success' | 'error'
  size: number
  error?: string
}

export function ImportDataDialog({
  open,
  onOpenChange,
  objectName,
  companyId,
  userId,
  onImportSuccess,
}: ImportDataDialogProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{
    success: boolean
    message: string
    results?: FileUploadResult[]
    errors?: Array<{ fileName: string; error: string }>
    summary?: {
      total: number
      successful: number
      failed: number
    }
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    // Validate file formats
    const supportedExtensions = ['xlsx', 'xls', 'csv', 'parquet']
    const validFiles: File[] = []
    const invalidFiles: string[] = []

    files.forEach((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase() || ''
      if (supportedExtensions.includes(extension)) {
        validFiles.push(file)
      } else {
        invalidFiles.push(file.name)
      }
    })

    if (invalidFiles.length > 0) {
      toast.error(
        `Invalid file format(s): ${invalidFiles.join(', ')}. Supported formats: ${supportedExtensions.join(', ')}`
      )
    }

    if (validFiles.length > 0) {
      setSelectedFiles((prev) => [...prev, ...validFiles])
      setUploadResult(null)
    }

    // Reset input to allow selecting same files again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
    setUploadResult(null)
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select at least one file to upload')
      return
    }

    if (!companyId) {
      toast.error('Company ID is required')
      return
    }

    setIsUploading(true)
    setUploadResult(null)

    try {
      const formData = new FormData()
      selectedFiles.forEach((file) => {
        formData.append('files', file)
      })
      formData.append('companyId', companyId)
      if (userId) {
        formData.append('userId', userId)
      }

      const response = await fetch('/api/data/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        let errorMessage = data.error || 'Upload failed'
        if (data.message) {
          errorMessage = data.message
        }
        if (data.errors && data.errors.length > 0) {
          errorMessage += `\n\nErrors:\n${data.errors.map((e: any) => `- ${e.fileName}: ${e.error}`).join('\n')}`
        }
        throw new Error(errorMessage)
      }

      setUploadResult({
        success: data.success,
        message: data.message,
        results: data.results,
        errors: data.errors,
        summary: data.summary,
      })

      if (data.success && data.summary?.successful > 0) {
        toast.success(data.message)
        setSelectedFiles([])
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }

        // Call success callback and close dialog after a delay
        if (onImportSuccess) {
          setTimeout(() => {
            onImportSuccess()
            onOpenChange(false)
            setUploadResult(null)
          }, 2000)
        }
      } else {
        toast.error(data.message || 'Some files failed to upload')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload files'
      setUploadResult({
        success: false,
        message: errorMessage,
      })
      toast.error(errorMessage)
    } finally {
      setIsUploading(false)
    }
  }

  const handleClose = () => {
    if (!isUploading) {
      setSelectedFiles([])
      setUploadResult(null)
      onOpenChange(false)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Data to {objectName}</DialogTitle>
          <DialogDescription>
            Upload multiple files to GCP bucket for automatic processing and ingestion into ClickHouse
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload Area */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Files
            </label>
            <div className="mt-1">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".xlsx,.xls,.csv,.parquet,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/csv,application/parquet,application/x-parquet"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <FileSpreadsheet className="h-5 w-5" />
                Choose Files
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Supported formats: Excel (.xlsx, .xls), CSV (.csv), Parquet (.parquet)
            </p>

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-gray-700">
                  Selected Files ({selectedFiles.length}):
                </p>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md p-2 space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileSpreadsheet className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <span className="text-sm text-gray-700 truncate">{file.name}</span>
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          ({formatFileSize(file.size)})
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveFile(index)}
                        className="text-red-600 hover:text-red-700 ml-2 flex-shrink-0"
                        disabled={isUploading}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Upload Button */}
          <div>
            <button
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || isUploading}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Uploading {selectedFiles.length} file(s)...
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5" />
                  Upload {selectedFiles.length} file(s) to GCP Bucket
                </>
              )}
            </button>
          </div>

          {/* Upload Result */}
          {uploadResult && (
            <div
              className={`rounded-lg p-4 border ${
                uploadResult.success
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {uploadResult.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <p
                    className={`font-medium whitespace-pre-line ${
                      uploadResult.success ? 'text-green-800' : 'text-red-800'
                    }`}
                  >
                    {uploadResult.message}
                  </p>
                  {uploadResult.summary && (
                    <div className="mt-2 text-sm text-gray-700">
                      <p>
                        Total: {uploadResult.summary.total} | Successful: {uploadResult.summary.successful} | Failed:{' '}
                        {uploadResult.summary.failed}
                      </p>
                    </div>
                  )}
                  {uploadResult.results && uploadResult.results.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-700 mb-1">Uploaded Files:</p>
                      <div className="max-h-40 overflow-y-auto">
                        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                          {uploadResult.results.map((result, index) => (
                            <li key={index} className="break-words">
                              {result.fileName} → {result.filePath}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  {uploadResult.errors && uploadResult.errors.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-red-700 mb-1">Failed Files:</p>
                      <div className="max-h-40 overflow-y-auto">
                        <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                          {uploadResult.errors.map((error, index) => (
                            <li key={index} className="break-words">
                              {error.fileName}: {error.error}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">File Upload Process</h3>
            <p className="text-sm text-gray-600 mb-2">
              Files are uploaded to GCP bucket and automatically processed by Firebase Functions, which load them into ClickHouse.
            </p>
            <div className="text-sm text-gray-600 space-y-2">
              <p><strong>Supported File Types:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Sales Files:</strong> Files with "sales" or "day_book" in the name</li>
                <li><strong>Master Data:</strong> Files starting with "020" or containing "item", "account", "customer-type", etc.</li>
              </ul>
              <p className="mt-3"><strong>Supported Formats:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Excel: .xlsx, .xls</li>
                <li>CSV: .csv</li>
                <li>Parquet: .parquet</li>
              </ul>
              <p className="mt-3"><strong>Processing Flow:</strong></p>
              <p className="ml-2">GCP Bucket → Firebase Function → ClickHouse Staging → Analytics</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
