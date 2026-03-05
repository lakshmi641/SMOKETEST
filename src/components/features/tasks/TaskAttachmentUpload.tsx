'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Upload,
  X,
  File,
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  uploadTaskAttachments,
  validateFile,
  formatFileSize,
  type TaskAttachment,
  type AttachmentUploadConfig,
  DEFAULT_ALLOWED_TYPES,
  DEFAULT_MAX_FILE_SIZE
} from '@/lib/services/storage/task-attachment-service'
import type { UploadProgress } from '@/lib/services/storage/storage-service'

interface TaskAttachmentUploadProps {
  taskId: string
  companyId: string
  projectId?: string
  userId: string
  groupId?: string | null
  onUploadComplete?: (attachments: TaskAttachment[]) => void
  onUploadError?: (error: Error) => void
  maxFileSize?: number
  allowedTypes?: string[]
  multiple?: boolean
  disabled?: boolean
}

export function TaskAttachmentUpload({
  taskId,
  companyId,
  projectId,
  userId,
  groupId,
  onUploadComplete,
  onUploadError,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  allowedTypes = DEFAULT_ALLOWED_TYPES,
  multiple = true,
  disabled = false
}: TaskAttachmentUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadProgress, setUploadProgress] = useState<Record<number, UploadProgress>>({})
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return

    const files = Array.from(e.target.files)
    const validFiles: File[] = []
    const errors: string[] = []

    // Validate each file
    files.forEach((file) => {
      const validation = validateFile(file, maxFileSize, allowedTypes)
      if (validation.valid) {
        validFiles.push(file)
      } else {
        errors.push(`${file.name}: ${validation.error}`)
      }
    })

    if (errors.length > 0) {
      errors.forEach(error => toast.error(error))
    }

    if (validFiles.length > 0) {
      if (multiple) {
        setSelectedFiles(prev => [...prev, ...validFiles])
      } else {
        const firstFile = validFiles[0]
        if (firstFile) {
          setSelectedFiles([firstFile])
        }
      }
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    setUploadProgress(prev => {
      const newProgress = { ...prev }
      delete newProgress[index]
      return newProgress
    })
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select at least one file to upload')
      return
    }

    setIsUploading(true)
    setUploadProgress({})

    try {
      if (!projectId) {
        throw new Error('Project ID is required but was not provided.')
      }

      const config: AttachmentUploadConfig = {
        taskId,
        companyId,
        projectId,
        userId,
        groupId: groupId ?? undefined,
        maxFileSize,
        allowedTypes,
        onProgress: (fileIndex, progress) => {
          setUploadProgress(prev => ({ ...prev, [fileIndex]: progress }))
        }
      }

      const attachments = await uploadTaskAttachments(selectedFiles, config)

      setSelectedFiles([])
      setUploadProgress({})
      toast.success(`Successfully uploaded ${attachments.length} file(s)`)

      if (onUploadComplete) {
        onUploadComplete(attachments)
      }
    } catch (error: any) {
      console.error('Upload error:', error)
      const errorMessage = error.message || 'Failed to upload files'
      toast.error(errorMessage)

      if (onUploadError) {
        onUploadError(error)
      }
    } finally {
      setIsUploading(false)
    }
  }

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  return (
    <div className="space-y-4">
      {/* File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        onChange={handleFileSelect}
        className="hidden"
        accept={allowedTypes.join(',')}
        disabled={disabled || isUploading}
      />

      {/* Upload Button */}
      <Button
        type="button"
        variant="outline"
        onClick={handleClick}
        disabled={disabled || isUploading}
        className="w-full"
      >
        <Upload className="h-4 w-4 mr-2" />
        {isUploading ? 'Uploading...' : 'Select Files to Upload'}
      </Button>

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Selected Files ({selectedFiles.length})</div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border rounded-md bg-muted/50"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)} • {file.type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {uploadProgress[index] && (
                    <div className="flex items-center gap-2 min-w-[100px]">
                      <Progress
                        value={uploadProgress[index].percentage}
                        className="w-20 h-2"
                      />
                      <span className="text-xs text-muted-foreground">
                        {Math.round(uploadProgress[index].percentage)}%
                      </span>
                    </div>
                  )}
                  {!isUploading && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Upload Button */}
          {!isUploading && (
            <Button
              onClick={handleUpload}
              disabled={selectedFiles.length === 0}
              className="w-full"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload {selectedFiles.length} File(s)
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {/* Upload Info */}
      <div className="text-xs text-muted-foreground space-y-1">
        <div className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          <span>Max file size: {formatFileSize(maxFileSize)}</span>
        </div>
        <div className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          <span>Allowed types: Documents, Images, Archives</span>
        </div>
      </div>
    </div>
  )
}

