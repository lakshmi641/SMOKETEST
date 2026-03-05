import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import {
  ProjectService,
  TaskTemplateService,
  UserService,
  WorkspaceService,
} from '@/lib/services'
import { Taskservice } from '@/lib/services/tasks/generated-task-service'
import { TaskMasterDataService } from '@/lib/services/tasks/task-master-data-service'
import { detectGhostForTask } from '@/lib/services/ghost-workflow-service'
import { EnhancedProject } from '@/types/project-schema'
import type { GeneratedTask } from '@/types/task-template-schema'
import { logger } from '@/lib/logger'
import toast from 'react-hot-toast'

const DEFAULT_STATUS_OPTIONS = [
  { code: 'open', name: 'Open', color: '#94a3b8' },
  { code: 'assigned', name: 'Assigned', color: '#2563eb' },
  { code: 'in_progress', name: 'In Progress', color: '#3b82f6' },
  { code: 'on_hold', name: 'On Hold', color: '#f59e0b' },
  { code: 'approval_required', name: 'Approval Required', color: '#6366f1' },
  { code: 'completed', name: 'Completed', color: '#22c55e' },
  { code: 'cancelled', name: 'Cancelled', color: '#ef4444' },
] as const

export function useProjectData(
  companyId: string | undefined | null,
  projectId: string,
  isGlobalAdmin: boolean = false,
  groupId: string | undefined | null = undefined
) {
  const router = useRouter()
  const [project, setProject] = useState<EnhancedProject | null>(null)
  const [tasks, setTasks] = useState<GeneratedTask[]>([])
  const [loading, setLoading] = useState(true)
  const [statusMetadata, setStatusMetadata] = useState<Array<{ code: string; name: string; color?: string }>>(
    DEFAULT_STATUS_OPTIONS.slice()
  )
  const [loadingStatuses, setLoadingStatuses] = useState(false)
  const [projectUsers, setProjectUsers] = useState<any[]>([])
  const [workspaceName, setWorkspaceName] = useState<string>('Default')
  const [workspace, setWorkspace] = useState<any>(null)

  // ... (rest of the code update - will use multi_replace for accuracy)

  // Load task statuses - merge Firestore statuses with system defaults
  const loadTaskStatuses = useCallback(async (companyId: string) => {
    try {
      setLoadingStatuses(true)
      const statuses = await TaskMasterDataService.getTaskStatuses(companyId, groupId ?? undefined)

      // Start with system default statuses
      const statusMap = new Map<string, { code: string; name: string; color?: string }>()
      DEFAULT_STATUS_OPTIONS.forEach(status => {
        statusMap.set(status.code, { code: status.code, name: status.name, color: status.color })
      })

      // Override with Firestore statuses (allows customization of names/colors)
      if (statuses.length > 0) {
        statuses.forEach(status => {
          statusMap.set(status.code, {
            code: status.code,
            name: status.name,
            color: status.color,
          })
        })
      }

      // Convert map to array maintaining order from DEFAULT_STATUS_OPTIONS first, then any custom ones
      const mergedStatuses: Array<{ code: string; name: string; color?: string }> = []
      DEFAULT_STATUS_OPTIONS.forEach(status => {
        const merged = statusMap.get(status.code)
        if (merged) mergedStatuses.push(merged)
      })
      // Add any custom statuses not in defaults
      statuses.forEach(status => {
        if (!DEFAULT_STATUS_OPTIONS.some(d => d.code === status.code)) {
          mergedStatuses.push({ code: status.code, name: status.name, color: status.color })
        }
      })

      setStatusMetadata(mergedStatuses)
    } catch (error) {
      logger.error('Error loading task statuses:', error)
      setStatusMetadata(DEFAULT_STATUS_OPTIONS.slice())
    } finally {
      setLoadingStatuses(false)
    }
  }, [groupId])

  const parseDate = (val: any) => {
    if (!val) return 0
    if (typeof val.toDate === 'function') return val.toDate().getTime()
    const d = new Date(val)
    return isNaN(d.getTime()) ? 0 : d.getTime()
  }

  // Helper to filter tasks based on RFT Target/Source Team rules
  const filterRftTasks = useCallback(async (projectTasks: GeneratedTask[], currentProject: EnhancedProject) => {
    const userId = useAuthStore.getState().user?.id;
    const isRftProject = currentProject.projectType === 'rft' || (currentProject.name && !!currentProject.name.match(/RFT/i));
    if (!companyId || !isRftProject || isGlobalAdmin || !userId) {
      return projectTasks;
    }

    let isTargetTeam = false;
    if (currentProject.workspaceId) {
      const workspace = await WorkspaceService.getWorkspace(groupId ?? companyId, companyId, currentProject.workspaceId as string);
      if (workspace) {
        const oldAdminIds = (workspace as any).adminIds || [];
        const ownerId = workspace.ownerId || (Array.isArray(oldAdminIds) && oldAdminIds.length > 0 ? oldAdminIds[0] : null);
        const oldSpocIds = (workspace as any).spocIds || [];
        const members = workspace.members || oldSpocIds;
        isTargetTeam = ownerId === userId || (Array.isArray(members) && members.includes(userId)) || workspace.createdBy === userId;
      }
    }

    // Manager role: even if target team (workspace member), restrict to tasks they reported or are assigned to
    if (isTargetTeam) {
      return projectTasks.filter(
        task =>
          task.reporter === userId ||
          task.assignedUserId === userId ||
          (task as { assignedBy?: string }).assignedBy === userId
      );
    }

    if (isTargetTeam) {
      return projectTasks;
    }

    // Guest (not target team): show only tasks reported by or assigned to this user
    return projectTasks.filter(
      task =>
        task.reporter === userId ||
        task.assignedUserId === userId ||
        (task as { assignedBy?: string }).assignedBy === userId
    );
  }, [companyId, groupId, isGlobalAdmin]);

  // Load project data
  useEffect(() => {
    const loadData = async () => {
      if (!companyId || !projectId) return

      try {
        setLoading(true)
        const userId = useAuthStore.getState().user?.id

        // Load project with privacy checking
        const projectData = await ProjectService.getProject(companyId, projectId, userId, isGlobalAdmin, { groupId: groupId ?? undefined })
        if (!projectData) {
          toast.error('Project not found or you do not have access to this project')
          router.push('/projects')
          return
        }

        // Workspace check...
        if (projectData.workspaceId) {
          const workspace = await WorkspaceService.getWorkspace(groupId ?? companyId ?? '', companyId!, projectData.workspaceId as string)
          if (workspace) {
            setWorkspaceName(workspace.name || 'Default')
            setWorkspace(workspace)
            if (!isGlobalAdmin) {
              const oldAdminIds = (workspace as any).adminIds || [];
              const ownerId = workspace.ownerId || (Array.isArray(oldAdminIds) && oldAdminIds.length > 0 ? oldAdminIds[0] : null);
              const isOwner = ownerId === userId;
              const oldSpocIds = (workspace as any).spocIds || [];
              const members = workspace.members || oldSpocIds;
              const isWMember = Array.isArray(members) && !!userId && members.includes(userId);
              const isCreator = workspace.createdBy === userId
              const isProjectManager = projectData.manager === userId
              const isProjectTeam = Array.isArray(projectData.team) && !!userId && projectData.team.includes(userId)

              const isRftProject = projectData.projectType === 'rft' || (projectData.name && !!projectData.name.match(/RFT/i));
              if (isRftProject) {
                // RFT projects are visible company-wide, bypass access block
              } else if (!isOwner && !isWMember && !isCreator && !isProjectManager && !isProjectTeam) {
                toast.error(`Access Denied. isRft: ${isRftProject}, name: ${projectData.name}, type: ${projectData.projectType}`)
                router.push('/projects')
                return
              }
            }
          }
        }

        setProject(projectData)

        // Load tasks and users
        // Load project tasks
        let projectTasks: GeneratedTask[] = await Taskservice.fetchTasksForProject(companyId, projectId, groupId ?? undefined)

        // Enforce RFT task visibility rules
        projectTasks = await filterRftTasks(projectTasks, projectData)

        // Fetch users (merge company profiles so avatar and contact info are available for all assignees)
        const users = await UserService.getUsers(companyId, groupId ?? undefined, { mergeCompanyProfiles: true }).catch(() => [])
        setProjectUsers(users)

        // Robust Sort (Last created at top, then by Task ID descending)
        projectTasks.sort((a, b) => {
          const dateDiff = parseDate(b.createdAt) - parseDate(a.createdAt)
          if (dateDiff !== 0) return dateDiff
          return (b.taskNumber || 0) - (a.taskNumber || 0)
        })

        // Ghost detection...
        const tasksWithWorkflows = projectTasks.filter(t => t.workflowDefinitionId || t.escalationPolicyId)
        if (tasksWithWorkflows.length > 0) {
          try {
            const ghostResults = await Promise.all(tasksWithWorkflows.map(task => detectGhostForTask(companyId, task, groupId ?? undefined)))
            const ghostMap = new Map(ghostResults.map(r => [r.taskId, r]))
            projectTasks = projectTasks.map(task => {
              const ghostResult = ghostMap.get(task.id)
              if (ghostResult) return { ...task, hasGhostIssue: ghostResult.hasGhostIssue, ghostInfo: ghostResult.ghostInfo }
              return task
            })
          } catch (ghostError) {
            logger.warn('Error running ghost detection:', ghostError)
          }
        }

        setTasks(projectTasks)
      } catch (error) {
        logger.error('Error loading project:', error)
        toast.error('Failed to load project details')
        router.push('/projects')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [companyId, projectId, router, isGlobalAdmin, groupId])

  // Load task statuses when companyId is available
  useEffect(() => {
    if (companyId) {
      loadTaskStatuses(companyId)
    }
  }, [companyId, loadTaskStatuses])

  // Helper to reload tasks
  const reloadTasks = useCallback(async () => {
    if (!companyId || !projectId) return
    try {
      let projectTasks = await Taskservice.fetchTasksForProject(companyId, projectId, groupId ?? undefined)

      if (project) {
        projectTasks = await filterRftTasks(projectTasks, project)
      }

      // Robust Sort (Last created at top, then by Task ID descending)
      projectTasks.sort((a, b) => {
        const dateDiff = parseDate(b.createdAt) - parseDate(a.createdAt)
        if (dateDiff !== 0) return dateDiff
        return (b.taskNumber || 0) - (a.taskNumber || 0)
      })

      // Ghost detection...
      const tasksWithWorkflows = projectTasks.filter(t => t.workflowDefinitionId || t.escalationPolicyId)
      if (tasksWithWorkflows.length > 0) {
        try {
          const ghostResults = await Promise.all(tasksWithWorkflows.map(task => detectGhostForTask(companyId, task, groupId ?? undefined)))
          const ghostMap = new Map(ghostResults.map(r => [r.taskId, r]))
          projectTasks = projectTasks.map(task => {
            const ghostResult = ghostMap.get(task.id)
            if (ghostResult) return { ...task, hasGhostIssue: ghostResult.hasGhostIssue, ghostInfo: ghostResult.ghostInfo }
            return task
          })
        } catch (ghostError) {
          logger.warn('Error running ghost detection:', ghostError)
        }
      }

      setTasks(projectTasks)
    } catch (error) {
      logger.error('Error reloading tasks:', error)
    }
  }, [companyId, projectId, project?.workspaceId])

  return {
    project,
    setProject,
    tasks,
    setTasks,
    loading,
    statusMetadata,
    loadingStatuses,
    projectUsers,
    workspaceName,
    workspace,
    reloadTasks,
  }
}

