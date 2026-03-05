import { useState, useEffect, useCallback } from 'react'
import { TaskTemplateService } from '@/lib/services/tasks/task-template-service'
import type { GeneratedTask } from '@/types/task-template-schema'
import { logger } from '@/lib/logger'
import toast from 'react-hot-toast'
import { useUIStore } from '@/store/uiStore'
export function useProjectTasks(
  companyId: string | undefined | null,
  projectId: string,
  tasks: GeneratedTask[],
  setTasks: React.Dispatch<React.SetStateAction<GeneratedTask[]>>,
  groupId?: string | null,
  isAdmin?: boolean
) {
  const requestCreateTask = useUIStore(s => s.requestCreateTask)
  const [selectedTask, setSelectedTask] = useState<GeneratedTask | null>(null)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [deleteTaskDialog, setDeleteTaskDialog] = useState<{
    open: boolean
    task: GeneratedTask | null
  }>({ open: false, task: null })

  // Listen for task created events from global Create Task button
  useEffect(() => {
    const handleTaskCreated = async (event: any) => {
      const newTask = event.detail?.task

      // ✅ CRITICAL FIX: If we have the complete task object with taskNumber, update immediately
      if (newTask && newTask.projectId === projectId) {
        // Check if this is a complete task object with taskNumber (sequential ID)
        const hasCompleteData = newTask.id && newTask.taskNumber !== undefined

        if (hasCompleteData) {
          // Immediate state update - no delay, no reload needed
          setTasks(prev => {
            // Check if task already exists to avoid duplicates
            if (prev.some(t => t.id === newTask.id)) return prev

            // Add new task at the beginning (newest first)
            return [newTask, ...prev]
          })

          // ✅ Show success toast with the sequential ID
          toast.success(`Task ${newTask.projectCode || 'TASK'}-${newTask.taskNumber} created successfully`, {
            duration: 3000
          })

          return // Exit early - no need to reload
        }
      }

      // Fallback: Only reload if we don't have complete task data
      // This handles edge cases where the event doesn't include the full task object
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Reload tasks for this project silently (no loading spinner)
      const loadProjectTasks = async () => {
        if (!companyId || !projectId) return
        try {
          const svc: any = TaskTemplateService as any
          let projectTasks: GeneratedTask[] = []
          if (typeof svc.getProjectTasks === 'function') {
            projectTasks = await svc.getProjectTasks(companyId, projectId, groupId ?? undefined)
          } else {
            const all = await TaskTemplateService.getUserTasks(companyId, '')
            projectTasks = all.filter(t => (t as any).projectId === projectId)
          }
          // Sort by creation date desc (newest first)
          projectTasks.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0).getTime()
            const dateB = new Date(b.createdAt || 0).getTime()
            return dateB - dateA
          })
          setTasks(projectTasks)
        } catch (error) {
          logger.error('Error reloading tasks:', error)
        }
      }

      await loadProjectTasks()
    }

    window.addEventListener('taskCreated', handleTaskCreated)
    return () => window.removeEventListener('taskCreated', handleTaskCreated)
  }, [companyId, projectId, setTasks])

  const updateTaskStatus = useCallback(async (taskId: string, status: GeneratedTask['status'], currentUserId?: string) => {
    if (!companyId) return

    // Status updates are allowed for all users as per request

    try {
      await TaskTemplateService.updateTaskStatus(companyId, taskId, status, undefined, undefined, false, groupId ?? undefined)
      setTasks(prev => prev.map(task => task.id === taskId ? { ...task, status } : task))

      // Format status name for display (e.g., "in_progress" -> "In Progress")
      const statusDisplayName = status
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
      toast.success(`Status changed to ${statusDisplayName}`)
    } catch (error) {
      logger.error('Error updating task status:', error)
      toast.error('Failed to update task status')
    }
  }, [companyId, groupId, tasks, setTasks])

  const handleViewTask = useCallback((task: GeneratedTask) => {
    setSelectedTask(task)
    setTaskDialogOpen(true)
  }, [])

  const handleTaskUpdate = useCallback(async (updatedTask: GeneratedTask, currentUserId?: string) => {
    if (!companyId) return

    // Permission check: Only creator (reporter) can update, unless admin
    const taskBeforeUpdate = tasks.find(t => t.id === updatedTask.id)
    const isCreator = taskBeforeUpdate?.reporter === currentUserId

    if (!isCreator && !isAdmin) {
      toast.error('You can only edit tasks created by you')
      return
    }

    try {
      const now = new Date().toISOString()

      // Set completedAt if status is changing to completed
      const isBecomingCompleted = updatedTask.status === 'completed' &&
        tasks.find(t => t.id === updatedTask.id)?.status !== 'completed'

      const updatePayload = {
        title: updatedTask.title,
        description: updatedTask.description,
        priority: updatedTask.priority,
        dueDate: updatedTask.dueDate,
        estimatedHours: updatedTask.estimatedHours,
        definitionOfDone: updatedTask.definitionOfDone,
        progress: updatedTask.progress,
        assignedUserId: updatedTask.assignedUserId,
        assignedTo: updatedTask.assignedUserId,
        assignedPositionId: updatedTask.assignedPositionId,
        assignedToName: updatedTask.assignedToName,
        reporter: updatedTask.reporter,
        reporterPositionId: updatedTask.reporterPositionId,
        updatedAt: now,
        ...(isBecomingCompleted && { completedAt: now })
      } as any

      await TaskTemplateService.updateTaskStatus(companyId, updatedTask.id, updatedTask.status, updatePayload, undefined, false, groupId ?? undefined)

      // Update local state with completedAt if applicable
      const taskToUpdate = isBecomingCompleted
        ? { ...updatedTask, completedAt: now, updatedAt: now }
        : { ...updatedTask, updatedAt: now }

      setTasks(prev => prev.map(t => t.id === updatedTask.id ? taskToUpdate : t))
      setSelectedTask(taskToUpdate)
    } catch (error) {
      logger.error('Error updating task:', error)
      toast.error('Failed to update task')
    }
  }, [companyId, groupId, tasks, setTasks])

  const handleCreateTask = useCallback(() => {
    if (!projectId) return
    requestCreateTask(projectId)
  }, [projectId, requestCreateTask])

  const handleDeleteTaskClick = useCallback((task: GeneratedTask, e: React.MouseEvent, currentUserId?: string) => {
    e.stopPropagation()

    // Permission check: Only creator (reporter) can delete, unless admin
    const isCreator = task.reporter === currentUserId

    if (isCreator || isAdmin) {
      setDeleteTaskDialog({ open: true, task })
    } else {
      toast.error('You can only delete tasks created by you')
    }
  }, [])

  const handleDeleteTaskConfirm = useCallback(async () => {
    if (!deleteTaskDialog.task || !companyId) return

    try {
      await TaskTemplateService.deleteTask(companyId, deleteTaskDialog.task.id!, groupId ?? undefined)

      setTasks(prev => prev.filter(t => t.id !== deleteTaskDialog.task!.id))
      toast.success('Task deleted successfully')
      setDeleteTaskDialog({ open: false, task: null })
    } catch (error) {
      logger.error('Error deleting task:', error)
      toast.error('Failed to delete task')
    }
  }, [companyId, groupId, deleteTaskDialog, setTasks])

  return {
    selectedTask,
    setSelectedTask,
    taskDialogOpen,
    setTaskDialogOpen,
    deleteTaskDialog,
    setDeleteTaskDialog,
    updateTaskStatus,
    handleViewTask,
    handleTaskUpdate,
    handleCreateTask,
    handleDeleteTaskClick,
    handleDeleteTaskConfirm,
    requestCreateTask,
  }
}

