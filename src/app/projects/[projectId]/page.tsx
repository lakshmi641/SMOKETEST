'use client'

import { use, useState, useEffect, useMemo } from 'react'
import { formatDistanceToNow, isAfter, subDays } from 'date-fns'
import { formatDate } from '@/lib/utils/date-utils'
import { useParams, useRouter, useSearchParams, usePathname } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { DashboardContainer } from '@/components/features/dashboard'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCompany } from '@/contexts/CompanyContext'
import { ProjectService } from '@/lib/services/projects/project-services'
import { TaskTemplateService } from '@/lib/services/tasks/task-template-service'
import type { GeneratedTask } from '@/types/task-template-schema'
import type { EnhancedProject } from '@/types/project-schema'
import { formatTaskId as formatTaskIdUtil } from '@/lib/utils/task-display'
import {
  CheckCircle,
  FileText,
  Calendar as CalendarIcon,
  Edit,
  AlertCircle,
  Users,
  Settings,
  FileSpreadsheet,
  History,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { logger } from '@/lib/logger'
import { ProjectListTab, ProjectBoardTab } from '@/components/features/tasks'
import { CalendarView } from '@/components/features/calendar'
import { GanttChart } from '@/components/features/tasks/gantt/GanttChart'
import { WBSGanttChart } from '@/components/features/tasks/wbs/WBSGanttChart'
import { useAuthStore } from '@/store/authStore'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { TaskDetailDialog } from '@/components/issue/TaskDetailDialog'
import { EditProjectDialog } from '@/components/features/projects/EditProjectDialog'
import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { CreateCustomFieldModal } from '@/components/features/custom-fields'
import { ProjectWorkflowAssignmentTab } from '@/components/features/projects/ProjectWorkflowAssignmentTab'
import { GitGraph, ShieldCheck } from 'lucide-react'
import { useProjectCustomFields } from '@/hooks/useProjectCustomFields'
import type { CustomFieldType } from '@/types/custom-field'
import { useUIStore } from '@/store/uiStore'
import { ColumnChooser } from '@/components/features/tasks/ColumnChooser'
import { useProjectData } from '@/hooks/useProjectData'
import { useProjectTasks } from '@/hooks/useProjectTasks'
import { useTaskActivities } from '@/hooks/useTaskActivities'
import { useBulkTaskOperations } from '@/hooks/useBulkTaskOperations'
import { useColumnManagement } from '@/hooks/useColumnManagement'
import { useProjectTabs } from '@/hooks/useProjectTabs'
import { useProjectStats } from '@/hooks/useProjectStats'
import { useTaskSorting } from '@/hooks/useTaskSorting'
import { ImportWizard } from '@/components/import/ImportWizard'
import { ImportType } from '@/lib/services/import/types/import-types'
import { ProjectInfoTab } from '@/components/features/projects/ProjectInfoTab'
import { DocumentVaultTab } from '@/components/features/projects/DocumentVaultTab'
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed'
import type { MemberSelection } from '@/components/common/MemberSelect'

export default function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { companyId, groupId, currentCompany, currentCompanyUser, tenantProfile } = useCompany()
  const { user: currentUser } = useAuthStore()
  const isAdmin = currentCompanyUser?.role === 'owner' || currentCompanyUser?.role === 'admin'

  // Load custom fields for project (needed before other hooks)
  const {
    projectFields: allProjectFields,
    updateTaskValue,
    updateProjectValue,
    disableField,
    refresh: refreshCustomFields
  } = useProjectCustomFields(projectId, companyId || null)

  // Use all project fields including capacity
  const projectFields = allProjectFields

  const {
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
  } = useProjectData(
    companyId || undefined,
    projectId,
    currentCompanyUser?.role === 'owner' || currentCompanyUser?.role === 'admin',
    groupId ?? undefined
  )

  // Project tabs hook
  const { activeTab, setActiveTab, handleTabChange, projectViews } = useProjectTabs(project, tenantProfile)

  // Task operations hook
  const {
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
  } = useProjectTasks(companyId || undefined, projectId, tasks, setTasks, groupId, isAdmin)

  // Enrich project users with current user's avatar so assignee avatars show for everyone (auth may have photoURL when Firestore does not)
  const projectUsersWithAvatars = useMemo(() => {
    if (!currentUser?.id || !projectUsers?.length) return projectUsers
    return projectUsers.map((u: { id: string; avatar?: string }) =>
      u.id === currentUser.id && (currentUser as { avatar?: string }).avatar
        ? { ...u, avatar: u.avatar || (currentUser as { avatar?: string }).avatar }
        : u
    )
  }, [projectUsers, currentUser?.id, (currentUser as { avatar?: string } | null)?.avatar])

  // Task activities hook
  const activities = useTaskActivities(tasks, projectUsersWithAvatars, currentUser?.id)

  // Bulk operations hook
  const {
    selectedTaskIds,
    setSelectedTaskIds,
    handleSelectAll: handleBulkSelectAll,
    handleSelectTask,
    handleBulkStatusChange,
    handleBulkAssigneeChange,
    handleBulkDelete,
  } = useBulkTaskOperations(companyId || undefined, tasks, setTasks, groupId, isAdmin)

  // Column management hook
  const {
    columnChooserOpen,
    setColumnChooserOpen,
    visibleColumns,
    sortColumn,
    allColumns,
    visibleOrderedColumns,
    handleToggleColumn,
    handleReorderColumn,
    handleSort,
  } = useColumnManagement(projectFields, projectId)

  // Project stats hook
  const {
    completedLast7Days,
    updatedLast7Days,
    createdLast7Days,
    dueSoon,
    tasksByStatus,
    totalTasks,
  } = useProjectStats(tasks)

  const requestCreateTask = useUIStore(s => s.requestCreateTask)

  // UI state
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [customFieldModalOpen, setCustomFieldModalOpen] = useState(false)
  const [selectedFieldType, setSelectedFieldType] = useState<CustomFieldType | null>(null)
  const [editingField, setEditingField] = useState<any>(null)
  const [sortState, setSortState] = useState<{ fieldId: string; direction: 'asc' | 'desc' } | null>(null)
  const [importWizardOpen, setImportWizardOpen] = useState(false)
  const [activeImportType, setActiveImportType] = useState<ImportType>('project_tasks')
  // Filter out subtasks from main task listings
  const mainTasks = useMemo(() => tasks.filter(task => !task.parentTaskId), [tasks])

  // Sort tasks based on sortState
  const sortedTasks = useTaskSorting(mainTasks, sortState, projectFields)
  // Auto-open edit dialog if action=edit query param is present
  useEffect(() => {
    const action = searchParams.get('action')
    if (action === 'edit' && project) {
      setEditDialogOpen(true)
      router.replace(pathname, { scroll: false })
    }

    const taskId = searchParams.get('taskId')
    if (taskId && tasks.length > 0) {
      const task = tasks.find(t => t.id === taskId)
      if (task) {
        handleViewTask(task)
        // clean up URL?? maybe not to allow sharing/refreshing
      }
    }
  }, [searchParams, project, pathname, router, tasks])

  const { trackProjectView } = useRecentlyViewed()

  // Track recently viewed project
  useEffect(() => {
    if (project && project.id) {
      trackProjectView({
        id: project.id,
        name: project.name,
        color: project.color
      })
    }
  }, [project?.id, trackProjectView])

  // Helper function to format task ID (e.g., PA-1, PA-2)
  // Uses taskNumber if available, falls back to legacy format. Empty for autocracy tenant.
  // Pass company domain so autocracy is detected even when company ID is a Firestore auto-id.
  const formatTaskId = (task: GeneratedTask) => {
    return formatTaskIdUtil(task, project, companyId ?? undefined, currentCompany?.domain ?? undefined)
  }

  const handleOpenImport = (type: ImportType = 'project_tasks') => {
    setActiveImportType(type)
    setImportWizardOpen(true)
  }

  // Bulk selection handler (wraps hook function)
  const handleSelectAll = (checked: boolean) => {
    handleBulkSelectAll(checked, tasks)
  }

  // Handler for project custom field updates
  const handleUpdateProjectField = async (fieldId: string, value: any) => {
    const newValue = value === null || value === undefined ? null : value
    // Update local state first
    setProject(prev => {
      if (!prev) return prev
      return {
        ...prev,
        customFields: {
          ...(prev.customFields || {}),
          [fieldId]: newValue
        }
      }
    })
    // Then update backend
    await updateProjectValue(fieldId, newValue)
  }

  // Handler for custom field updates (includes state update)
  const handleUpdateTaskCustomField = async (task: GeneratedTask, fieldId: string, value: any) => {
    const newValue = value === null || value === undefined ? null : value
    // Update local state first
    setTasks(prev => prev.map(t => {
      if (t.id === task.id) {
        const updatedCustomFields = { ...t.customFields }
        if (newValue === null) {
          delete updatedCustomFields[fieldId]
        } else {
          updatedCustomFields[fieldId] = newValue
        }
        return { ...t, customFields: updatedCustomFields }
      }
      return t
    }))
    // Then update backend
    if (newValue !== null) {
      await updateTaskValue(task.id, fieldId, newValue)
    } else {
      await updateTaskValue(task.id, fieldId, '' as any)
    }
  }

  const handleKanbanDragStart = (event: any) => {
    setActiveId(event.active.id as string)
  }

  const handleKanbanDragCancel = () => {
    setActiveId(null)
  }

  const handleKanbanDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    // 1. If not dropped over anything, do nothing
    if (!over) return
    if (active.id === over.id) return

    const taskId = active.id as string
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    // 2. Determine what we dropped onto
    const overTask = tasks.find(t => t.id === over.id)

    // ── CASE A: Same-column vertical reorder ────────────────────────────────
    // both active and over are task IDs AND they share the same status
    if (overTask && overTask.status === task.status) {
      const columnTasks = tasks
        .filter(t => t.status === task.status)
        .sort((a, b) => {
          const aHasOrder = a.boardOrder !== undefined
          const bHasOrder = b.boardOrder !== undefined
          if (aHasOrder && bHasOrder) return a.boardOrder! - b.boardOrder!
          if (aHasOrder) return -1
          if (bHasOrder) return 1
          const parseDate = (v: any) => {
            if (!v) return 0
            if (typeof v.toDate === 'function') return v.toDate().getTime()
            const d = new Date(v)
            return isNaN(d.getTime()) ? 0 : d.getTime()
          }
          return parseDate(b.createdAt) - parseDate(a.createdAt)
        })

      const oldIndex = columnTasks.findIndex(t => t.id === taskId)
      const newIndex = columnTasks.findIndex(t => t.id === over.id)
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

      const reordered = arrayMove(columnTasks, oldIndex, newIndex)

      // Assign sequential boardOrder values
      const updates = reordered.map((t, idx) => ({ id: t.id!, boardOrder: idx }))

      // Optimistic UI update
      setTasks(prev => prev.map(t => {
        const upd = updates.find(u => u.id === t.id)
        return upd ? { ...t, boardOrder: upd.boardOrder } : t
      }))

      // Persist to Firestore (fire-and-forget with error recovery)
      try {
        if (!companyId) throw new Error('Missing company')
        await TaskTemplateService.updateBoardOrder(companyId, updates, groupId ?? undefined)
      } catch (error) {
        logger.error('Error saving board order:', error)
        toast.error('Failed to save task order')
        // Revert optimistic update by reloading tasks
        await reloadTasks()
      }
      return
    }

    // ── CASE B: Cross-column drop — change status ─────────────────────────
    // Dropping on a column uses its ID (the status code)
    // Dropping on another task uses the task's ID, so we must find that task's status
    let newStatus = over.id as string
    if (overTask) {
      newStatus = overTask.status
    }

    // 3. Validate status
    const validStatusOptions = statusMetadata.map(s => s.code)
    if (!validStatusOptions.includes(newStatus)) {
      logger.warn('Dropped on invalid status area:', newStatus)
      return
    }

    if (task.status === newStatus) return

    // 4. Update state and backend
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus as GeneratedTask['status'] } : t))
    try {
      if (!companyId) throw new Error('Missing company')
      await TaskTemplateService.updateTaskStatus(
        companyId,
        taskId,
        newStatus as GeneratedTask['status'],
        undefined,
        undefined,
        undefined,
        groupId ?? undefined
      )
    } catch (error: any) {
      logger.error('Error updating task status:', error)
      const message = error?.message?.includes('start the task first')
        ? 'Please start the task first by clicking "Start Task" before moving to this status.'
        : 'Failed to update task status'
      toast.error(message)
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: task.status } : t))
    }
  }

  const handleUpdateTaskAssignee = async (taskId: string, selection: MemberSelection | null) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    if (task.reporter !== currentUser?.id && !isAdmin) {
      toast.error('You can only change assignee for tasks created by you')
      return
    }
    const assignedUserId = selection ? (selection.type === 'user' ? selection.id : selection.userId) || '' : ''
    const assignedPositionId = selection?.type === 'position' ? selection.id : undefined
    const assignedToName = selection?.label ?? undefined
    const prevAssignee = task.assignedUserId
    const prevPositionId = task.assignedPositionId
    const prevName = task.assignedToName
    setTasks(prev =>
      prev.map(t =>
        t.id === taskId
          ? {
            ...t,
            assignedUserId: assignedUserId,
            assignedTo: assignedUserId,
            assignedPositionId: assignedPositionId,
            assignedToName: assignedToName,
          }
          : t
      )
    )
    try {
      if (!companyId) throw new Error('Missing company')
      await TaskTemplateService.updateTaskStatus(
        companyId,
        taskId,
        task.status || 'assigned',
        {
          assignedUserId: assignedUserId,
          assignedTo: assignedUserId,
          assignedPositionId: assignedPositionId,
          assignedToName: assignedToName,
        },
        currentUser?.id,
        false,
        groupId ?? undefined
      )
      toast.success('Assignee updated')
    } catch (error) {
      logger.error('Error updating task assignee:', error)
      toast.error('Failed to update assignee')
      setTasks(prev =>
        prev.map(t =>
          t.id === taskId
            ? { ...t, assignedUserId: prevAssignee, assignedTo: prevAssignee, assignedPositionId: prevPositionId, assignedToName: prevName }
            : t
        )
      )
    }
  }

  const handleUpdateProject = async (updates: Partial<EnhancedProject>) => {
    if (!companyId || !projectId) return
    try {
      await ProjectService.updateProject(companyId, projectId, updates, { groupId: groupId ?? undefined })
      setProject(prev => prev ? { ...prev, ...updates } : null)
    } catch (error) {
      console.error('Error updating project:', error)
      toast.error('Failed to update project')
      throw error
    }
  }

  const handleEditProject = () => {
    setEditDialogOpen(true)
  }

  const handleProjectUpdate = (updatedProject: any) => {
    setProject(updatedProject)
  }

  const handleViewAllTasks = () => {
    setActiveTab('list')
  }

  const handleDeleteTaskClickWrapper = (task: GeneratedTask, e: React.MouseEvent) => {
    handleDeleteTaskClick(task, e, currentUser?.id)
  }

  // Summary page only; other views handled by their own routes

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!project) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-card-foreground mb-2">Project Not Found</h3>
            <p className="text-muted-foreground mb-4">The project you're looking for doesn't exist.</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Project Header */}
        <div className="flex items-center justify-between gap-4 pb-4 shrink-0">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="w-12 h-12 shrink-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-foreground break-words">{project.name}</h1>
              <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => handleOpenImport('project_tasks')} className="hidden sm:flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" /> Import
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleTabChange('project-info')}
              title="Project info & team members"
            >
              <Users className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleEditProject} title="Project settings">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* In-page Tabs (no route change) - Dynamic based on project views */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="border-b w-full justify-start bg-transparent h-auto p-0 rounded-none shrink-0">
            {projectViews.includes('overview') && (
              <TabsTrigger
                value="summary"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
              >
                Overview
              </TabsTrigger>
            )}
            {projectViews.includes('list') && (
              <TabsTrigger
                value="list"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
              >
                List
              </TabsTrigger>
            )}
            {projectViews.includes('board') && (
              <TabsTrigger
                value="board"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
              >
                Board
              </TabsTrigger>
            )}
            {projectViews.includes('timeline') && (
              <TabsTrigger
                value="timeline"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
              >
                Timeline
              </TabsTrigger>
            )}
            {/* NEW WBS GANTT TAB */}
            <TabsTrigger
              value="wbs"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
            >
              WBS Gantt
            </TabsTrigger>
            {projectViews.includes('calendar') && (
              <TabsTrigger
                value="calendar"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
              >
                Calendar
              </TabsTrigger>
            )}
            {projectViews.includes('dashboard') && (
              <TabsTrigger
                value="dashboard"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
              >
                Dashboard
              </TabsTrigger>
            )}
            {(projectViews.includes('governance') || projectViews.includes('workflows')) && (
              <TabsTrigger
                value="governance"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
              >
                Governance
              </TabsTrigger>
            )}
            {projectViews.includes('project-info') && (
              <TabsTrigger
                value="project-info"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
              >
                Project Info
              </TabsTrigger>
            )}
            {projectViews.includes('document-vault') && (
              <TabsTrigger
                value="document-vault"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
              >
                Document Vault
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="summary" className="flex-1 min-h-0 overflow-y-auto scrollbar-ultrathin space-y-6 mt-6">
            {/* Stats Cards - Jira Style */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Completed */}
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{completedLast7Days}</p>
                      <p className="text-sm text-muted-foreground">completed</p>
                      <p className="text-xs text-muted-foreground">in the last 7 days</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Updated */}
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                      <Edit className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{updatedLast7Days}</p>
                      <p className="text-sm text-muted-foreground">updated</p>
                      <p className="text-xs text-muted-foreground">in the last 7 days</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Created */}
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                      <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{createdLast7Days}</p>
                      <p className="text-sm text-muted-foreground">created</p>
                      <p className="text-xs text-muted-foreground">in the last 7 days</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Due Soon */}
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                      <CalendarIcon className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{dueSoon}</p>
                      <p className="text-sm text-muted-foreground">due soon</p>
                      <p className="text-xs text-muted-foreground">in the next 7 days</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Status Overview with Chart */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Status overview</CardTitle>
                    <CardDescription>
                      Get a snapshot of the status of your work items. <button onClick={handleViewAllTasks} className="text-primary hover:underline">View all work items</button>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Donut Chart */}
                  <div className="flex items-center justify-center">
                    <div className="relative w-64 h-64">
                      {/* Simple donut chart representation */}
                      <svg viewBox="0 0 100 100" className="w-full h-full">
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke="#e5e7eb"
                          strokeWidth="20"
                        />
                        {totalTasks > 0 && (
                          <>
                            {/* Completed (green) */}
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="none"
                              stroke="#22c55e"
                              strokeWidth="20"
                              strokeDasharray={`${(tasksByStatus.completed / totalTasks) * 251.2} 251.2`}
                              transform="rotate(-90 50 50)"
                            />
                            {/* In Progress (blue) */}
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="none"
                              stroke="#3b82f6"
                              strokeWidth="20"
                              strokeDasharray={`${(tasksByStatus.in_progress / totalTasks) * 251.2} 251.2`}
                              strokeDashoffset={-((tasksByStatus.completed / totalTasks) * 251.2)}
                              transform="rotate(-90 50 50)"
                            />
                            {/* Assigned (purple) */}
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="none"
                              stroke="#a855f7"
                              strokeWidth="20"
                              strokeDasharray={`${(tasksByStatus.assigned / totalTasks) * 251.2} 251.2`}
                              strokeDashoffset={-(((tasksByStatus.completed + tasksByStatus.in_progress) / totalTasks) * 251.2)}
                              transform="rotate(-90 50 50)"
                            />
                            {/* On Hold (amber) */}
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="none"
                              stroke="#f59e0b"
                              strokeWidth="20"
                              strokeDasharray={`${(tasksByStatus.on_hold / totalTasks) * 251.2} 251.2`}
                              strokeDashoffset={-(((tasksByStatus.completed + tasksByStatus.in_progress + tasksByStatus.assigned) / totalTasks) * 251.2)}
                              transform="rotate(-90 50 50)"
                            />
                            {/* Open (slate) */}
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="none"
                              stroke="#94a3b8"
                              strokeWidth="20"
                              strokeDasharray={`${(tasksByStatus.open / totalTasks) * 251.2} 251.2`}
                              strokeDashoffset={-(((tasksByStatus.completed + tasksByStatus.in_progress + tasksByStatus.assigned + tasksByStatus.on_hold) / totalTasks) * 251.2)}
                              transform="rotate(-90 50 50)"
                            />
                            {/* Cancelled (red) */}
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="none"
                              stroke="#ef4444"
                              strokeWidth="20"
                              strokeDasharray={`${(tasksByStatus.cancelled / totalTasks) * 251.2} 251.2`}
                              strokeDashoffset={-(((tasksByStatus.completed + tasksByStatus.in_progress + tasksByStatus.assigned + tasksByStatus.on_hold + tasksByStatus.open) / totalTasks) * 251.2)}
                              transform="rotate(-90 50 50)"
                            />
                          </>
                        )}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <p className="text-4xl font-bold text-foreground">{totalTasks}</p>
                        <p className="text-sm text-muted-foreground">Total work items</p>
                      </div>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex flex-col justify-center space-y-4">
                    <div className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 bg-green-500 rounded-sm"></div>
                        <span className="text-sm text-foreground">Done</span>
                      </div>
                      <span className="text-sm font-semibold text-foreground">{tasksByStatus.completed}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 bg-blue-500 rounded-sm"></div>
                        <span className="text-sm text-foreground">In Progress</span>
                      </div>
                      <span className="text-sm font-semibold text-foreground">{tasksByStatus.in_progress}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 bg-purple-500 rounded-sm"></div>
                        <span className="text-sm text-foreground">Assigned</span>
                      </div>
                      <span className="text-sm font-semibold text-foreground">{tasksByStatus.assigned}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 bg-slate-400 rounded-sm"></div>
                        <span className="text-sm text-foreground">Open</span>
                      </div>
                      <span className="text-sm font-semibold text-foreground">{tasksByStatus.open}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 bg-amber-500 rounded-sm"></div>
                        <span className="text-sm text-foreground">On Hold</span>
                      </div>
                      <span className="text-sm font-semibold text-foreground">{tasksByStatus.on_hold}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 bg-red-500 rounded-sm"></div>
                        <span className="text-sm text-foreground">Cancelled</span>
                      </div>
                      <span className="text-sm font-semibold text-foreground">{tasksByStatus.cancelled}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="flex-1 flex flex-col min-h-0">
              <CardHeader>
                <CardTitle>Recent activity</CardTitle>
                <CardDescription>Stay up to date with what's happening across the project.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activities.length > 0 ? activities.map((activity) => (
                    <div key={activity.id} className="flex gap-3 hover:bg-accent p-2 rounded-md">
                      {activity.userAvatar ? (
                        <img
                          src={activity.userAvatar}
                          alt={activity.userName}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                          {activity.userName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          {activity.userName && activity.userName !== 'User' ? (
                            <>
                              <span className="font-medium">{activity.userName}</span>{' '}
                              <span className="text-muted-foreground">{activity.action} {activity.resourceTitle}</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">
                              {activity.resourceTitle} {activity.action}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(activity.createdAt)}
                        </p>
                      </div>
                      <Badge className={
                        activity.action === 'created' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs' :
                          activity.action === 'updated' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs' :
                            activity.action === 'completed' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs' :
                              'bg-muted text-muted-foreground text-xs'
                      }>
                        {activity.action.toUpperCase()}
                      </Badge>
                    </div>
                  )) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">No recent activity</p>
                      <p className="text-xs mt-1">Start creating tasks to see activity here</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="board" className="flex-1 min-h-0 overflow-hidden flex flex-col mt-6">
            <ProjectBoardTab
              tasks={mainTasks}
              statusMetadata={statusMetadata}
              projectUsers={projectUsersWithAvatars}
              project={project}
              workspace={workspace}
              companyId={companyId}
              currentCompanyDomain={currentCompany?.domain}
              onDragEnd={(e) => handleKanbanDragEnd(e)}
              onDragStart={(e) => handleKanbanDragStart(e)}
              onDragCancel={() => handleKanbanDragCancel()}
              activeId={activeId}
              onTaskClick={handleViewTask}
              currentUserId={currentUser?.id}
              onCreateTask={handleCreateTask}
            />
          </TabsContent>

          <TabsContent value="timeline" className="flex-1 min-h-0 mt-6">
            {mainTasks.length > 0 ? (
              <GanttChart
                items={mainTasks.map(t => {
                  const assigneeUser = projectUsersWithAvatars?.find(u => u.id === (t.assignedUserId || t.assignedTo))

                  const ensureISO = (val: any) => {
                    if (!val) return undefined
                    if (typeof val === 'string') return val
                    if (val && typeof val.toDate === 'function') return val.toDate().toISOString()
                    if (val instanceof Date) return val.toISOString()
                    try {
                      return new Date(val).toISOString()
                    } catch {
                      return undefined
                    }
                  }

                  return {
                    id: t.id,
                    title: t.title,
                    // Use dueDate as fallback for startDate (single-day tasks)
                    startDate: ensureISO(t.startDate || t.dueDate),
                    // Use dueDate as fallback for endDate
                    endDate: ensureISO(t.endDate || t.dueDate),
                    dependencies: t.dependencies,
                    progress: t.progress,
                    status: t.status,
                    assignee: assigneeUser ? {
                      name: assigneeUser.name || 'Unknown',
                      avatar: assigneeUser.avatar
                    } : undefined,
                    reporterId: t.reporter || t.assignedBy, // Use reporter or creator
                    type: 'task' as const,
                    estimatedHours: t.estimatedHours,
                    createdAt: t.createdAt
                  }
                })}
                onItemClick={(item) => {
                  // Find the task and open the detail dialog
                  const task = tasks.find(t => t.id === item.id)
                  if (task) {
                    handleViewTask(task)
                  }
                }}
                onItemUpdate={async (updatedItem) => {
                  if (updatedItem.startDate && updatedItem.endDate && companyId) {
                    const task = tasks.find(t => t.id === updatedItem.id)
                    if (task && task.reporter !== currentUser?.id && !isAdmin) {
                      toast.error('You can only edit tasks created by you')
                      return
                    }
                    // 1. Optimistic Update: Update local state immediately for smooth animation
                    setTasks(prevTasks => prevTasks.map(t => {
                      if (t.id === updatedItem.id) {
                        return {
                          ...t,
                          startDate: updatedItem.startDate!,
                          endDate: updatedItem.endDate!,
                          dueDate: updatedItem.endDate! // Keep dueDate in sync with endDate
                        }
                      }
                      return t
                    }))

                    try {
                      // 2. Perform API call in background
                      await TaskTemplateService.updateTaskDates(
                        companyId,
                        updatedItem.id,
                        updatedItem.startDate,
                        updatedItem.endDate
                      )
                      toast.success('Task schedule successfully updated')
                    } catch (error) {
                      // 3. Rollback on failure
                      logger.error('Error updating task dates:', error)
                      toast.error('Failed to update task schedule. Please try again.')
                      // Revert to server state
                      const reverted = await TaskTemplateService.getProjectTasks(companyId, projectId)
                      setTasks(reverted)
                    }
                  }
                }}
              />
            ) : (
              <div className="text-center text-muted-foreground py-12">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p>No tasks in this project yet</p>
                <Button className="mt-4" onClick={handleCreateTask}>
                  Create Task
                </Button>
              </div>
            )}
          </TabsContent>

          {/* GOVERNANCE CONTENT */}
          <TabsContent value="governance" className="flex-1 min-h-0 overflow-y-auto scrollbar-ultrathin mt-6">
            <ProjectWorkflowAssignmentTab
              companyId={companyId || ''}
              projectId={projectId}
            />
          </TabsContent>

          {/* NEW WBS GANTT CONTENT */}
          <TabsContent value="wbs" className="flex-1 min-h-0 mt-6">
            <Card className="h-full flex flex-col min-h-0">
              <CardContent className="p-0 flex-1 overflow-hidden min-h-0">
                <WBSGanttChart
                  items={tasks}
                  projectId={projectId}
                  project={project}
                  projectUsers={projectUsersWithAvatars}
                  workspaceId={project.workspaceId}
                  onCreateTask={(isMilestone) => {
                    if (projectId) {
                      requestCreateTask(projectId, { isMilestone });
                    }
                  }}
                  onTasksImported={async (importedCount) => {
                    // Refresh tasks after import
                    if (companyId && projectId) {
                      try {
                        const refreshedTasks = await TaskTemplateService.getProjectTasks(companyId, projectId);
                        setTasks(refreshedTasks);
                        if (importedCount > 0) {
                          toast.success(`Imported ${importedCount} tasks`);
                        }
                      } catch (err) {
                        console.error('Failed to refresh tasks after import:', err);
                        toast.error('Failed to refresh tasks');
                      }
                    }
                  }}
                  onTaskClick={handleViewTask}
                  onTasksUpdate={async (updatedTasks) => {
                    if (!companyId) return;

                    // 1. Optimistic local update - sync dueDate with endDate for consistency
                    // 1. Optimistic local update - sync dueDate with endDate for consistency
                    setTasks(prev => {
                      const newTasks = [...prev];
                      updatedTasks.forEach(upd => {
                        const idx = newTasks.findIndex(t => t.id === upd.id);
                        if (idx !== -1 && newTasks[idx]) {
                          // Ensure dueDate is synced with endDate
                          const syncedTask = {
                            ...upd,
                            dueDate: upd.endDate || upd.dueDate || newTasks[idx]?.dueDate
                          };
                          newTasks[idx] = syncedTask;
                        }
                        if (idx !== -1 && newTasks[idx]) {
                          // Ensure dueDate is synced with endDate
                          const syncedTask = {
                            ...upd,
                            dueDate: upd.endDate || upd.dueDate || newTasks[idx]?.dueDate
                          };
                          newTasks[idx] = syncedTask;
                        }
                      });
                      return newTasks;
                    });

                    // 2. Persist to backend
                    try {
                      const updates = updatedTasks.map(t => ({
                        id: t.id,
                        startDate: t.startDate,
                        endDate: t.endDate,
                        dueDate: t.endDate || t.dueDate, // Include dueDate, synced with endDate
                        dependencies: t.dependencies
                      }));

                      await TaskTemplateService.updateMultipleTaskDates(companyId, updates, groupId ?? undefined);

                      // Refined toast message
                      if (updatedTasks.length === 1) {
                        toast.success('Task updated');
                      } else {
                        toast.success(`Successfully updated ${updatedTasks.length} tasks and adjusted schedule`);
                      }
                    } catch (err: any) {
                      console.error('Task Update Failed:', err);
                      toast.error(`Failed to save changes: ${err.message || 'Unknown error'}`);

                      // 3. Revert on error
                      const original = await TaskTemplateService.getProjectTasks(companyId, projectId, groupId ?? undefined);
                      setTasks(original);
                    }
                  }}
                  onTaskUpdate={async (updatedTask) => {
                    if (!companyId) return;
                    // Update Local State Optimistically - sync dueDate with endDate
                    setTasks(prev => prev.map(t => {
                      if (t.id === updatedTask.id) {
                        return {
                          ...updatedTask,
                          dueDate: updatedTask.endDate || updatedTask.dueDate || t.dueDate
                        };
                      }
                      return t;
                    }));
                    // Update Local State Optimistically - sync dueDate with endDate
                    setTasks(prev => prev.map(t => {
                      if (t.id === updatedTask.id) {
                        return {
                          ...updatedTask,
                          dueDate: updatedTask.endDate || updatedTask.dueDate || t.dueDate
                        };
                      }
                      return t;
                    }));

                    // Persist to Backend
                    try {
                      // If dates are being updated, use updateTaskDates to ensure dueDate sync
                      if (updatedTask.startDate && updatedTask.endDate) {
                        await TaskTemplateService.updateTaskDates(
                          companyId,
                          updatedTask.id,
                          updatedTask.startDate,
                          updatedTask.endDate,
                          groupId ?? undefined
                        );
                      } else {
                        // For non-date updates, use updateTaskStatus
                        const validDependencies = (updatedTask.dependencies || []).map(d => ({
                          targetTaskId: d.targetTaskId,
                          type: d.type || 'FS',
                          lag: d.lag || 0
                        }));

                        const payload: any = {
                          dependencies: validDependencies,
                          isMilestone: !!updatedTask.isMilestone
                        };

                        // Only add dates if they have values
                        if (updatedTask.startDate) payload.startDate = updatedTask.startDate;
                        if (updatedTask.endDate) {
                          payload.endDate = updatedTask.endDate;
                          payload.dueDate = updatedTask.endDate; // Sync dueDate with endDate
                        }

                        await TaskTemplateService.updateTaskStatus(companyId, updatedTask.id, updatedTask.status, payload, currentUser?.id, undefined, groupId ?? undefined);

                        toast.success('Task updated');
                      }
                    } catch (err: any) {
                      console.error('Task Update Failed:', err); // Log the real error
                      if (err.message) console.error(err.message);
                      toast.error(`Failed to save: ${err.message || 'Unknown error'}`);

                      // Revert on error
                      const original = await TaskTemplateService.getProjectTasks(companyId, projectId, groupId ?? undefined);
                      setTasks(original);
                    }
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="list" className="flex-1 min-h-0 flex flex-col overflow-hidden mt-6">
            <ProjectListTab
              tasks={tasks}
              loading={loading}
              projectUsers={projectUsersWithAvatars}
              statusMetadata={statusMetadata}
              loadingStatuses={loadingStatuses}
              projectFields={projectFields}
              companyId={companyId || ''}
              projectId={projectId}
              project={project}
              workspace={workspace}
              workspaceId={project?.workspaceId}
              groupId={groupId ?? undefined}
              currentCompanyDomain={currentCompany?.domain}
              formatTaskId={formatTaskId}
              selectedTaskIds={selectedTaskIds}
              onSelectAll={handleSelectAll}
              onSelectTask={handleSelectTask}
              onBulkStatusChange={(status) => handleBulkStatusChange(status, currentUser?.id)}
              onBulkAssigneeChange={(selection) => handleBulkAssigneeChange(selection, currentUser?.id)}
              onBulkDelete={() => handleBulkDelete(currentUser?.id)}
              sortColumn={sortColumn}
              onSort={handleSort}
              allColumns={allColumns}
              visibleOrderedColumns={visibleOrderedColumns}
              columnChooserOpen={columnChooserOpen}
              onOpenColumnChooser={() => setColumnChooserOpen(true)}
              onViewTask={handleViewTask}
              onUpdateTaskStatus={(taskId, status) => updateTaskStatus(taskId, status, currentUser?.id)}
              onUpdateTaskAssignee={handleUpdateTaskAssignee}
              onUpdateTaskValue={async (taskId, field, val) => {
                const task = tasks.find(t => t.id === taskId)
                if (task && task.reporter !== currentUser?.id && !isAdmin) {
                  toast.error('You can only edit tasks created by you')
                  return
                }
                await updateTaskValue(taskId, field, val)
              }}
              onUpdateTaskCustomField={handleUpdateTaskCustomField}
              onCreateTask={handleCreateTask}
              currentUserId={currentUser?.id}
              setTasks={setTasks}
              isAdmin={isAdmin}
            />
          </TabsContent>

          <TabsContent value="calendar" className="flex-1 min-h-0 overflow-hidden mt-6">
            <CalendarView
              projectId={projectId}
              workspaceId={project?.workspaceId || ''}
              tasks={mainTasks}
              onTasksChange={reloadTasks}
            />
          </TabsContent>

          <TabsContent value="dashboard" className="flex-1 min-h-0 mt-6">
            <DashboardContainer
              projectId={projectId}
              onTaskClick={(taskId) => {
                const task = tasks.find(t => t.id === taskId)
                if (task) handleViewTask(task)
              }}
            />
          </TabsContent>

          {projectViews.includes('project-info') && (
            <TabsContent value="project-info" className="flex-1 min-h-0 overflow-y-auto scrollbar-ultrathin mt-6">
              <ProjectInfoTab
                project={project!}
                projectUsers={projectUsersWithAvatars}
                workspaceMembers={workspace ? [...(workspace.members || []), workspace.ownerId].filter(id => id) : undefined}
                projectFields={projectFields}
                workspaceName={workspaceName}
                onUpdateField={handleUpdateProjectField}
                onUpdateProject={handleUpdateProject}
                onRemoveField={disableField}
                onAddField={() => setCustomFieldModalOpen(true)}
                userRole={currentCompanyUser?.role}
                isProjectManager={project?.manager === currentUser?.id}
                isWorkspaceOwner={workspace?.ownerId === currentUser?.id}
                isProjectCreator={project?.createdBy === currentUser?.id}
              />
            </TabsContent>
          )}

          {projectViews.includes('document-vault') && (
            <TabsContent value="document-vault" className="flex-1 min-h-0 mt-6">
              <DocumentVaultTab
                projectId={projectId}
                companyId={companyId || ''}
                groupId={groupId ?? undefined}
                tasks={tasks}
                projectUsers={projectUsersWithAvatars}
                onUploadSuccess={reloadTasks}
                userRole={currentCompanyUser?.role}
                projectCreatedBy={project?.createdBy}
                projectManager={project?.manager}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Task Detail Dialog */}
      {
        selectedTask && (
          <TaskDetailDialog
            task={selectedTask}
            groupId={groupId ?? undefined}
            project={project}
            open={taskDialogOpen}
            onOpenChange={(open) => {
              setTaskDialogOpen(open)
              if (!open) {
                setSelectedTask(null)
              }
            }}
            onUpdate={(task) => handleTaskUpdate(task, currentUser?.id)}
            projectFields={projectFields}
          />
        )
      }

      {/* Edit Project Dialog */}
      <EditProjectDialog
        project={project}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onUpdate={handleProjectUpdate}
      />

      {/* Delete Task Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteTaskDialog.open}
        onOpenChange={(open) => setDeleteTaskDialog({ open, task: null })}
        title="Delete Task"
        description={`Are you sure you want to delete "${deleteTaskDialog.task?.title}" ? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDeleteTaskConfirm}
      />

      {/* Create Custom Field Modal */}
      <CreateCustomFieldModal
        open={customFieldModalOpen || !!editingField}
        onOpenChange={(open) => {
          setCustomFieldModalOpen(open)
          if (!open) {
            // Reset editing field when modal closes
            setEditingField(null)
            // Reset selected field type when modal closes
            setSelectedFieldType(null)
          }
        }}
        projectId={projectId}
        companyId={companyId || ''}
        initialFieldType={selectedFieldType}
        editingField={editingField}
        onFieldCreated={async () => {
          await refreshCustomFields()
          // Reload project data to get new custom field values if initial value was set
          if (companyId && projectId) {
            const userId = useAuthStore.getState().user?.id
            const isGlobalAdmin = currentCompanyUser?.role === 'admin'
            const updatedProject = await ProjectService.getProject(companyId, projectId, userId, isGlobalAdmin, { groupId: groupId ?? undefined })
            if (updatedProject) setProject(updatedProject)
          }
          setSelectedFieldType(null)
          setEditingField(null)
        }}
      />

      {/* Column Chooser Dialog */}
      <ColumnChooser
        open={columnChooserOpen}
        onOpenChange={setColumnChooserOpen}
        columns={allColumns}
        visibleColumns={visibleColumns}
        onToggleColumn={handleToggleColumn}
        onReorderColumn={handleReorderColumn}
        customFields={projectFields}
        onAddCustomField={() => {
          setColumnChooserOpen(false)
          setCustomFieldModalOpen(true)
        }}
      />
      {/* Import Wizard */}
      <ImportWizard
        isOpen={importWizardOpen}
        onClose={() => {
          setImportWizardOpen(false)
          reloadTasks()
        }}
        importType={activeImportType}
        context={{
          companyId: companyId || '',
          projectId: projectId,
          workspaceId: project?.workspaceId || '',
          userId: currentUser?.id || ''
        }}
      />
    </DashboardLayout >
  )
}
