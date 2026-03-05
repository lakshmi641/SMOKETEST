'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '../../store/authStore'
import { useCompany } from '../../contexts/CompanyContext'
import { useWorkspace } from '../../contexts/WorkspaceContext'
import { useCompanyConfig } from '../../hooks/useCompanyConfig'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Building2, BarChart3, CheckSquare, FolderKanban, Users } from 'lucide-react'
import { WorkspaceService, TaskTemplateService, UserService, ActivityService } from '../../lib/services'
import { formatDate } from '@/lib/utils/date-utils'
import toast from 'react-hot-toast'
import type { Activity } from '@/types/activity-schema'
import { useProjectsQuery } from '@/hooks/queries/useProjectQueries'

interface DashboardMetrics {
  activeWorkspaces: number
  totalWorkspaces: number
  activeProjects: number
  totalProjects: number
  totalUsers: number
  pendingTasks: number
  completedTasks: number
  // Quick Stats metrics
  overdueTasks: number
  tasksDueThisWeek: number
  atRiskProjects: number
  completedLast7Days: number
}

// Map activity types to UI-friendly text
const getActivityTitle = (activity: Activity, currentUserId?: string): string => {
  const { type, entityName, actorId, recipientId } = activity

  // Specific check: If I am the recipient, say "to you"
  const isRecipient = currentUserId && recipientId === currentUserId;
  const isSelf = currentUserId && actorId === currentUserId;

  switch (type) {
    case 'workspace_created':
      return `created workspace "${entityName}"`
    case 'workspace_updated':
      return `updated workspace "${entityName}"`
    case 'project_created':
      return `created project "${entityName}"`
    case 'project_updated':
      return `updated project "${entityName}"`

    case 'task_created':
      if (isRecipient && !isSelf) return `assigned a task to you: "${entityName}"`
      return `created task "${entityName}"`

    case 'task_updated':
      if (isRecipient && !isSelf) return `updated your task "${entityName}"`
      return `updated task "${entityName}"`

    case 'task_completed':
      if (isRecipient && !isSelf) return `completed your task "${entityName}"`
      return `completed task "${entityName}"`

    case 'task_assigned':
      if (isRecipient && !isSelf) return `assigned task "${entityName}" to you`
      return `assigned task "${entityName}"`

    case 'task_escalated':
      return `escalated task "${entityName}"`
    case 'profile_updated':
      return `updated their profile`
    default:
      return `acted on ${entityName}`
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { companyId, groupId } = useCompany()
  const { selectedWorkspace, workspaces } = useWorkspace()
  const companyConfig = useCompanyConfig()

  const { currentCompanyUser } = useCompany()
  const isAdmin = currentCompanyUser?.role === 'owner' || currentCompanyUser?.role === 'admin'
  const { data: allProjectsData = [] } = useProjectsQuery(
    companyId ?? undefined,
    groupId ?? undefined,
    user?.id,
    isAdmin
  )
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  const loadDashboardData = useCallback(async () => {
    if (!companyId || !user?.id) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      // Check if user is admin to determine task scope
      const isAdmin = user?.role === 'admin'

      // Fetch all data in parallel for performance (projects from useProjectsQuery)
      const [allWorkspacesData, allTasksData, usersData, personalActivities] = await Promise.all([
        WorkspaceService.getWorkspaces(companyId, { status: 'active' }).catch(() => []),
        // Admin sees ALL company tasks, regular users see only their tasks
        isAdmin
          ? (async () => {
            const allTasks: any[] = []
            for (const project of allProjectsData) {
              const projectTasks = await TaskTemplateService.getProjectTasks(companyId, project.id).catch(() => [])
              allTasks.push(...projectTasks)
            }
            return allTasks
          })()
          : TaskTemplateService.getUserTasks(companyId, user.id).catch(() => []),
        UserService.getUsers(companyId, groupId ?? undefined).catch(() => []),
        ActivityService.getPersonalActivities(groupId ?? companyId, companyId, user.id).catch(() => [])
      ])

      // Filter by selected workspace if one is selected
      let projectsData = allProjectsData
      let workspacesData = allWorkspacesData

      if (selectedWorkspace) {
        projectsData = allProjectsData.filter((p: any) => p.workspaceId === selectedWorkspace.id)
        workspacesData = [selectedWorkspace]
      }

      // Calculate metrics from real data with CORRECT task statuses
      const activeProjects = projectsData.filter((p: any) => p.status === 'active')

      // ✅ FIX: Use correct task status values: 'assigned', 'in_progress', 'escalated'
      const pendingTasks = allTasksData.filter((t: any) =>
        t.status === 'assigned' || t.status === 'in_progress' || t.status === 'escalated'
      )
      const completedTasks = allTasksData.filter((t: any) =>
        t.status === 'completed'
      )

      // Calculate Quick Stats metrics
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const oneWeekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

      // Overdue tasks - tasks with due date in the past and not completed
      const overdueTasks = allTasksData.filter((t: any) => {
        if (t.status === 'completed' || t.status === 'cancelled') return false
        if (!t.dueDate) return false
        const dueDate = new Date(t.dueDate)
        return dueDate < today
      })

      // Tasks due this week
      const tasksDueThisWeek = allTasksData.filter((t: any) => {
        if (t.status === 'completed' || t.status === 'cancelled') return false
        if (!t.dueDate) return false
        const dueDate = new Date(t.dueDate)
        return dueDate >= today && dueDate <= oneWeekFromNow
      })

      // At-risk projects - projects with overdue tasks or low progress
      const atRiskProjects = projectsData.filter((p: any) => {
        // Get tasks for this project
        const projectTasks = allTasksData.filter((t: any) => t.projectId === p.id)
        const projectOverdueTasks = projectTasks.filter((t: any) => {
          if (t.status === 'completed' || t.status === 'cancelled') return false
          if (!t.dueDate) return false
          const dueDate = new Date(t.dueDate)
          return dueDate < today
        })

        // At risk if: has overdue tasks OR (active project with progress < 20% and past start date)
        const hasOverdueTasks = projectOverdueTasks.length > 0
        const lowProgress = p.status === 'active' && (p.progress || 0) < 20 && p.startDate && new Date(p.startDate) < today

        return hasOverdueTasks || lowProgress
      })

      // Completed in last 7 days
      const completedLast7Days = allTasksData.filter((t: any) => {
        if (t.status !== 'completed') return false
        if (!t.completedAt && !t.updatedAt) return false
        const completedDate = new Date(t.completedAt || t.updatedAt)
        return completedDate >= sevenDaysAgo
      })

      const calculatedMetrics: DashboardMetrics = {
        activeWorkspaces: workspacesData.length,
        totalWorkspaces: allWorkspacesData.length,
        activeProjects: activeProjects.length,
        totalProjects: projectsData.length,
        totalUsers: usersData.length,
        pendingTasks: pendingTasks.length,
        completedTasks: completedTasks.length,
        // Quick Stats
        overdueTasks: overdueTasks.length,
        tasksDueThisWeek: tasksDueThisWeek.length,
        atRiskProjects: atRiskProjects.length,
        completedLast7Days: completedLast7Days.length,
      }

      setMetrics(calculatedMetrics)

      // Enhance activities with actor names if available in users list
      const enhancedActivities = personalActivities.map(activity => {
        const actor = usersData.find((u: any) => u.id === activity.actorId)
        return {
          ...activity,
          actorName: actor?.name || actor?.email || 'User',
          actorAvatar: actor?.avatar
        }
      })

      setActivities(enhancedActivities)

    } catch (error) {
      console.error('Error loading dashboard data:', error)
      toast.error('Failed to load some dashboard data')
    } finally {
      setLoading(false)
    }
  }, [companyId, groupId, user?.id, selectedWorkspace, user?.role, allProjectsData])

  // Initial load
  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  // Listen for events to reload data
  useEffect(() => {
    const handleRefresh = () => {
      console.log('Refreshing dashboard data due to event...')
      loadDashboardData()
    }

    // Still useful for metrics updates
    window.addEventListener('project-created', handleRefresh)
    window.addEventListener('task-created', handleRefresh)
    window.addEventListener('task-updated', handleRefresh)

    return () => {
      window.removeEventListener('project-created', handleRefresh)
      window.removeEventListener('task-created', handleRefresh)
      window.removeEventListener('task-updated', handleRefresh)
    }
  }, [loadDashboardData])

  // Helper function to format relative time
  const getRelativeTime = (timestamp: string) => {
    const now = new Date()
    const past = new Date(timestamp)
    const diffMs = now.getTime() - past.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    if (diffDays === 1) return '1 day ago'
    if (diffDays < 30) return `${diffDays} days ago`
    return formatDate(past)
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh]"></div>
      </DashboardLayout>
    )
  }

  const getActorNameDisplay = (actorId: string, actorName?: string) => {
    if (actorId === user?.id) return 'You';
    return actorName || 'User';
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Welcome back, {user?.name || 'User'}!</h1>
          <p className="text-muted-foreground text-lg">
            {selectedWorkspace
              ? `Managing ${selectedWorkspace.name} workspace`
              : `Manage ${companyConfig.name} administration and operations`}
          </p>
        </div>

        {/* KPI Card - My Pending Tasks */}
        {metrics && (
          <div className="max-w-sm">
            <div className="bg-card rounded-lg p-6 card-shadow hover:shadow-md transition-shadow border border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <CheckSquare className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">My Pending Tasks</h3>
              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-1">{metrics.pendingTasks}</p>
              <p className="text-xs text-muted-foreground">{metrics.completedTasks} completed</p>
            </div>
          </div>
        )}

        {/* Recent Activity Section */}
        <div>
          <div className="grid grid-cols-1 gap-6">
            {/* Recent Activity - Real Data */}
            <div className="bg-card rounded-lg p-6 card-shadow border border-border">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-foreground">Recent Activity</h2>
                <BarChart3 className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="space-y-4">
                {activities.length > 0 ? (
                  activities.map((activity) => {
                    const iconConfig = {
                      project: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', Icon: Building2 },
                      task: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', Icon: CheckSquare },
                      user: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', Icon: Users },
                      workspace: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400', Icon: FolderKanban },
                    }
                    const config = iconConfig[activity.entityType] || iconConfig.task // Default
                    const IconComponent = config.Icon

                    return (
                      <div key={activity.id} className="flex items-start space-x-4 p-4 hover:bg-muted/50 rounded-lg transition-colors">
                        {activity.actorAvatar ? (
                          <img
                            src={activity.actorAvatar}
                            alt={activity.actorName}
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                          />
                        ) : activity.actorName && activity.actorName !== 'User' ? (
                          <div className="w-10 h-10 bg-blue-500 dark:bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                            {activity.actorName.charAt(0).toUpperCase()}
                          </div>
                        ) : (
                          <div className={`w-10 h-10 ${config.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                            <IconComponent className={`w-5 h-5 ${config.text}`} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground mb-1">
                            <span className="text-blue-600 dark:text-blue-400">
                              {getActorNameDisplay(activity.actorId, activity.actorName)}
                            </span>{' '}
                            {getActivityTitle(activity, user?.id)}
                          </p>
                          <p className="text-xs text-muted-foreground">{getRelativeTime(activity.timestamp)}</p>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-12">
                    <BarChart3 className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No recent activity to display</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Activities will appear here when you create workspaces, projects, or tasks</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

