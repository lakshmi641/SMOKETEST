/**
 * Comment Image Service
 * Uploads images attached to task comments to Firebase Storage.
 * Uses the existing API-route-based upload to avoid CORS issues.
 */

import { uploadFile } from '@/lib/services/storage/storage-service'
import type { CommentAttachment } from '@/types/task-comment'

/**
 * Upload a single comment image to Firebase Storage.
 *
 * @param taskId  - Parent task ID (used to scope the storage path)
 * @param file    - The image File object selected by the user
 * @returns       - CommentAttachment ready to be saved in Firestore
 */
export async function uploadCommentImage(
    taskId: string,
    file: File
): Promise<CommentAttachment> {
    // Validate: only allow images
    if (!file.type.startsWith('image/')) {
        throw new Error('Only image files are allowed for comment attachments.')
    }

    // 5 MB limit
    const MAX_SIZE = 5 * 1024 * 1024
    if (file.size > MAX_SIZE) {
        throw new Error('Image size must be under 5 MB.')
    }

    const timestamp = Date.now()
    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `tasks/${taskId}/comments/${timestamp}-${sanitized}`

    const uploaded = await uploadFile(file, storagePath)

    return {
        url: uploaded.url,
        storagePath: uploaded.path,
        name: file.name,
        size: file.size,
        contentType: file.type,
        uploadedAt: new Date().toISOString()
    }
}
