import {
  uploadFile,
  uploadMultipleFiles,
  deleteFile,
  listFiles,
  getFileDownloadURL,
  formatFileSize,
  type UploadedFile,
  type UploadProgress
} from './storage-service'
import { doc, updateDoc, getDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getDefaultFolder, updateFolderDocumentCount, type DocumentFolder } from './document-folder-service'
import { companySubcollectionPathSegments } from '@/lib/firestore-paths'

export interface TaskAttachment {
  id: string
  url: string
  path: string
  name: string
  size: number
  contentType: string
  uploadedBy: string
  uploadedAt: string
  referredUserId?: string
  referredUserName?: string
  folderId?: string // Optional: represents the folder this attachment belongs to
  folderName?: string // Optional: human-readable name of the folder
  source?: 'task' | 'subtask' | 'manual' // Track upload source
  metadata?: {
    name: string
    size: number
    contentType: string
    timeCreated: string
    updated: string
  }
}

export interface AttachmentUploadConfig {
  taskId: string
  companyId: string
  projectId?: string
  userId: string
  maxFileSize?: number // in bytes, default 10MB
  allowedTypes?: string[] // MIME types, default: all
  onProgress?: (fileIndex: number, progress: UploadProgress) => void
  extraFields?: Partial<TaskAttachment>
  isSubtask?: boolean // Indicates if this is a subtask upload
  folderId?: string // Optional: for manual uploads from Document Vault (defaults to default folder)
  source?: 'task' | 'subtask' | 'manual' // Explicitly set upload source
  groupId?: string // Enterprise group ID for multi-tenant support
}

/**
 * Generate storage path for task attachment
 * CRITICAL: All task/subtask uploads MUST use the default folder
 */
export function generateTaskAttachmentPath(
  companyId: string,
  taskId: string,
  fileName: string,
  projectId?: string,
  folderId?: string,
  groupId?: string
): string {
  const timestamp = Date.now()
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')

  // Use specific folder if provided, otherwise use 'root' for project-level files
  const folderPath = folderId ? `folders/${folderId}` : 'root'

  // Use multi-tenant path if groupId is provided
  const basePath = groupId ? `enterpriseGroups/${groupId}/companies/${companyId}` : `companies/${companyId}`

  if (projectId) {
    return `${basePath}/projects/${projectId}/${folderPath}/tasks/${taskId}/attachments/${timestamp}-${sanitizedFileName}`
  }
  return `${basePath}/${folderPath}/tasks/${taskId}/attachments/${timestamp}-${sanitizedFileName}`
}

/**
 * Validate file before upload
 */
export function validateFile(
  file: File,
  maxSize?: number,
  allowedTypes?: string[]
): { valid: boolean; error?: string } {
  const defaultMaxSize = 10 * 1024 * 1024 // 10MB
  const maxFileSize = maxSize || defaultMaxSize

  if (file.size > maxFileSize) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${formatFileSize(maxFileSize)}`
    }
  }

  if (allowedTypes && allowedTypes.length > 0) {
    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`
      }
    }
  }

  return { valid: true }
}

/**
 * Upload attachment(s) for a task
 * CRITICAL: All task/subtask uploads MUST automatically use the default folder
 * This function does NOT accept folderId - it always uses the default folder
 */
export async function uploadTaskAttachments(
  files: File[],
  config: AttachmentUploadConfig
): Promise<TaskAttachment[]> {
  const { taskId, companyId, projectId, userId, maxFileSize, allowedTypes, onProgress } = config

  if (!projectId) {
    throw new Error('Project ID is required for task uploads')
  }

  // Validate all files first
  for (const file of files) {
    const validation = validateFile(file, maxFileSize, allowedTypes)
    if (!validation.valid) {
      throw new Error(validation.error || 'File validation failed')
    }
  }

  // Determine source type
  const source: 'task' | 'subtask' | 'manual' = config.source ||
    (config.folderId ? 'manual' : (config.isSubtask ? 'subtask' : 'task'))

  // Determine target folder
  const groupId = config.groupId
  let targetFolder: DocumentFolder | null = null
  try {
    if (config.folderId) {
      // Manual upload with specific folder - get that folder
      const { getFolder } = await import('./document-folder-service')
      const folder = await getFolder(companyId, projectId, config.folderId, groupId)
      if (folder) {
        targetFolder = folder
      }
    } else if (!config.folderId && source !== 'manual') {
      // Task/subtask upload - always use default folder
      targetFolder = await getDefaultFolder(companyId, projectId, userId, groupId)
    }
  } catch (error) {
    console.error('Error getting folder:', error)
    // Don't fail if it's a manual upload to root
    if (source !== 'manual') throw new Error('Failed to get folder for upload')
  }

  // Generate paths using target folder
  const uploadPromises = files.map((file, index) => {
    const path = generateTaskAttachmentPath(
      companyId,
      taskId,
      file.name,
      projectId,
      targetFolder?.id,
      config.groupId
    )

    const progressCallback = onProgress
      ? (progress: UploadProgress) => onProgress(index, progress)
      : undefined

    return uploadFile(file, path, progressCallback)
  })

  const uploadedFiles = await Promise.all(uploadPromises)

  // Determine source type (already determined above)

  // Create attachment records with folder information
  const attachments: TaskAttachment[] = uploadedFiles.map((file, index) => ({
    id: `${Date.now()}-${index}`,
    url: file.url,
    path: file.path,
    name: file.name,
    size: file.size,
    contentType: file.contentType,
    uploadedBy: userId,
    uploadedAt: new Date().toISOString(),
    source: source,
    metadata: file.metadata,
    ...(targetFolder ? {
      folderId: targetFolder.id,
      folderName: targetFolder.name,
    } : {}),
    ...(config.extraFields || {})
  }))

  // Save attachments to Firestore task document
  await saveAttachmentsToTask(taskId, companyId, attachments, config.groupId)

  // Update folder document count (non-blocking) if a folder was targeted
  if (targetFolder) {
    updateFolderDocumentCount(companyId, projectId, targetFolder.id, files.length, groupId).catch(
      error => {
        console.error('Error updating folder document count:', error)
        // Don't throw - this is a non-critical operation
      }
    )
  }

  return attachments
}

/**
 * Add a link as an attachment to a task
 */
export async function addTaskLink(
  config: {
    taskId: string,
    companyId: string,
    projectId: string,
    userId: string,
    url: string,
    name: string,
    folderId?: string,
    isSubtask?: boolean,
    groupId?: string
  }
): Promise<TaskAttachment> {
  const { taskId, companyId, projectId, userId, url, name, folderId, isSubtask } = config
  const groupId = config.groupId

  // Determine target folder
  let targetFolder: DocumentFolder | null = null
  try {
    if (folderId) {
      const { getFolder } = await import('./document-folder-service')
      const folder = await getFolder(companyId, projectId, folderId, groupId)
      if (folder) {
        targetFolder = folder
      }
    } else {
      // Always use default folder if none specified
      targetFolder = await getDefaultFolder(companyId, projectId, userId, groupId)
    }
  } catch (error) {
    console.error('Error getting folder for link:', error)
    // Continue even if folder fetch fails
  }

  const attachment: TaskAttachment = {
    id: `${Date.now()}-link`,
    url: url,
    path: 'link', // Placeholder path
    name: name,
    size: 0,
    contentType: 'application/link',
    uploadedBy: userId,
    uploadedAt: new Date().toISOString(),
    source: folderId ? 'manual' : (isSubtask ? 'subtask' : 'task'),
    ...(targetFolder ? {
      folderId: targetFolder.id,
      folderName: targetFolder.name,
    } : {})
  }

  // Save attachment to Firestore task document
  await saveAttachmentsToTask(taskId, companyId, [attachment], config.groupId)

  // Update folder document count (non-blocking)
  if (targetFolder) {
    updateFolderDocumentCount(companyId, projectId, targetFolder.id, 1, groupId).catch(
      error => {
        console.error('Error updating folder document count:', error)
      }
    )
  }

  return attachment
}

/**
 * Save attachments to Firestore task document
 */
async function saveAttachmentsToTask(
  taskId: string,
  companyId: string,
  attachments: TaskAttachment[],
  groupId?: string
): Promise<void> {
  const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
  const taskRef = doc(db, segments[0], ...segments.slice(1), taskId)

  try {
    // Get current task document
    const taskDoc = await getDoc(taskRef)

    if (taskDoc.exists()) {
      const currentAttachments = taskDoc.data().attachments || []
      const updatedAttachments = [...currentAttachments, ...attachments]

      await updateDoc(taskRef, {
        attachments: updatedAttachments,
        updatedAt: new Date().toISOString()
      })
    } else {
      // Task doesn't exist, create it with attachments
      await updateDoc(taskRef, {
        attachments: attachments,
        updatedAt: new Date().toISOString()
      } as any)
    }
  } catch (error) {
    console.error('Error saving attachments to task:', error)
    throw error
  }
}

/**
 * Get all attachments for a task
 */
export async function getTaskAttachments(
  taskId: string,
  companyId: string,
  groupId?: string
): Promise<TaskAttachment[]> {
  try {
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
    const taskRef = doc(db, segments[0], ...segments.slice(1), taskId)
    const taskDoc = await getDoc(taskRef)

    if (taskDoc.exists()) {
      return taskDoc.data().attachments || []
    }

    return []
  } catch (error) {
    console.error('Error getting task attachments:', error)
    throw error
  }
}

/**
 * Delete an attachment from a task
 */
export async function deleteTaskAttachment(
  taskId: string,
  companyId: string,
  attachment: TaskAttachment,
  groupId?: string
): Promise<void> {
  try {
    // Delete from Firebase Storage only if it's not a link
    if (attachment.contentType !== 'application/link') {
      await deleteFile(attachment.path)
    }

    // Remove from Firestore task document
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
    const taskRef = doc(db, segments[0], ...segments.slice(1), taskId)
    const taskDoc = await getDoc(taskRef)

    if (taskDoc.exists()) {
      const currentAttachments = taskDoc.data().attachments || []
      const updatedAttachments = currentAttachments.filter(
        (att: TaskAttachment) => att.id !== attachment.id
      )

      await updateDoc(taskRef, {
        attachments: updatedAttachments,
        updatedAt: new Date().toISOString()
      })
    }
  } catch (error) {
    console.error('Error deleting task attachment:', error)
    throw error
  }
}

/**
 * Get attachment download URL (with refresh if needed)
 */
export async function getAttachmentDownloadURL(attachment: TaskAttachment): Promise<string> {
  try {
    // If URL exists and is still valid, return it
    if (attachment.url) {
      return attachment.url
    }

    // Otherwise, get fresh URL from storage
    return await getFileDownloadURL(attachment.path)
  } catch (error) {
    console.error('Error getting attachment download URL:', error)
    throw error
  }
}

/**
 * Default allowed file types for task attachments
 */
export const DEFAULT_ALLOWED_TYPES = [
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // Text
  'text/plain',
  'text/csv',
  // Archives
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
]

/**
 * Default max file size: 10MB
 */
export const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

/**
 * Delete a DoD evidence file from a task's definitionOfDone array
 * Evidence files are stored in task.definitionOfDone[n].evidence[],
 * NOT in task.attachments[]. This function handles that separate path.
 */
export async function deleteTaskEvidence(
  taskId: string,
  companyId: string,
  evidenceId: string,
  groupId?: string
): Promise<void> {
  try {
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
    const taskRef = doc(db, segments[0], ...segments.slice(1), taskId)
    const taskDoc = await getDoc(taskRef)

    if (!taskDoc.exists()) {
      throw new Error('Task not found')
    }

    const data = taskDoc.data()
    const definitionOfDone: any[] = data.definitionOfDone || []

    // Find which DoD item contains this evidence
    let evidenceStoragePath: string | null = null

    const updatedDoD = definitionOfDone.map((dodItem: any) => {
      if (!Array.isArray(dodItem.evidence)) return dodItem

      const evidenceItem = dodItem.evidence.find((ev: any) => ev.id === evidenceId)
      if (evidenceItem) {
        // Capture the storage path/URL so we can delete from Firebase Storage
        evidenceStoragePath = evidenceItem.content
      }

      return {
        ...dodItem,
        evidence: dodItem.evidence.filter((ev: any) => ev.id !== evidenceId),
      }
    })

    // Delete from Firebase Storage first (only if it's a real storage path/URL)
    if (evidenceStoragePath) {
      try {
        await deleteFile(evidenceStoragePath)
      } catch (storageError) {
        // Log but don't block Firestore update — the file may already be gone
        console.warn('Could not delete evidence file from storage:', storageError)
      }
    }

    // Update the Firestore task document
    await updateDoc(taskRef, {
      definitionOfDone: updatedDoD,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error deleting task evidence:', error)
    throw error
  }
}

// Re-export formatFileSize for convenience
export { formatFileSize } from './storage-service'

