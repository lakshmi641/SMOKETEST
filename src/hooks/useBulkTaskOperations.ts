import { useState, useCallback } from 'react'
import { TaskTemplateService } from '@/lib/services/tasks/task-template-service'
import type { GeneratedTask } from '@/types/task-template-schema'
import { logger } from '@/lib/logger'
import toast from 'react-hot-toast'
import type { MemberSelection } from '@/components/common/MemberSelect'

export function useBulkTaskOperations(
  companyId: string | undefined | null,
  tasks: GeneratedTask[],
  setTasks: React.Dispatch<React.SetStateAction<GeneratedTask[]>>,
  groupId?: string | null,
  isAdmin?: boolean
) {
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())

  const handleSelectAll = useCallback((checked: boolean, availableTasks: GeneratedTask[]) => {
    if (checked) {
      setSelectedTaskIds(new Set(availableTasks.map(t => t.id)))
    } else {
      setSelectedTaskIds(new Set())
    }
  }, [])

  const handleSelectTask = useCallback((taskId: string, checked: boolean) => {
    setSelectedTaskIds(prev => {
      const newSelection = new Set(prev)
      if (checked) {
        newSelection.add(taskId)
      } else {
        newSelection.delete(taskId)
      }
      return newSelection
    })
  }, [])

  const handleBulkStatusChange = useCallback(async (status: GeneratedTask['status'], currentUserId?: string) => {
    if (!companyId || selectedTaskIds.size === 0) return

    try {
      const tasksToUpdate = tasks.filter(t => selectedTaskIds.has(t.id))
      const updates = tasksToUpdate.map(task =>
        TaskTemplateService.updateTaskStatus(companyId, task.id, status, undefined, undefined, false, groupId ?? undefined)
      )
      await Promise.all(updates)

      setTasks(prev => prev.map(task =>
        selectedTaskIds.has(task.id) ? { ...task, status } : task
      ))

      toast.success(`Updated ${tasksToUpdate.length} task(s)`)
      setSelectedTaskIds(new Set())
    } catch (error) {
      logger.error('Error updating tasks:', error)
      toast.error('Failed to update tasks')
    }
  }, [companyId, groupId, selectedTaskIds, tasks, setTasks])


  const handleBulkAssigneeChange = useCallback(async (selection: MemberSelection, currentUserId?: string) => {
    if (!companyId || selectedTaskIds.size === 0 || !selection) return

    try {
      const assignedUserId = (selection.type === 'user' ? selection.id : selection.userId) || ''
      const assignedPositionId = selection.type === 'position' ? selection.id : undefined
      // MemberSelect returns label as "Position Title | User Name" usually.
      const assignedToName = selection.label

      const tasksToUpdate = tasks.filter(t => selectedTaskIds.has(t.id))
      const ownTasks = tasksToUpdate.filter(t => t.reporter === currentUserId || isAdmin)
      const otherTasksCount = isAdmin ? 0 : tasksToUpdate.length - ownTasks.length

      if (ownTasks.length === 0 && !isAdmin) {
        toast.error('You can only change assignee for tasks created by you')
        return
      }

      const updates = ownTasks.map(task =>
        TaskTemplateService.updateTaskStatus(companyId, task.id, task.status || 'assigned', {
          assignedUserId: assignedUserId,
          assignedTo: assignedUserId, // Sync assignedTo with assignedUserId
          assignedPositionId: assignedPositionId,
          assignedToName: assignedToName
        } as any, undefined, false, groupId ?? undefined)
      )
      await Promise.all(updates)

      setTasks(prev => prev.map(task =>
        (selectedTaskIds.has(task.id) && task.reporter === currentUserId) ? {
          ...task,
          assignedUserId: assignedUserId,
          assignedTo: assignedUserId,
          assignedPositionId: assignedPositionId,
          assignedToName: assignedToName
        } : task
      ))

      if (otherTasksCount > 0) {
        toast.success(`Updated ${ownTasks.length} task(s). Skipped ${otherTasksCount} task(s) created by others.`)
      } else {
        toast.success(`Updated ${ownTasks.length} task(s)`)
      }
      setSelectedTaskIds(new Set())
    } catch (error) {
      logger.error('Error updating tasks:', error)
      toast.error('Failed to update tasks')
    }
  }, [companyId, groupId, selectedTaskIds, tasks, setTasks])

  const handleBulkDelete = useCallback(async (currentUserId?: string) => {
    if (!companyId || selectedTaskIds.size === 0) return

    const tasksToDelete = tasks.filter(t => selectedTaskIds.has(t.id))
    const ownTasks = tasksToDelete.filter(t => t.reporter === currentUserId || isAdmin)
    const otherTasksCount = isAdmin ? 0 : tasksToDelete.length - ownTasks.length

    if (ownTasks.length === 0 && !isAdmin) {
      toast.error('You can only delete tasks created by you')
      return
    }

    if (!confirm(`Are you sure you want to delete ${ownTasks.length} task(s)${otherTasksCount > 0 ? ` (skipped ${otherTasksCount} tasks created by others)` : ''}?`)) return

    try {
      const deletes = ownTasks.map(task =>
        TaskTemplateService.deleteTask(companyId, task.id, groupId ?? undefined)
      )
      await Promise.all(deletes)

      setTasks(prev => prev.filter(task => !(selectedTaskIds.has(task.id) && task.reporter === currentUserId)))

      if (otherTasksCount > 0) {
        toast.success(`Deleted ${ownTasks.length} task(s). Skipped ${otherTasksCount} task(s) created by others.`)
      } else {
        toast.success(`Deleted ${ownTasks.length} task(s)`)
      }
      setSelectedTaskIds(new Set())
    } catch (error) {
      logger.error('Error deleting tasks:', error)
      toast.error('Failed to delete tasks')
    }
  }, [companyId, groupId, selectedTaskIds, setTasks])

  return {
    selectedTaskIds,
    setSelectedTaskIds,
    handleSelectAll,
    handleSelectTask,
    handleBulkStatusChange,
    handleBulkAssigneeChange,
    handleBulkDelete,
  }
}

