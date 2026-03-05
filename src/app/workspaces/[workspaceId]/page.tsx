'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WorkspaceService } from '@/lib/services'
import { PermissionService } from '@/lib/services/permission-service'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import { ArrowLeft, Edit, Users, FolderKanban, CheckCircle2, Plus, Building2, Trash } from 'lucide-react'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { EditProjectDialog } from '@/components/features/projects/EditProjectDialog'
import type { Workspace } from '@/types/workspace-schema'
import type { EnhancedProject } from '@/types/project-schema'
import type { GeneratedTask } from '@/types/task-template-schema'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { useProjectMutations, useProjectsQuery } from '@/hooks/queries/useProjectQueries'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { RecurringTaskList } from '@/components/features/recurring-tasks/RecurringTaskList'
import { RecurringTaskDialog } from '@/components/features/recurring-tasks/RecurringTaskDialog'
import * as RecurringTaskService from '@/lib/services/recurring-tasks/recurring-task-service'
import { TaskRequestList } from '@/components/features/task-requests/TaskRequestList'
import { TaskRequestDialog } from '@/components/features/task-requests/TaskRequestDialog'
import { UserService } from '@/lib/services/users/user-services'
import { getPositions, getOrgUnits } from '@/lib/services/org/org-services'
import type { WorkspaceRecurringConfig } from '@/types/recurring-task-schema'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'
import { ImportWizard } from '@/components/import/ImportWizard'
import { FileSpreadsheet } from 'lucide-react'
import { formatDate } from '@/lib/utils/date-utils'
import { DailyTrackerTab } from '@/components/features/workspaces/DailyTrackerTab'
import { RFTTab } from '@/components/features/workspaces/RFTTab'
import { TaskTemplateService } from '@/lib/services/tasks/task-template-service'
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed'

interface WorkspaceWithMetrics extends Workspace {
  totalTasks: number
  completedTasks: number
}

interface ProjectWithMetrics extends EnhancedProject {
  totalTasks: number
  completedTasks: number
  activeTasks: number
}

export default function WorkspaceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { groupId, companyId, currentCompany, currentCompanyUser } = useCompany()
  const { user: currentUser } = useAuthStore()
  const workspaceId = params.workspaceId as string

  const isGlobalAdmin = currentCompanyUser?.role === 'owner' || currentCompanyUser?.role === 'admin'
  const { data: allProjectsData = [] } = useProjectsQuery(
    companyId ?? undefined,
    groupId ?? undefined,
    currentUser?.id,
    isGlobalAdmin
  )
  const workspaceProjects = useMemo(
    () => allProjectsData.filter(p => p.workspaceId === workspaceId),
    [allProjectsData, workspaceId]
  )

  const [workspace, setWorkspace] = useState<WorkspaceWithMetrics | null>(null)
  const [projects, setProjects] = useState<ProjectWithMetrics[]>([])
  const [allTasks, setAllTasks] = useState<GeneratedTask[]>([])
  const [loading, setLoading] = useState(true)
  const [isRftGuest, setIsRftGuest] = useState(false)

  const workspaceTasks = useMemo(
    () => allTasks.filter(t => workspaceProjects.some(p => p.id === t.projectId)),
    [allTasks, workspaceProjects]
  )
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    project: EnhancedProject | null
  }>({ open: false, project: null })
  const [editDialog, setEditDialog] = useState<{
    open: boolean
    project: EnhancedProject | null
  }>({ open: false, project: null })

  // Recurring Tasks State
  const [recurringConfigs, setRecurringConfigs] = useState<WorkspaceRecurringConfig[]>([])
  const [configsLoading, setConfigsLoading] = useState(false)
  const [recurringDialog, setRecurringDialog] = useState<{
    open: boolean
    config: Partial<WorkspaceRecurringConfig> | null
  }>({ open: false, config: null })
  const [canManageRecurring, setCanManageRecurring] = useState(false)
  const [companyUsers, setCompanyUsers] = useState<{ id: string; name: string }[]>([])
  const [companyPositions, setCompanyPositions] = useState<{ id: string; name: string }[]>([])
  const [companyOrgUnits, setCompanyOrgUnits] = useState<{ id: string; name: string }[]>([])
  const [importWizardOpen, setImportWizardOpen] = useState(false)

  // Task Request State
  const [requestDialog, setRequestDialog] = useState(false)

  // Draft persistence for Recurring Task Dialog
  useEffect(() => {
    if (!recurringDialog.open && !recurringDialog.config && workspaceId) {
      const savedDraft = localStorage.getItem(`recurring_task_draft_${workspaceId}`)
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft)
          setRecurringDialog(prev => ({ ...prev, config: parsed }))
        } catch (e) {
          localStorage.removeItem(`recurring_task_draft_${workspaceId}`)
        }
      }
    }
  }, [workspaceId, recurringDialog.open, recurringDialog.config])

  useEffect(() => {
    if (recurringDialog.open && recurringDialog.config) {
      localStorage.setItem(`recurring_task_draft_${workspaceId}`, JSON.stringify(recurringDialog.config))
    }
  }, [recurringDialog.config, recurringDialog.open, workspaceId])

  const handleDraftChange = useCallback((config: Partial<WorkspaceRecurringConfig>) => {
    setRecurringDialog(prev => {
      // Deep compare title to avoid trivial loops
      if (prev.config?.taskDefinition?.title === config.taskDefinition?.title &&
        prev.config?.taskDefinition?.description === config.taskDefinition?.description &&
        prev.config?.schedule?.frequency === config.schedule?.frequency &&
        prev.config?.assignment?.value === config.assignment?.value) {
        return prev;
      }
      return { ...prev, config };
    });
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (!groupId || !companyId || !workspaceId) return

      try {
        setLoading(true)
        const { companySubcollectionPathSegments } = await import('@/lib/firestore-paths')
        const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
        const [workspaceData, tasksSnapshot] = await Promise.all([
          WorkspaceService.getWorkspace(groupId, companyId, workspaceId),
          getDocs(collection(db, segments[0], ...segments.slice(1)))
        ])

        if (!workspaceData) {
          toast.error('Workspace not found')
          router.push('/workspaces')
          return
        }

        // Strict Isolation: Verify user has access to this specific workspace
        const userId = currentUser?.id
        const isGlobalAdmin = currentCompanyUser?.role === 'owner' || currentCompanyUser?.role === 'admin'
        // Backward compatibility: check both old and new field names
        const oldAdminIds = (workspaceData as any).adminIds || [];
        const ownerId = workspaceData.ownerId || (Array.isArray(oldAdminIds) && oldAdminIds.length > 0 ? oldAdminIds[0] : null);
        const isOwner = userId && ownerId === userId;
        const oldSpocIds = (workspaceData as any).spocIds || [];
        const members = workspaceData.members || oldSpocIds;
        const isWMember = userId && Array.isArray(members) && members.includes(userId);
        const isWCreator = userId && workspaceData.createdBy === userId

        const hasRftProject = workspaceProjects.some(p => p.projectType === 'rft' || (p.name && p.name.match(/RFT/i)));
        const isGuestUser = !isGlobalAdmin && !isOwner && !isWMember && !isWCreator;

        // Check workspace visibility setting
        const visibility = workspaceData.visibility || 'standard';

        // Private/Secret: Zero inheritance - not visible to managers/admins unless explicitly invited
        // Only allow access to owner, members, or creator. Allow guests ONLY if there is an RFT project inside.
        if (visibility === 'private' || visibility === 'secret') {
          if (isGuestUser && !hasRftProject) {
            toast.error('You do not have permission to view this workspace.')
            router.push('/workspaces')
            return
          }
        }
        // For standard/confidential visibility, all users can enter but will be treated as Guests if they lack membership

        // Get all tasks
        const tasksData = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as GeneratedTask[]
        console.log('🔍 Workspace Detail - All tasks fetched:', tasksData.length)
        setAllTasks(tasksData)

        console.log('🔍 Workspace Detail - Projects in workspace:', workspaceProjects.length, workspaceProjects.map(p => ({ id: p.id, name: p.name })))

        // Calculate task metrics for each project
        const projectsWithMetrics = workspaceProjects.map(project => {
          const projectTasks = tasksData.filter(t => t.projectId === project.id)
          console.log(`🔍 Tasks for project "${project.name}" (${project.id}):`, projectTasks.length, projectTasks.map(t => ({ id: t.id, title: t.title, projectId: t.projectId })))
          const completedTasks = projectTasks.filter(t => t.status === 'completed').length
          const activeTasks = projectTasks.filter(t => t.status === 'assigned' || t.status === 'in_progress').length

          return {
            ...project,
            totalTasks: projectTasks.length,
            completedTasks,
            activeTasks
          }
        })

        // Calculate workspace-level task metrics
        const tasksInWorkspace = tasksData.filter(t =>
          workspaceProjects.some(p => p.id === t.projectId)
        )
        console.log('🔍 Workspace Detail - Total workspace tasks:', tasksInWorkspace.length)
        const workspaceCompletedTasks = tasksInWorkspace.filter(t => t.status === 'completed').length

        const workspaceWithMetrics: WorkspaceWithMetrics = {
          ...workspaceData,
          totalTasks: tasksInWorkspace.length,
          completedTasks: workspaceCompletedTasks
        }

        setIsRftGuest(isGuestUser)
        setWorkspace(workspaceWithMetrics)
        setProjects(projectsWithMetrics)
      } catch (error) {
        console.error('Error loading workspace:', error)
        toast.error('Failed to load workspace')
        router.push('/workspaces')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [companyId, groupId, workspaceId, router, currentUser, currentCompanyUser, workspaceProjects])

  useEffect(() => {
    const loadRecurringData = async () => {
      if (!companyId || !workspaceId || !currentUser || !workspace) return

      try {
        setConfigsLoading(true)

        // Fetch workspace members and all company positions
        try {
          // 1. Get all company users
          const allUsers = await UserService.getUsers(companyId, groupId ?? undefined)

          // 2. Get workspace role assignments
          const assignments = await WorkspaceService.getWorkspaceRoleAssignments(groupId ?? companyId ?? '', companyId, workspaceId)

          // 3. Define strict member IDs for recurring task assignment:
          //    ONLY explicit workspace members — declared members + owner + role assignments.
          //    taskParticipants (anyone ever assigned a task here) are intentionally excluded
          //    because they are not necessarily workspace members and must not appear in the
          //    user/position dropdowns.
          // Backward compatibility: check both old and new field names
          const oldSpocIds = (workspace as any).spocIds || [];
          const members = workspace.members || oldSpocIds;
          const oldAdminIds = (workspace as any).adminIds || [];
          const ownerId = workspace.ownerId || (Array.isArray(oldAdminIds) && oldAdminIds.length > 0 ? oldAdminIds[0] : null);

          const strictMemberIds = new Set([
            ...(Array.isArray(members) ? members : []),
            ...(ownerId ? [ownerId] : []),
            ...assignments.map(a => a.userId),
          ])

          // 4. Filter users to ONLY declared workspace members
          const workspaceUsers = allUsers.filter(u => strictMemberIds.has(u.id))

          // 5. Get ALL company positions
          const allPositions = await getPositions(companyId, groupId ?? undefined)

          // 6. Get ALL company org units
          const allOrgUnits = await getOrgUnits(companyId, groupId ?? undefined)

          // Bug 3 fix: u.position stores the title string (set by org-services), not an id.
          // Match by title instead of by id to reliably resolve positionId.
          const workspaceUsersMapped = workspaceUsers.map(u => {
            const posByTitle = allPositions.find(p => p.title === u.position)
            const positionTitle = posByTitle?.title || u.position || ''
            const positionId = posByTitle?.id || ''
            return {
              id: u.id,
              name: u.name || u.email || 'Unknown User',
              position: positionTitle,
              positionName: positionTitle,
              positionId,
              department: u.orgUnitName
            }
          })

          setCompanyUsers(workspaceUsersMapped)

          // New requirement: only show positions held by at least one workspace member.
          // Bug 1 fix: store `title` on position objects so AssignmentStep can read p.title.
          const workspaceMemberPositionIds = new Set(
            workspaceUsersMapped.map(u => u.positionId).filter(Boolean)
          )
          const workspacePositions = allPositions
            .filter(p => workspaceMemberPositionIds.has(p.id))
            .map(p => ({ id: p.id, name: p.title, title: p.title }))
          setCompanyPositions(workspacePositions)

          setCompanyOrgUnits(allOrgUnits.map(d => ({ id: d.id, name: d.name })))
        } catch (err: any) {
          console.error('Error loading members/positions for recurring tasks:', err)
          toast.error('Failed to load members or positions')
        }

        // Check if user can manage recurring tasks
        try {
          const can = await RecurringTaskService.canViewRecurringTasks(currentUser.id, companyId, workspaceId, groupId || undefined)
          setCanManageRecurring(can)
        } catch (err) {
          console.error('Error checking recurring perms:', err)
          setCanManageRecurring(false)
        }
      } finally {
        setConfigsLoading(false)
      }
    }

    loadRecurringData()
  }, [companyId, workspaceId, currentUser, workspace, allTasks, workspaceProjects])

  // Real-time subscription for configs
  useEffect(() => {
    if (!companyId || !workspaceId || !currentUser) return

    const unsubscribe = RecurringTaskService.subscribeWorkspaceConfigs(
      companyId,
      workspaceId,
      (configs) => {
        setRecurringConfigs(configs)
        setConfigsLoading(false)
      },
      (err: any) => {
        // Permission errors are handled gracefully - just set empty array
        if (err.code === 'permission-denied' || err.message?.includes('Permission denied')) {
          setRecurringConfigs([])
          setConfigsLoading(false)
          return
        }
        console.error('Error subscribing to recurring configs:', err)
      },
      currentUser.id,
      groupId || undefined
    )

    return () => unsubscribe()
  }, [companyId, workspaceId, currentUser, groupId])

  const { trackWorkspaceView } = useRecentlyViewed()

  // Track recently viewed workspace
  useEffect(() => {
    if (workspace && workspace.id) {
      trackWorkspaceView({
        id: workspace.id,
        name: workspace.name,
        color: workspace.color
      })
    }
  }, [workspace?.id, trackWorkspaceView])

  const handleCreateRecurring = () => {
    // If the draft has an id, it was an edit draft. Clear it for a new task.
    setRecurringDialog(prev => {
      if (prev.config?.id) {
        return { open: true, config: null }
      }
      return { ...prev, open: true }
    })
  }

  const handleEditRecurring = (config: WorkspaceRecurringConfig) => {
    setRecurringDialog({ open: true, config })
  }

  const handleSaveRecurring = async (config: Partial<WorkspaceRecurringConfig>) => {
    if (!companyId || !workspaceId || !currentUser) return

    try {
      if (recurringDialog.config?.id) {
        // Update
        await RecurringTaskService.updateRecurringConfig({
          configId: recurringDialog.config.id!,
          companyId,
          userId: currentUser.id,
          updates: config,
          groupId: groupId || undefined
        })
        toast.success('Recurring task updated')
      } else {
        // Create
        if (!config.taskDefinition || !config.schedule || !config.assignment) {
          throw new Error('Missing required configuration')
        }
        await RecurringTaskService.createRecurringConfig({
          companyId,
          workspaceId,
          projectId: config.projectId || '',
          taskDefinition: config.taskDefinition,
          schedule: config.schedule,
          assignment: config.assignment,
          userId: currentUser.id,
          groupId: groupId || undefined
        })
        toast.success('Recurring task created')
      }

      setRecurringDialog({ open: false, config: null })
      localStorage.removeItem(`recurring_task_draft_${workspaceId}`)
    } catch (error: any) {
      console.error('Failed to save recurring config:', error)
      toast.error(error.message || 'Failed to save recurring task')
    }
  }

  const handleToggleRecurring = async (config: WorkspaceRecurringConfig) => {
    if (!companyId || !currentUser) return
    try {
      await RecurringTaskService.toggleConfigActive(config.id, companyId, currentUser.id, groupId || undefined)
      toast.success(`Task ${!config.isActive ? 'activated' : 'paused'}`)
    } catch (error) {
      toast.error('Failed to toggle status')
    }
  }

  const handleArchiveRecurring = async (config: WorkspaceRecurringConfig) => {
    if (!companyId || !currentUser) return
    try {
      await RecurringTaskService.archiveRecurringConfig(config.id, companyId, currentUser.id, groupId || undefined)
      toast.success('Task archived')
    } catch (error) {
      toast.error('Failed to archive task')
    }
  }

  const handleUnarchiveRecurring = async (config: WorkspaceRecurringConfig) => {
    if (!companyId || !currentUser) return
    try {
      await RecurringTaskService.unarchiveRecurringConfig(config.id, companyId, currentUser.id, groupId || undefined)
      toast.success('Task restored')
    } catch (error) {
      toast.error('Failed to restore task')
    }
  }

  const handleDeleteRecurring = async (config: WorkspaceRecurringConfig) => {
    if (!companyId || !currentUser) return
    try {
      await RecurringTaskService.deleteRecurringConfig(config.id, companyId, currentUser.id, groupId || undefined)
      toast.success('Recurring task deleted permanently')
    } catch (error) {
      toast.error('Failed to delete recurring task')
    }
  }

  const handleRunNow = async (config: WorkspaceRecurringConfig) => {
    if (!companyId) return
    const callManualRun = httpsCallable(functions, 'manualRunRecurringTask')
    toast.promise(
      callManualRun({ configId: config.id, companyId, groupId }),
      {
        loading: 'Generating task...',
        success: () => {
          // Refresh list to update lastRunAt and disable button
          if (currentUser) {
            RecurringTaskService.getWorkspaceConfigs(companyId, workspaceId, currentUser.id, groupId || undefined)
              .then(updated => setRecurringConfigs(updated))
          }
          return 'Task generated successfully!'
        },
        error: 'Failed to generate task'
      }
    )
  }

  const { deleteProject } = useProjectMutations(companyId || undefined, groupId ?? undefined)

  const handleDeleteProject = async (project: EnhancedProject) => {
    if (!companyId) return

    // Only creator or admin can delete
    const projectWithCreatedBy = project as EnhancedProject & { createdBy?: string }
    const isCreator = projectWithCreatedBy.createdBy === currentUser?.id
    const isAdmin = currentCompanyUser?.role === 'owner' || currentCompanyUser?.role === 'admin'

    if (!isCreator && !isAdmin) {
      toast.error('You can only delete projects created by you')
      return
    }

    try {
      await deleteProject.mutateAsync(project.id)
      setProjects(projects.filter(p => p.id !== project.id))
      toast.success(`${project.name} has been deleted successfully`)
      setDeleteDialog({ open: false, project: null })
    } catch (error) {
      console.error('Error deleting project:', error)
    }
  }

  const handleProjectUpdate = (updatedProject: EnhancedProject) => {
    setProjects(projects.map(p => p.id === updatedProject.id ? { ...p, ...updatedProject } : p))
    setEditDialog({ open: false, project: null })
    toast.success('Project updated successfully')
  }

  const handleTaskStatusChange = async (taskId: string, newStatus: GeneratedTask['status']) => {
    if (!companyId) return

    // Optimistic Update
    setAllTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: newStatus } : t
    ))

    try {
      await TaskTemplateService.updateTaskStatus(
        companyId,
        taskId,
        newStatus,
        undefined,
        undefined,
        false,
        groupId ?? undefined
      )
      toast.success('Task updated')
    } catch (error) {
      console.error('Failed to update task status:', error)
      toast.error('Failed to update task status')
      // Revert on error - re-fetching would be ideal but simple revert for now
      setAllTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, status: newStatus === 'completed' ? 'in_progress' : 'completed' } : t
      ))
    }
  }

  const [sourceWorkspaceMembers, setSourceWorkspaceMembers] = useState<Set<string>>(new Set())

  // Load source workspace members for RFT guests
  useEffect(() => {
    const loadSourceMembers = async () => {
      if (!isRftGuest || !companyId || !currentUser?.id) return

      try {
        const userWorkspaces = await WorkspaceService.getWorkspaces(groupId ?? companyId, companyId, { userId: currentUser.id, isGlobalAdmin: false })
        const membersSet = new Set<string>()

        userWorkspaces.forEach(w => {
          const oldAdminIds = (w as any).adminIds || []
          const wOwnerId = w.ownerId || (Array.isArray(oldAdminIds) && oldAdminIds.length > 0 ? oldAdminIds[0] : null)
          const isWAdmin = wOwnerId === currentUser.id

          if (isWAdmin) {
            const oldSpocIds = (w as any).spocIds || []
            const members = w.members || oldSpocIds
            if (Array.isArray(members)) {
              members.forEach((mId: string) => membersSet.add(mId))
            }
          }
        })
        setSourceWorkspaceMembers(membersSet)
      } catch (err) {
        console.error('Error loading source members:', err)
      }
    }
    loadSourceMembers()
  }, [isRftGuest, companyId, groupId, currentUser])

  const rftProjects = useMemo(
    () => projects.filter(p => p.projectType === 'rft' || (p.name && !!p.name.match(/RFT/i))),
    [projects]
  )

  const rftTasks = useMemo(() => {
    const rawTasks = allTasks.filter(t => rftProjects.some(p => p.id === t.projectId))

    // Apply RFT Guest (Source Team) filtering rules
    if (isRftGuest && currentUser?.id) {
      return rawTasks.filter(task => {
        const taskCreator = task.reporter || task.assignedBy || task.assignedUserId
        return taskCreator === currentUser.id || sourceWorkspaceMembers.has(taskCreator as string)
      })
    }

    return rawTasks
  }, [allTasks, rftProjects, isRftGuest, currentUser, sourceWorkspaceMembers])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!workspace) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Workspace not found</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push('/workspaces')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                {workspace.color && (
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: workspace.color }}
                  />
                )}
                <h1 className="text-3xl font-bold">{workspace.name}</h1>
                <Badge variant={workspace.status === 'active' ? 'default' : 'secondary'}>
                  {workspace.status}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1">{workspace.teamName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(currentCompanyUser?.role === 'owner' ||
              currentCompanyUser?.role === 'admin' ||
              workspace.createdBy === currentUser?.id ||
              (Array.isArray((workspace as any).adminIds) && (workspace as any).adminIds.includes(currentUser?.id))) && (
                <Button onClick={() => router.push(`/workspaces/${workspaceId}/edit`)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Workspace
                </Button>
              )}
          </div>
        </div>

        {/* Description */}
        {workspace.description && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">{workspace.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue={isRftGuest ? "overview" : "daily-tracker"} className="space-y-4">
          <TabsList>
            {!isRftGuest && <TabsTrigger value="daily-tracker">Daily Tracker</TabsTrigger>}
            <TabsTrigger value="rft">RFT</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            {canManageRecurring && !isRftGuest && (
              <TabsTrigger value="recurring-tasks">Recurring Tasks</TabsTrigger>
            )}
            {!isRftGuest && <TabsTrigger value="task-requests">Task Requests</TabsTrigger>}
            <TabsTrigger value="overview">Overview</TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Projects</h2>
              <Button onClick={() => router.push(`/projects/create?workspaceId=${workspaceId}`)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Project
              </Button>
            </div>

            {projects.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Create your first project in this workspace
                  </p>
                  {!isRftGuest && (
                    <Button onClick={() => router.push(`/projects/create?workspaceId=${workspaceId}`)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Project
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                {(isRftGuest ? projects.filter(p => p.projectType === 'rft' || (p.name && !!p.name.match(/RFT/i))) : projects).map((project) => (
                  <Card key={project.id} className="clickable-card h-full group relative border hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <Link href={`/workspaces/${workspaceId}/projects/${project.id}`}>
                            <CardTitle className="clickable-title text-lg font-bold hover:text-primary transition-colors">
                              {project.name}
                            </CardTitle>
                          </Link>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <Badge
                            className="shrink-0"
                            variant={
                              project.status === 'active'
                                ? 'default'
                                : project.status === 'completed'
                                  ? 'secondary'
                                  : 'outline'
                            }
                          >
                            {project.status}
                          </Badge>
                          <div className="flex items-center gap-1 border-l pl-2 border-border ml-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors"
                              onClick={() => setEditDialog({ open: true, project })}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                              onClick={() => setDeleteDialog({ open: true, project })}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      {project.description && (
                        <CardDescription className="line-clamp-1 mt-1">
                          {project.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <Link href={`/workspaces/${workspaceId}/projects/${project.id}`}>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Tasks</span>
                            <span className="font-medium">
                              {project.completedTasks} / {project.totalTasks}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Link>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {!isRftGuest && (
            <TabsContent value="daily-tracker" className="space-y-4">
              <DailyTrackerTab
                tasks={workspaceTasks}
                projects={projects}
                currentUser={{ id: currentUser?.id || '', name: currentUser?.name || '' }}
                companyId={companyId || ''}
                users={companyUsers}
                workspaceId={workspaceId}
                onStatusChange={handleTaskStatusChange}
              />
            </TabsContent>
          )}

          <TabsContent value="rft" className="space-y-4">
            <RFTTab
              tasks={rftTasks}
              projects={rftProjects}
              currentUser={{ id: currentUser?.id || '', name: currentUser?.name || '' }}
              companyId={companyId || ''}
              users={companyUsers}
              workspaceId={workspaceId}
              onStatusChange={handleTaskStatusChange}
              isRftGuest={isRftGuest}
            />
          </TabsContent>

          {canManageRecurring && (
            <TabsContent value="recurring-tasks" className="space-y-4">
              <RecurringTaskList
                configs={recurringConfigs}
                users={companyUsers}
                projects={projects}
                isLoading={configsLoading}
                onCreateNew={handleCreateRecurring}
                onEdit={handleEditRecurring}
                onToggle={handleToggleRecurring}
                onArchive={handleArchiveRecurring}
                onUnarchive={handleUnarchiveRecurring}
                onRunNow={handleRunNow}
                onDelete={handleDeleteRecurring}
                onImport={() => setImportWizardOpen(true)}
              />
            </TabsContent>
          )}

          {!isRftGuest && (
            <TabsContent value="task-requests" className="space-y-4">
              <TaskRequestList
                workspaceId={workspaceId}
                companyId={companyId || ''}
                currentUser={{ id: currentUser?.id || '', name: currentUser?.name || '' }}
                onCreateNew={() => setRequestDialog(true)}
              />
            </TabsContent>
          )}

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Workspace Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Team Name</label>
                  <p className="text-sm mt-1">{workspace.teamName}</p>
                </div>
                {workspace.department && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Org Unit</label>
                    <p className="text-sm mt-1">{workspace.department}</p>
                  </div>
                )}
                {workspace.businessUnit && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Business Unit</label>
                    <p className="text-sm mt-1">{workspace.businessUnit}</p>
                  </div>
                )}
                {workspace.tags && workspace.tags.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Tags</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {workspace.tags.map((tag, idx) => (
                        <Badge key={idx} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created</label>
                  <p className="text-sm mt-1">
                    {formatDate(workspace.createdAt)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ConfirmationDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, project: null })}
        title="Delete Project"
        description={`Are you sure you want to delete "${deleteDialog.project?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => {
          if (deleteDialog.project) {
            handleDeleteProject(deleteDialog.project)
          }
        }}
      />

      {
        editDialog.project && (
          <EditProjectDialog
            project={editDialog.project}
            open={editDialog.open}
            onOpenChange={(open) => setEditDialog({ open, project: null })}
            onUpdate={handleProjectUpdate}
          />
        )
      }

      {
        recurringDialog.open && (
          <RecurringTaskDialog
            open={recurringDialog.open}
            onOpenChange={(open) => setRecurringDialog(prev => ({ ...prev, open }))}
            initialData={recurringDialog.config || undefined}
            workspaceId={workspaceId}
            companyId={companyId || ''}
            users={companyUsers}
            positions={companyPositions}
            projects={projects}
            departments={companyOrgUnits}
            onDraftChange={handleDraftChange}
            onSave={handleSaveRecurring}
            isLoading={configsLoading}
          />
        )
      }

      {
        workspace && (
          <TaskRequestDialog
            open={requestDialog}
            onOpenChange={setRequestDialog}
            fromWorkspace={workspace}
            companyId={companyId || ''}
            currentUser={{ id: currentUser?.id || '', name: currentUser?.name || '' }}
          />
        )
      }
      <ImportWizard
        isOpen={importWizardOpen}
        onClose={() => setImportWizardOpen(false)}
        importType="recurring_tasks"
        context={{
          companyId: companyId || '',
          workspaceId: workspaceId,
          projectId: '', // Can be per row
          userId: currentUser?.id || ''
        }}
      />
    </DashboardLayout >
  )
}
