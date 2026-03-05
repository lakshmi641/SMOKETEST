/**
 * Task Comment Service
 * 
 * Provides CRUD operations for task comments with:
 * - Auto-population of hierarchy from parent task
 * - Support for both project tasks and personal tasks
 * - Rich text with @ mentions
 * - Notification system for mentioned users
 * - Edit tracking
 *
 * Path (multi-org): enterpriseGroups/{groupId}/companies/{companyId}/tasks/{taskId}/comments/{commentId}
 * Path (legacy):    companies/{companyId}/tasks/{taskId}/comments/{commentId}
 */

import {
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    Timestamp,
    serverTimestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { TaskComment, CreateCommentInput, UpdateCommentInput } from '@/types/task-comment'
import type { GeneratedTask } from '@/types/task-template-schema'
import { TaskNotificationService } from './task-notification-service'

/**
 * Helper function to convert Firestore Timestamps to ISO strings
 */
const convertTimestamps = (data: any): any => {
    const converted = { ...data }
    for (const key in converted) {
        if (converted[key] instanceof Timestamp) {
            converted[key] = converted[key].toDate().toISOString()
        }
    }
    return converted
}

/** Path segments for task doc. With groupId uses enterprise path (required for Firestore rules). */
function taskPathSegments(companyId: string, taskId: string, groupId?: string): string[] {
    if (groupId) {
        return ['enterpriseGroups', groupId, 'companies', companyId, 'tasks', taskId]
    }
    return ['companies', companyId, 'tasks', taskId]
}

export class TaskCommentService {

    // ============================================================================
    // CREATE: Add new comment to task
    // ============================================================================

    /**
     * Create a new comment on a task
     * 
     * Features:
     * - Auto-populates projectId/workspaceId from parent task (if they exist)
     * - Supports both project tasks and personal tasks
     * - Sends notifications to mentioned users
     * - Tracks mentions for notification system
     * 
     * @param companyId - Company ID
     * @param taskId - Task ID (can be project task or personal task)
     * @param commentData - Comment data
     * @returns Comment ID
     */
    static async createComment(
        companyId: string,
        taskId: string,
        commentData: CreateCommentInput,
        groupId?: string
    ): Promise<string> {
        try {
            console.log('📝 Creating comment:', { companyId, taskId, mentions: commentData.mentions })

            const taskSegments = taskPathSegments(companyId, taskId, groupId)

            // Step 1: Fetch parent task to get hierarchy information
            const taskRef = doc(db, ...(taskSegments as [string, ...string[]]))
            const taskSnap = await getDoc(taskRef)

            if (!taskSnap.exists()) {
                throw new Error(`Task not found: ${taskId}`)
            }

            const task = taskSnap.data() as GeneratedTask

            // Step 2: Build comment with flexible hierarchy
            const commentsRef = collection(taskRef, 'comments')

            const now = new Date().toISOString()

            // Start with required fields only
            const commentToSave: Partial<TaskComment> & {
                companyId: string
                taskId: string
                userId: string
                userName: string
                userEmail: string
                text: string
                plainText: string
                mentions: string[]
                isEdited: boolean
                createdAt: string
                updatedAt: string
            } = {
                // Required fields
                companyId,
                taskId,

                // User data
                userId: commentData.userId,
                userName: commentData.userName,
                userEmail: commentData.userEmail,

                // Content
                text: commentData.text,
                plainText: commentData.plainText,

                // Mentions
                mentions: commentData.mentions || [],

                // Edit tracking
                isEdited: false,

                // Timestamps
                createdAt: now,
                updatedAt: now
            }

            // Only add optional fields if task has them
            if (task.workspaceId) {
                commentToSave.workspaceId = task.workspaceId
            }

            if (task.projectId) {
                commentToSave.projectId = task.projectId
            }

            if (commentData.userAvatar) {
                commentToSave.userAvatar = commentData.userAvatar
            }

            if (commentData.attachments && commentData.attachments.length > 0) {
                commentToSave.attachments = commentData.attachments
            }

            // Step 3: Create comment in Firestore
            const docRef = await addDoc(commentsRef, commentToSave)

            console.log('✅ Comment created:', {
                commentId: docRef.id,
                companyId,
                workspaceId: task.workspaceId || '(none - personal task)',
                projectId: task.projectId || '(none - personal task)',
                taskId,
                type: task.projectId ? 'PROJECT TASK' : 'PERSONAL TASK',
                mentionsCount: commentData.mentions?.length || 0
            })

            // Step 4: Send notifications to mentioned users
            if (commentData.mentions && commentData.mentions.length > 0) {
                await this.sendMentionNotifications(
                    companyId,
                    taskId,
                    task,
                    commentData.mentions,
                    commentData.userId,
                    commentData.userName,
                    commentData.plainText,
                    groupId
                )
            }

            return docRef.id

        } catch (error) {
            console.error('❌ Error creating comment:', error)
            throw error
        }
    }

    // ============================================================================
    // READ: Get comments for a task
    // ============================================================================

    /**
     * Get all comments for a task
     * When groupId is provided, uses enterprise path (required for Firestore rules in multi-org).
     *
     * @param companyId - Company ID
     * @param taskId - Task ID
     * @param groupId - Optional enterprise group ID for multi-tenant path
     * @returns Array of comments, ordered by creation date (oldest first)
     */
    static async getTaskComments(
        companyId: string,
        taskId: string,
        groupId?: string
    ): Promise<TaskComment[]> {
        try {
            const taskSegments = taskPathSegments(companyId, taskId, groupId)
            const taskRef = doc(db, ...(taskSegments as [string, ...string[]]))
            const commentsRef = collection(taskRef, 'comments')

            const q = query(commentsRef, orderBy('createdAt', 'asc'))

            // Execute query - Firestore will use cache if available
            const snapshot = await getDocs(q)

            const comments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...convertTimestamps(doc.data())
            } as TaskComment))

            console.log(`📖 Retrieved ${comments.length} comments for task ${taskId}`)

            return comments

        } catch (error: any) {
            console.error('❌ Error getting comments:', error)
            throw error
        }
    }

    /**
     * Get a single comment by ID
     *
     * @param companyId - Company ID
     * @param taskId - Task ID
     * @param commentId - Comment ID
     * @param groupId - Optional enterprise group ID for multi-tenant path
     * @returns Comment or null if not found
     */
    static async getComment(
        companyId: string,
        taskId: string,
        commentId: string,
        groupId?: string
    ): Promise<TaskComment | null> {
        try {
            const taskSegments = taskPathSegments(companyId, taskId, groupId)
            const commentRef = doc(db, ...(([...taskSegments, 'comments', commentId] as unknown) as [string, ...string[]]))

            const commentSnap = await getDoc(commentRef)

            if (!commentSnap.exists()) {
                return null
            }

            return {
                id: commentSnap.id,
                ...convertTimestamps(commentSnap.data())
            } as TaskComment

        } catch (error) {
            console.error('❌ Error getting comment:', error)
            throw error
        }
    }

    // ============================================================================
    // UPDATE: Edit existing comment
    // ============================================================================

    /**
     * Update an existing comment
     *
     * @param companyId - Company ID
     * @param taskId - Task ID
     * @param commentId - Comment ID
     * @param updates - Updated content
     * @param currentUserId - ID of user making the update
     * @param groupId - Optional enterprise group ID for multi-tenant path
     */
    static async updateComment(
        companyId: string,
        taskId: string,
        commentId: string,
        updates: UpdateCommentInput,
        currentUserId: string,
        groupId?: string
    ): Promise<void> {
        try {
            console.log('✏️ Updating comment:', { commentId, currentUserId })

            const taskSegments = taskPathSegments(companyId, taskId, groupId)
            const commentRef = doc(db, ...(([...taskSegments, 'comments', commentId] as unknown) as [string, ...string[]]))

            // Verify comment exists and user has permission
            const commentSnap = await getDoc(commentRef)

            if (!commentSnap.exists()) {
                throw new Error(`Comment not found: ${commentId}`)
            }

            const comment = commentSnap.data() as TaskComment

            if (comment.userId !== currentUserId) {
                throw new Error('Unauthorized: Only comment author can edit')
            }

            // Get previous mentions to detect changes
            const previousMentions = comment.mentions || []
            const newMentions = updates.mentions || []

            // Update comment
            await updateDoc(commentRef, {
                text: updates.text,
                plainText: updates.plainText,
                mentions: newMentions,
                attachments: updates.attachments ?? [],
                isEdited: true,
                editedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })

            console.log('✅ Comment updated:', commentId)

            // Send notifications to newly mentioned users
            const addedMentions = newMentions.filter(
                userId => !previousMentions.includes(userId)
            )

            if (addedMentions.length > 0) {
                // Fetch task for notification context
                const taskRef = doc(db, ...(taskPathSegments(companyId, taskId, groupId) as [string, ...string[]]))
                const taskSnap = await getDoc(taskRef)

                if (taskSnap.exists()) {
                    const task = taskSnap.data() as GeneratedTask
                    await this.sendMentionNotifications(
                        companyId,
                        taskId,
                        task,
                        addedMentions,
                        comment.userId,
                        comment.userName,
                        updates.plainText,
                        groupId
                    )
                }
            }

        } catch (error) {
            console.error('❌ Error updating comment:', error)
            throw error
        }
    }

    // ============================================================================
    // DELETE: Remove comment
    // ============================================================================

    /**
     * Delete a comment
     *
     * @param companyId - Company ID
     * @param taskId - Task ID
     * @param commentId - Comment ID
     * @param currentUserId - ID of user making the deletion
     * @param groupId - Optional enterprise group ID for multi-tenant path
     */
    static async deleteComment(
        companyId: string,
        taskId: string,
        commentId: string,
        currentUserId: string,
        groupId?: string
    ): Promise<void> {
        try {
            console.log('🗑️ Deleting comment:', { commentId, currentUserId })

            const taskSegments = taskPathSegments(companyId, taskId, groupId)
            const commentRef = doc(db, ...(([...taskSegments, 'comments', commentId] as unknown) as [string, ...string[]]))

            // Verify comment exists and user has permission
            const commentSnap = await getDoc(commentRef)

            if (!commentSnap.exists()) {
                throw new Error(`Comment not found: ${commentId}`)
            }

            const comment = commentSnap.data() as TaskComment

            if (comment.userId !== currentUserId) {
                throw new Error('Unauthorized: Only comment author can delete')
            }

            // Delete comment
            await deleteDoc(commentRef)

            console.log('✅ Comment deleted:', commentId)

        } catch (error) {
            console.error('❌ Error deleting comment:', error)
            throw error
        }
    }

    // ============================================================================
    // NOTIFICATIONS: Send mention notifications
    // ============================================================================

    /**
     * Send notifications to mentioned users
     * 
     * @param companyId - Company ID
     * @param taskId - Task ID
     * @param task - Task object for context
     * @param mentionedUserIds - Array of user IDs that were mentioned
     * @param authorId - ID of comment author
     * @param authorName - Name of comment author
     * @param commentText - Plain text of comment (for preview)
     */
    private static async sendMentionNotifications(
        companyId: string,
        taskId: string,
        task: GeneratedTask,
        mentionedUserIds: string[],
        authorId: string,
        authorName: string,
        commentText: string,
        groupId?: string
    ): Promise<void> {
        try {
            console.log(`📢 Sending mention notifications to ${mentionedUserIds.length} users`)

            // Notify everyone mentioned, including the author if they mentioned themselves
            const usersToNotify = mentionedUserIds

            if (usersToNotify.length === 0) {
                console.log('No users to notify (author mentioned only themselves)')
                return
            }

            // Truncate comment text for preview
            const preview = commentText.length > 100
                ? commentText.substring(0, 100) + '...'
                : commentText

            // ------------------------------------------------------------------------
            // Centralized Notifications (In-App, Email, WhatsApp)
            // ------------------------------------------------------------------------
            try {
                const { ExternalNotificationService } = await import('@/lib/services/external-notifications/external-notification-service');

                const notificationPromises = usersToNotify.map(userId =>
                    ExternalNotificationService.notifyCommentMention(
                        companyId,
                        userId,
                        task.title || 'Untitled Task',
                        authorName,
                        preview,
                        task.projectId,
                        taskId,
                        groupId
                    )
                );

                // Fire and forget (don't await results to block response)
                Promise.all(notificationPromises)
                    .then(() => console.log('✅ Mention notifications processed via ExternalNotificationService'))
                    .catch(e => console.error('⚠️ Mention notifications failed:', e));

            } catch (error) {
                console.error('⚠️ Failed to process mention notifications:', error)
            }

        } catch (error) {
            console.error('❌ Error sending mention notifications:', error)
            // Don't throw - notifications are non-critical
        }
    }

    // ============================================================================
    // UTILITY: Get comment count for a task
    // ============================================================================

    /**
     * Get the total number of comments on a task
     *
     * @param companyId - Company ID
     * @param taskId - Task ID
     * @param groupId - Optional enterprise group ID for multi-tenant path
     * @returns Number of comments
     */
    static async getCommentCount(
        companyId: string,
        taskId: string,
        groupId?: string
    ): Promise<number> {
        try {
            const comments = await this.getTaskComments(companyId, taskId, groupId)
            return comments.length
        } catch (error) {
            console.error('❌ Error getting comment count:', error)
            return 0
        }
    }

    // ============================================================================
    // UTILITY: Check if user can edit/delete comment
    // ============================================================================

    /**
     * Check if a user has permission to edit/delete a comment
     *
     * @param companyId - Company ID
     * @param taskId - Task ID
     * @param commentId - Comment ID
     * @param userId - User ID to check
     * @param groupId - Optional enterprise group ID for multi-tenant path
     * @returns True if user can edit/delete
     */
    static async canModifyComment(
        companyId: string,
        taskId: string,
        commentId: string,
        userId: string,
        groupId?: string
    ): Promise<boolean> {
        try {
            const comment = await this.getComment(companyId, taskId, commentId, groupId)

            if (!comment) {
                return false
            }

            // Only the comment author can modify
            return comment.userId === userId

        } catch (error) {
            console.error('❌ Error checking comment permissions:', error)
            return false
        }
    }
}
