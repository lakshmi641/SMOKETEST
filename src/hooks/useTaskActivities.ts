import { useState, useEffect, useMemo } from 'react'
import type { GeneratedTask } from '@/types/task-template-schema'

export interface TaskActivity {
  id: string
  userName: string
  userAvatar?: string
  action: 'created' | 'updated' | 'completed'
  resourceTitle: string
  createdAt: string
}

export function useTaskActivities(
  tasks: GeneratedTask[],
  projectUsers: any[],
  currentUserId?: string
) {
  const [activities, setActivities] = useState<TaskActivity[]>([])

  useEffect(() => {
    if (tasks.length === 0) {
      setActivities([])
      return
    }

    const getUserDetails = (userId?: string) => {
      if (!userId) return { name: undefined, avatar: undefined }

      // Check if it's the current user
      if (currentUserId && userId === currentUserId) {
        const currentUser = projectUsers.find(u => u.id === currentUserId)
        return { 
          name: 'You', 
          avatar: currentUser?.avatar || undefined 
        }
      }

      const user = projectUsers.find(u => u.id === userId)
      if (user) {
        return {
          name: user.name || user.email || 'User',
          avatar: user.avatar || undefined
        }
      }
      return { name: 'User', avatar: undefined }
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentActivities: TaskActivity[] = []

    // 1. Recently CREATED tasks (last 7 days)
    const recentlyCreatedTasks = tasks
      .filter((t: any) => t.createdAt && new Date(t.createdAt) > sevenDaysAgo)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)

    recentlyCreatedTasks.forEach((task: any) => {
      const creator = getUserDetails(task.reporter || task.assignedBy)
      recentActivities.push({
        id: `task-created-${task.id}`,
        userName: creator.name || 'User',
        userAvatar: creator.avatar,
        action: 'created',
        resourceTitle: task.title,
        createdAt: task.createdAt,
      })
    })

    // 2. Recently COMPLETED tasks (last 7 days)
    const recentlyCompletedTasks = tasks
      .filter((t: any) => t.status === 'completed' && t.updatedAt && new Date(t.updatedAt) > sevenDaysAgo)
      .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)

    recentlyCompletedTasks.forEach((task: any) => {
      const completer = getUserDetails(task.assignedUserId)
      recentActivities.push({
        id: `task-completed-${task.id}`,
        userName: completer.name || 'User',
        userAvatar: completer.avatar,
        action: 'completed',
        resourceTitle: task.title,
        createdAt: task.updatedAt,
      })
    })

    // 3. Recently UPDATED tasks (last 7 days, excluding completed)
    const recentlyUpdatedTasks = tasks
      .filter((t: any) => {
        if (t.status === 'completed' || !t.updatedAt) return false
        const updatedTime = new Date(t.updatedAt).getTime()
        const createdTime = new Date(t.createdAt).getTime()
        return updatedTime > sevenDaysAgo.getTime() && Math.abs(updatedTime - createdTime) > 1000
      })
      .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 10)

    recentlyUpdatedTasks.forEach((task: any) => {
      const updater = getUserDetails(task.assignedUserId)
      recentActivities.push({
        id: `task-updated-${task.id}`,
        userName: updater.name || 'User',
        userAvatar: updater.avatar,
        action: 'updated',
        resourceTitle: task.title,
        createdAt: task.updatedAt,
      })
    })

    // Sort all activities by timestamp
    const sortedActivities = recentActivities
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20)

    setActivities(sortedActivities)
  }, [tasks, projectUsers, currentUserId])

  return activities
}

