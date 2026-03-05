/**
 * Task Comment Types
 * 
 * Nested under: companies/{companyId}/tasks/{taskId}/comments/{commentId}
 * 
 * Features:
 * - Auto-populates hierarchy from parent task
 * - Optional projectId/workspaceId for flexibility
 * - Rich text with @ mentions
 * - Edit tracking
 */

export interface CommentAttachment {
    url: string        // Firebase Storage download URL
    storagePath: string // Storage path (used for deletion)
    name: string       // Original file name
    size: number       // File size in bytes
    contentType: string // e.g. "image/png"
    uploadedAt: string  // ISO timestamp
}

export interface TaskComment {
    // Identity
    id: string

    // Hierarchy (auto-populated from parent task)
    companyId: string
    workspaceId?: string        // Optional - from task
    projectId?: string          // Optional - from task
    taskId: string              // Required - parent task

    // User Information (cached for performance)
    userId: string
    userName: string
    userEmail: string
    userAvatar?: string

    // Content
    text: string                // HTML from Tiptap
    plainText: string           // Plain text for search

    // @ Mentions
    mentions: string[]          // Array of mentioned user IDs

    // Attachments
    attachments?: CommentAttachment[]

    // Edit Tracking
    isEdited: boolean
    editedAt?: string

    // Timestamps
    createdAt: string          // ISO string
    updatedAt: string          // ISO string
}

/**
 * Input for creating a new comment
 */
export type CreateCommentInput = {
    userId: string
    userName: string
    userEmail: string
    userAvatar?: string
    text: string
    plainText: string
    mentions: string[]
    attachments?: CommentAttachment[]
}

/**
 * Input for updating an existing comment
 */
export type UpdateCommentInput = {
    text: string
    plainText: string
    mentions: string[]
    attachments?: CommentAttachment[]
}
