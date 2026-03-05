import { useMemo } from 'react'
import type { GeneratedTask } from '@/types/task-template-schema'

export function useProjectStats(tasks: GeneratedTask[]) {
  const stats = useMemo(() => {
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const completedLast7Days = tasks.filter(t =>
      t.status === 'completed' &&
      t.completedAt &&
      new Date(t.completedAt) >= sevenDaysAgo
    ).length

    const updatedLast7Days = tasks.filter(t =>
      t.updatedAt &&
      new Date(t.updatedAt) >= sevenDaysAgo
    ).length

    const createdLast7Days = tasks.filter(t =>
      t.createdAt &&
      new Date(t.createdAt) >= sevenDaysAgo
    ).length

    const dueSoon = tasks.filter(t =>
      t.status !== 'completed' &&
      t.dueDate &&
      new Date(t.dueDate) <= sevenDaysFromNow &&
      new Date(t.dueDate) >= now
    ).length

    const tasksByStatus = {
      open: tasks.filter(t => t.status === 'open').length,
      assigned: tasks.filter(t => t.status === 'assigned').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      on_hold: tasks.filter(t => t.status === 'on_hold').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      cancelled: tasks.filter(t => t.status === 'cancelled').length,
    }

    const totalTasks = tasks.length

    return {
      completedLast7Days,
      updatedLast7Days,
      createdLast7Days,
      dueSoon,
      tasksByStatus,
      totalTasks,
    }
  }, [tasks])

  return stats
}

