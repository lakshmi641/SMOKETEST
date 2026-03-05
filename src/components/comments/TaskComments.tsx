'use client'

import React, { useState, useEffect } from 'react'
import { TaskCommentService } from '@/lib/services/tasks/task-comment-service'
import { UserService } from '@/lib/services/users/user-services'
import type { TaskComment, CommentAttachment } from '@/types/task-comment'
import type { User } from '@/types'
import { CommentItem } from './CommentItem'
import { CommentForm } from './CommentForm'
import { MessageSquare, Loader2 } from 'lucide-react'

interface TaskCommentsProps {
  companyId: string
  taskId: string
  groupId?: string | null
  currentUserId: string
  currentUserName: string
  currentUserEmail: string
  currentUserAvatar?: string
  project?: any | null
  reporterId?: string
  workspaceMembers?: string[]
}

export function TaskComments({
  companyId,
  taskId,
  groupId,
  currentUserId,
  currentUserName,
  currentUserEmail,
  currentUserAvatar,
  project,
  reporterId,
  workspaceMembers
}: TaskCommentsProps) {
  const [comments, setComments] = useState<TaskComment[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadData()
  }, [companyId, taskId, groupId])

  async function loadData() {
    try {
      setLoading(true)
      setError(null)

      const [commentsData, usersData] = await Promise.all([
        TaskCommentService.getTaskComments(companyId, taskId, groupId ?? undefined),
        UserService.getUsers(companyId, groupId ?? undefined)
      ])


      let filteredUsers = usersData
      if (project) {
        const allowedIds = new Set([
          ...(project.manager ? [project.manager] : []),
          ...(project.createdBy ? [project.createdBy] : []),
          ...(project.team || []),
          ...(reporterId ? [reporterId] : []),
          ...(project.projectType === 'rft' ? (workspaceMembers || []) : [])
        ])
        filteredUsers = usersData.filter(u => allowedIds.has(u.id))
      }

      setComments(commentsData)
      setAllUsers(filteredUsers)

    } catch (err) {
      console.error('Error loading comments:', err)
      setError('Failed to load comments. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(
    text: string,
    plainText: string,
    mentions: string[],
    attachments: CommentAttachment[] = []
  ) {
    try {
      setSubmitting(true)
      setError(null)

      const newCommentId = await TaskCommentService.createComment(
        companyId,
        taskId,
        {
          userId: currentUserId,
          userName: currentUserName,
          userEmail: currentUserEmail,
          userAvatar: currentUserAvatar,
          text,
          plainText,
          mentions,
          attachments
        },
        groupId ?? undefined
      )

      // Optimistic update: Add new comment to list immediately
      const newComment: TaskComment = {
        id: newCommentId,
        companyId,
        taskId,
        userId: currentUserId,
        userName: currentUserName,
        userEmail: currentUserEmail,
        userAvatar: currentUserAvatar,
        text,
        plainText,
        mentions,
        attachments,
        isEdited: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      setComments(prev => [...prev, newComment])

    } catch (err) {
      console.error('Error creating comment:', err)
      setError('Failed to create comment. Please try again.')
      // Revert on error (reload data)
      await loadData()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEdit(
    commentId: string,
    text: string,
    plainText: string,
    mentions: string[],
    attachments: CommentAttachment[] = []
  ) {
    try {
      setError(null)

      // Optimistic update
      setComments(prev => prev.map(c =>
        c.id === commentId
          ? { ...c, text, plainText, mentions, attachments, isEdited: true, editedAt: new Date().toISOString() }
          : c
      ))

      await TaskCommentService.updateComment(
        companyId,
        taskId,
        commentId,
        { text, plainText, mentions, attachments },
        currentUserId,
        groupId ?? undefined
      )

    } catch (err) {
      console.error('Error updating comment:', err)
      setError('Failed to update comment. Please try again.')
      // Revert on error
      await loadData()
    }
  }

  async function handleDelete(commentId: string) {
    // No native confirm here - handled by UI component

    try {
      setError(null)

      // Optimistic update
      setComments(prev => prev.filter(c => c.id !== commentId))

      await TaskCommentService.deleteComment(
        companyId,
        taskId,
        commentId,
        currentUserId,
        groupId ?? undefined
      )

    } catch (err) {
      console.error('Error deleting comment:', err)
      setError('Failed to delete comment. Please try again.')
      // Revert on error
      await loadData()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading comments...</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 pb-2 border-b">
        <MessageSquare className="h-4 w-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-700">
          Comments
        </h3>
        <span className="text-xs text-gray-400">({comments.length})</span>
      </div>

      {error && (
        <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700 border border-red-200">
          {error}
        </div>
      )}

      <CommentForm
        allUsers={allUsers}
        onSubmit={handleSubmit}
        submitting={submitting}
        taskId={taskId}
      />

      <div className="space-y-0 divide-y divide-gray-100">
        {comments.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <MessageSquare className="h-8 w-8 mx-auto mb-1.5 text-gray-300" />
            <p className="text-xs font-medium">No comments yet</p>
            <p className="text-xs mt-0.5 text-gray-400">Be the first to comment!</p>
          </div>
        ) : (
          comments.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              allUsers={allUsers}
              currentUserId={currentUserId}
              taskId={taskId}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  )
}
