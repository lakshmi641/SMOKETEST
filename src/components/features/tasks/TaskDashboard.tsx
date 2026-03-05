'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCompany } from '@/hooks/useCompany'
import { useAuthStore } from '@/store/authStore'
import { TaskTemplateService, UserService, TaskMasterDataService, WorkspaceService, ProjectService } from '@/lib/services'
import { cn } from '@/lib/utils'
import { useStarredItems } from '@/hooks/useStarredItems'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { useProjectsQuery } from '@/hooks/queries/useProjectQueries'
import { useTaskTypesQuery } from '@/hooks/queries/useTaskTypesQuery'
import Link from 'next/link'
import type { EnhancedProject } from '@/types/project-schema'
import type { Workspace } from '@/types/workspace-schema'
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Play,
  CheckSquare,
  FileText,
  Filter,
  ArrowUp,
  ArrowDown,
  Search,
  Check,
  ChevronsUpDown,
  Users as UsersIcon,
  ArrowUpDown,
  Calendar,
  Hourglass,
  Star,
  Layers,
  User,
  UserPlus,
  X
} from 'lucide-react'
import { DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import type { GeneratedTask } from '@/types/task-template-schema'
import { TaskListView } from './TaskListView'
import { TaskKanbanView, DEFAULT_BOARD_COLUMN_CODES } from './TaskKanbanView'
import { GanttChart } from './gantt/GanttChart'
import { TaskForm } from './TaskForm'
import { TaskDetailDialog } from '@/components/issue/TaskDetailDialog'
import { ApprovalsTab } from './ApprovalsTab'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { isOverdue } from './utils'
import { formatTaskId } from '@/lib/utils/task-display'
import { TaskTableRow } from './TaskTableRow'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { format, differenceInDays } from 'date-fns'
import { collection, query, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { companySubcollectionPathSegments } from '@/lib/firestore-paths'

type TaskStatusOption = {
  code: string
  name: string
  color?: string
  isSystem?: boolean
}

const DEFAULT_STATUS_OPTIONS: TaskStatusOption[] = [
  { code: 'open', name: 'Open', color: '#94a3b8', isSystem: true },
  { code: 'assigned', name: 'Assigned', color: '#2563eb', isSystem: true },
  { code: 'in_progress', name: 'In Progress', color: '#3b82f6', isSystem: true },
  { code: 'on_hold', name: 'On Hold', color: '#f59e0b', isSystem: true },
  { code: 'approval_required', name: 'Approval Required', color: '#6366f1', isSystem: true },
  { code: 'completed', name: 'Completed', color: '#22c55e', isSystem: true },
  { code: 'cancelled', name: 'Cancelled', color: '#ef4444', isSystem: true },
]

export function TaskDashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentCompany, currentCompanyUser, groupId } = useCompany()
  const { user: currentUser } = useAuthStore()
  const isAdmin = currentCompanyUser?.role === 'owner' || currentCompanyUser?.role === 'admin'
  const { starredItems } = useStarredItems()
  const { workspaces: allWorkspaces } = useWorkspace()
  const [tasks, setTasks] = useState<GeneratedTask[]>([])
  const [users, setUsers] = useState<Array<{ id: string; name: string; avatar: string | null }>>([])
  const { data: allProjects = [] } = (useProjectsQuery as any)(
    currentCompany?.id,
    groupId ?? undefined,
    undefined, // Bypass userId filtering for metadata resolution
    true       // Pass true for isAdmin to bypass privacy filters
  )
  const [starredWorkspaces, setStarredWorkspaces] = useState<Workspace[]>([])
  const [loadingStarred, setLoadingStarred] = useState(true)

  const starredProjects = useMemo(() => {
    const starredProjectIds = Array.from(starredItems.projects || [])
    return allProjects.filter((p: any) => starredProjectIds.includes(p.id))
  }, [allProjects, starredItems.projects])

  // Deep linking handling
  useEffect(() => {
    const taskIdFromUrl = searchParams.get('task')
    if (taskIdFromUrl && tasks.length > 0) {
      const targetTask = tasks.find(t => t.id === taskIdFromUrl)
      if (targetTask) {
        setSelectedTask(targetTask)
        setTaskFormMode('view')
      }
    }
    const tabFromUrl = searchParams.get('tab')
    if (tabFromUrl === 'approvals') {
      setViewTab('approvals')
    }
  }, [searchParams, tasks])
  const [loading, setLoading] = useState(true)
  const [statusMetadata, setStatusMetadata] = useState<TaskStatusOption[]>(DEFAULT_STATUS_OPTIONS)
  const [loadingStatuses, setLoadingStatuses] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [taskTypeFilter, setTaskTypeFilter] = useState<Set<string>>(new Set())
  const [requirementTypeFilter, setRequirementTypeFilter] = useState<Set<string>>(new Set())
  const [reporterFilter, setReporterFilter] = useState<Set<string>>(new Set())
  const [assigneeFilter, setAssigneeFilter] = useState<Set<string>>(new Set())
  const [isSavingTask, setIsSavingTask] = useState(false)
  const [selectedTask, setSelectedTask] = useState<GeneratedTask | null>(null)
  const [activeTab, setActiveTab] = useState('table')
  const [viewTab, setViewTab] = useState<'assigned' | 'assigned_by_me' | 'starred' | 'boards' | 'approvals'>('assigned')
  const [approvalCount, setApprovalCount] = useState(0)
  const [taskFormMode, setTaskFormMode] = useState<'create' | 'edit' | 'view' | 'progress' | null>(null)
  const [progressUpdate, setProgressUpdate] = useState('')
  const [completionNotes, setCompletionNotes] = useState('')
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'createdAt', direction: 'desc' })

  // Drag and drop state
  const [activeId, setActiveId] = useState<string | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    task: GeneratedTask | null
  }>({ open: false, task: null })

  const [boardColumnCodes, setBoardColumnCodes] = useState<string[]>([...DEFAULT_BOARD_COLUMN_CODES])

  // List view table column widths (resizable)
  const LIST_TABLE_DEFAULT_WIDTHS: Record<string, number> = {
    checkbox: 40,
    task: 260,
    project: 140,
    reporter: 140,
    assignee: 140,
    taskType: 120,
    requirementType: 140,
    workspace: 120,
    priority: 100,
    status: 120,
    dueDate: 120,
  }
  const LIST_TABLE_MIN_WIDTH = 80
  const LIST_TABLE_MAX_WIDTH = 500
  const listTableColumnOrder = useMemo(
    () => (viewTab === 'assigned_by_me'
      ? ['checkbox', 'task', 'project', 'assignee', 'taskType', 'requirementType', 'workspace', 'priority', 'status', 'dueDate']
      : ['task', 'project', 'reporter', 'taskType', 'requirementType', 'workspace', 'priority', 'status', 'dueDate']),
    [viewTab]
  )

  const [listColumnWidths, setListColumnWidths] = useState<Record<string, number>>(LIST_TABLE_DEFAULT_WIDTHS)
  const [resizingColumnKey, setResizingColumnKey] = useState<string | null>(null)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)
  const resizeNextKey = useRef<string | null>(null)
  const resizeNextWidth = useRef(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem('pms_list_column_widths')
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, number>
        if (parsed && typeof parsed === 'object') {
          setListColumnWidths(prev => ({ ...LIST_TABLE_DEFAULT_WIDTHS, ...parsed }))
        }
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem('pms_list_column_widths', JSON.stringify(listColumnWidths))
    } catch {
      // ignore
    }
  }, [listColumnWidths])

  const handleListResizeStart = useCallback((columnKey: string, clientX: number) => {
    setResizingColumnKey(columnKey)
    resizeStartX.current = clientX
    resizeStartWidth.current = listColumnWidths[columnKey] ?? LIST_TABLE_DEFAULT_WIDTHS[columnKey] ?? 120
    const idx = listTableColumnOrder.indexOf(columnKey)
    const nextKey = idx >= 0 && idx < listTableColumnOrder.length - 1 ? listTableColumnOrder[idx + 1]! : null
    resizeNextKey.current = nextKey
    resizeNextWidth.current = nextKey ? (listColumnWidths[nextKey] ?? LIST_TABLE_DEFAULT_WIDTHS[nextKey] ?? 120) : 0
  }, [listColumnWidths, listTableColumnOrder])

  useEffect(() => {
    if (!resizingColumnKey) return
    const minW = LIST_TABLE_MIN_WIDTH
    const maxW = LIST_TABLE_MAX_WIDTH
    const onMove = (e: MouseEvent) => {
      const rawDelta = e.clientX - resizeStartX.current
      const nextKey = resizeNextKey.current
      let effectiveDelta = rawDelta
      if (nextKey && resizeNextWidth.current > 0) {
        const maxDelta = Math.min(maxW - resizeStartWidth.current, resizeNextWidth.current - minW)
        const minDelta = Math.max(minW - resizeStartWidth.current, -(resizeNextWidth.current - minW))
        effectiveDelta = Math.max(minDelta, Math.min(maxDelta, rawDelta))
      } else {
        effectiveDelta = Math.max(minW - resizeStartWidth.current, Math.min(maxW - resizeStartWidth.current, rawDelta))
      }
      const newCurrentW = resizeStartWidth.current + effectiveDelta
      setListColumnWidths(prev => {
        const next: Record<string, number> = { ...prev, [resizingColumnKey]: newCurrentW }
        if (nextKey) {
          next[nextKey] = resizeNextWidth.current - effectiveDelta
        }
        return next
      })
    }
    const onUp = () => {
      setResizingColumnKey(null)
      resizeNextKey.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => onUp()
  }, [resizingColumnKey])

  const getListColumnWidth = (key: string) => listColumnWidths[key] ?? LIST_TABLE_DEFAULT_WIDTHS[key] ?? 120

  const handleListResizeReset = useCallback((columnKey: string) => {
    const defaultW = LIST_TABLE_DEFAULT_WIDTHS[columnKey]
    if (defaultW != null) {
      setListColumnWidths(prev => ({ ...prev, [columnKey]: defaultW }))
    }
  }, [])

  // Task types from query hook
  const { taskTypeOptions } = useTaskTypesQuery(currentCompany?.id ?? undefined, groupId ?? undefined)
  const taskTypes = useMemo(
    () => taskTypeOptions.map((o) => ({ id: o.value, name: o.label })),
    [taskTypeOptions]
  )

  // Requirement types from database
  const [requirementTypesFromDb, setRequirementTypesFromDb] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    if (!currentCompany?.id) return
    const loadRequirementTypes = async () => {
      try {
        const reqTypes = await TaskMasterDataService.getRequirementTypes(currentCompany.id, groupId ?? undefined)
        setRequirementTypesFromDb(reqTypes?.map((r: { id: string; name: string }) => ({ id: r.id, name: r.name || r.id })) ?? [])
      } catch (e) {
        console.error('Error loading requirement types:', e)
      }
    }
    loadRequirementTypes()
  }, [currentCompany?.id, groupId])

  // Merge DB types with types found in tasks + add Unspecified option
  const requirementTypes = useMemo(() => {
    const seen = new Set<string>()
    const result: Array<{ id: string; name: string }> = []
    requirementTypesFromDb.forEach((r) => {
      if (!seen.has(r.id)) {
        seen.add(r.id)
        result.push(r)
      }
    })
    tasks.forEach((t) => {
      const rt = t.requirementType?.trim()
      if (rt && !seen.has(rt) && !result.some((r) => r.id === rt || r.name === rt)) {
        seen.add(rt)
        result.push({ id: rt, name: rt })
      }
    })
    result.sort((a, b) => a.name.localeCompare(b.name))
    result.unshift({ id: '__unspecified__', name: 'Unspecified' })
    return result
  }, [requirementTypesFromDb, tasks])

  // Reporter users: unique users who have reported tasks
  const reporterUsers = useMemo(() => {
    const reporterIds = new Set<string>()
    tasks.forEach(t => {
      const rid = (t as { reporter?: string }).reporter
      if (rid) reporterIds.add(rid)
    })
    const usersMap = new Map<string, { id: string; name: string }>()
    users.forEach((u) => {
      if (reporterIds.has(u.id)) usersMap.set(u.id, { id: u.id, name: u.name || u.id })
    })
    tasks.forEach(t => {
      const rid = (t as { reporter?: string }).reporter
      if (rid && !usersMap.has(rid)) {
        const name = (t as { reporterName?: string }).reporterName || rid
        usersMap.set(rid, { id: rid, name })
      }
    })
    return Array.from(usersMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [tasks, users])

  // Assignee users: unique users who have been assigned tasks
  const assigneeUsers = useMemo(() => {
    const assigneeIds = new Set<string>()
    tasks.forEach(t => {
      if (t.assignedUserId) assigneeIds.add(t.assignedUserId)
    })
    const usersMap = new Map<string, { id: string; name: string }>()
    users.forEach((u) => {
      if (assigneeIds.has(u.id)) usersMap.set(u.id, { id: u.id, name: u.name || u.id })
    })
    tasks.forEach(t => {
      if (t.assignedUserId && !usersMap.has(t.assignedUserId)) {
        const name = (t as { assignedToName?: string }).assignedToName || t.assignedUserId
        usersMap.set(t.assignedUserId, { id: t.assignedUserId, name })
      }
    })
    return Array.from(usersMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [tasks, users])

  useEffect(() => {
    if (!currentCompany?.id || typeof window === 'undefined') return
    const key = `pms_board_columns_${currentCompany.id}`
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw) as string[]
        if (Array.isArray(parsed) && parsed.length > 0) setBoardColumnCodes(parsed)
      }
    } catch {
      // ignore
    }
  }, [currentCompany?.id])

  const handleBoardColumnCodesChange = (codes: string[]) => {
    setBoardColumnCodes(codes)
    if (currentCompany?.id && typeof window !== 'undefined') {
      try {
        localStorage.setItem(`pms_board_columns_${currentCompany.id}`, JSON.stringify(codes))
      } catch {
        // ignore
      }
    }
  }

  const statusFilterOptions = [
    { value: 'all', label: 'All Tasks' },
    ...statusMetadata.map(status => ({
      value: status.code,
      label: status.name,
    })),
  ]

  const formatDateWithTime = (date: string) => {
    if (!date) return '-'
    // Import formatDate from utils at the top of the file
    // For now, we'll use a simple DD/MM/YYYY format
    const d = new Date(date)
    if (isNaN(d.getTime())) return '-'
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}/${month}/${year}`
  }

  const priorityOptions = [
    { value: 'all', label: 'All Priorities' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ]


  useEffect(() => {
    if (currentCompany?.id && currentUser?.id) {
      loadUserTasks()
      loadUsers()
    }
  }, [currentCompany?.id, currentUser?.id, groupId])

  useEffect(() => {
    if (currentCompany?.id) {
      loadUserTasks()
      loadUsers()
      loadTaskStatuses(currentCompany.id)
    }
  }, [currentCompany?.id, currentUser?.id, groupId])

  // Load starred workspaces (projects come from useProjectsQuery)
  useEffect(() => {
    if (!currentCompany?.id || !currentUser?.id) {
      setLoadingStarred(false)
      return
    }

    const loadStarredWorkspaces = async () => {
      try {
        setLoadingStarred(true)
        const isGlobalAdmin = currentUser.role === 'admin' || currentUser.role === 'owner'

        const allWorkspacesData = await WorkspaceService.getWorkspaces(
          groupId ?? currentCompany.id,
          currentCompany.id,
          {
            status: 'active',
            userId: currentUser.id,
            isGlobalAdmin
          }
        )

        const starredWorkspaceIds = Array.from(starredItems.workspaces || [])
        setStarredWorkspaces(allWorkspacesData.filter(w => starredWorkspaceIds.includes(w.id)))
      } catch (error) {
        console.error('Error loading starred items:', error)
      } finally {
        setLoadingStarred(false)
      }
    }

    loadStarredWorkspaces()
  }, [currentCompany?.id, currentUser?.id, currentUser?.role, starredItems.workspaces])

  // Real-time subscription for approval count (always active, not just when on approvals tab)
  useEffect(() => {
    if (!currentCompany?.id || !currentUser?.id || !groupId) {
      setApprovalCount(0)
      return
    }

    const segments = companySubcollectionPathSegments(groupId, currentCompany.id, 'approvalInstances')
    const q = query(collection(db, segments[0], ...segments.slice(1)))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let count = 0
      snapshot.docs.forEach(doc => {
        const instance = doc.data()
        if (instance.status !== 'in_progress') return

        // Check if current user is a pending approver in any active stage
        instance.stageInstances?.forEach((stage: any) => {
          if (stage.status !== 'active') return
          stage.assignedApprovers?.forEach((approver: any) => {
            if (approver.userId === currentUser.id && approver.status === 'pending') {
              count++
            }
          })
        })
      })
      setApprovalCount(count)
    }, (error) => {
      console.error('Error subscribing to approvals:', error)
      setApprovalCount(0)
    })

    return () => unsubscribe()
  }, [currentCompany?.id, currentUser?.id, groupId])

  // Listen for task created events from global Create Task button
  useEffect(() => {
    const handleTaskCreated = async (event: any) => {
      const newTask = event.detail?.task

      // If we have the task object, check if it should be in My Tasks
      if (newTask && currentUser?.id) {
        const isAssignedToMe = newTask.assignedUserId === currentUser.id
        const isReportedByMe = newTask.reporter === currentUser.id
        if (isAssignedToMe || isReportedByMe) {
          setTasks(prev => {
            if (prev.some(t => t.id === newTask.id)) return prev
            return [newTask, ...prev]
          })
          return
        }
      }

      // Fallback: Add a small delay to ensure Firestore write has propagated
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Silent reload - no loading spinner, task just appears!
      await loadUserTasks(true)
    }

    window.addEventListener('taskCreated', handleTaskCreated)
    return () => window.removeEventListener('taskCreated', handleTaskCreated)
  }, [currentCompany?.id, currentUser?.id])

  // Note: Global create task requests are handled by DashboardLayout
  // This component only handles local create task actions (e.e., "Add Task" button)

  async function loadUserTasks(silent = false) {
    if (!currentCompany?.id || !currentUser?.id) return

    try {
      // Only show loading spinner on initial load, not background refreshes
      if (!silent) {
        setLoading(true)
      }
      const userId = currentUser.id
      const tasksData = await TaskTemplateService.getUserTasks(currentCompany.id, userId, groupId ?? undefined)

      // Filter to show tasks assigned to the user OR reported by the user
      // Load ALL tasks including completed - filtering for display is handled separately
      const myTasks = tasksData.filter(task => {
        const isAssignedToMe = task.assignedUserId === userId
        const isReportedByMe = task.reporter === userId
        return isAssignedToMe || isReportedByMe
      });

      // Fetch project names for tasks that have projectId
      const projectIds = Array.from(new Set(myTasks.map(t => t.projectId).filter(Boolean) as string[]))
      const projectNameMap = new Map<string, string>()

      if (projectIds.length > 0) {
        await Promise.all(
          projectIds.map(async (projectId) => {
            try {
              const project = await ProjectService.getProject(currentCompany.id, projectId, userId, false, { groupId: groupId ?? undefined })
              if (project) {
                projectNameMap.set(projectId, project.name)
              }
            } catch (error) {
              console.warn(`Failed to fetch project ${projectId} for task list:`, error)
            }
          })
        )
      }

      // Note: We don't enrich here anymore, we do it reactively in derivedTasks
      // This prevents race conditions where workspaces/projects aren't loaded yet

      // Sort by creation date desc (newest first)
      myTasks.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime()
        const dateB = new Date(b.createdAt || 0).getTime()
        return dateB - dateA
      })

      setTasks(myTasks)
    } catch (error) {
      console.error('Error loading user tasks:', error)
    } finally {
      setLoading(false)
    }
  }


  async function loadUsers() {
    if (!currentCompany?.id) return
    try {
      const list = await UserService.getUsers(currentCompany.id, groupId ?? undefined)
      setUsers(list.map(u => ({
        id: u.id,
        name: u.name || u.email || 'Unnamed User',
        avatar: u.avatar || null
      })))
    } catch (e) {
      console.error('Error loading users:', e)
    }
  }

  async function loadTaskStatuses(companyId: string) {
    try {
      setLoadingStatuses(true)
      const statuses = await (TaskMasterDataService as any).getTaskStatuses(companyId, groupId ?? undefined)

      // Start with system default statuses
      const statusMap = new Map<string, TaskStatusOption>()
      DEFAULT_STATUS_OPTIONS.forEach(status => {
        statusMap.set(status.code, { ...status })
      })

      // Override with Firestore statuses (allows customization of names/colors)
      if (statuses.length > 0) {
        statuses.forEach((status: any) => {
          statusMap.set(status.code, {
            code: status.code,
            name: status.name,
            color: status.color,
            isSystem: status.isSystem,
          })
        })
      }

      // Convert map to array maintaining order from DEFAULT_STATUS_OPTIONS first, then any custom ones
      const mergedStatuses: TaskStatusOption[] = []
      DEFAULT_STATUS_OPTIONS.forEach(status => {
        const merged = statusMap.get(status.code)
        if (merged) mergedStatuses.push(merged)
      })
      // Add any custom statuses not in defaults
      statuses.forEach((status: any) => {
        if (!DEFAULT_STATUS_OPTIONS.some(d => d.code === status.code)) {
          mergedStatuses.push({
            code: status.code,
            name: status.name,
            color: status.color,
            isSystem: status.isSystem,
          })
        }
      })

      setStatusMetadata(mergedStatuses)
      const availableCodes = new Set(mergedStatuses.map(status => status.code))
      // Remove any selected statuses that no longer exist
      setStatusFilter(prev => {
        const filtered = new Set([...prev].filter(code => availableCodes.has(code)))
        return filtered.size !== prev.size ? filtered : prev
      })
    } catch (error) {
      console.error('Error loading task statuses:', error)
      setStatusMetadata(DEFAULT_STATUS_OPTIONS)
      setStatusFilter(new Set())
    } finally {
      setLoadingStatuses(false)
    }
  }

  const userIdToName = (userId?: string) => {
    if (!userId) return ''
    const found = users.find(u => u.id === userId)
    return found?.name || userId
  }

  const userIdToAvatar = (userId?: string) => {
    if (!userId) return null
    const found = users.find(u => u.id === userId)
    return found?.avatar || null
  }

  async function handleTaskFormSubmit(data: any) {
    if (!currentCompany?.id || !currentUser?.id || !data.title || !data.dueDate) {
      return
    }
    setIsSavingTask(true)
    try {
      const userId = currentUser.id

      if (taskFormMode === 'edit' && selectedTask?.id) {
        await TaskTemplateService.updateTaskStatus(currentCompany.id, selectedTask.id, selectedTask.status, {
          title: data.title,
          description: data.description,
          priority: data.priority,
          estimatedHours: data.estimatedHours,
          dueDate: data.dueDate,
          assignedUserId: data.assignee || selectedTask.assignedUserId,
          reporter: data.reporter || selectedTask.reporter,
          orgUnitId: data.orgUnitId,
          orgUnitName: data.orgUnitName,
          team: data.team,
          taskType: data.taskType,
          requirementType: data.requirementType,
          workflowDefinitionId: data.workflowDefinitionId,
          escalationPolicyId: data.escalationPolicyId,
        }, undefined, false, groupId ?? undefined)

        setTaskFormMode(null)
        await loadUserTasks(true) // Silent refresh
        toast.success('Task updated!')
      }
    } catch (error) {
      console.error('Error saving task:', error)
      toast.error('Failed to save task')
    } finally {
      setIsSavingTask(false)
    }
  }

  async function handleProgressUpdate() {
    if (!currentCompany?.id || !progressUpdate || !selectedTask?.id) {
      return
    }

    try {
      const progress = parseInt(progressUpdate)
      if (progress >= 0 && progress <= 100) {
        await TaskTemplateService.updateTaskProgress(
          currentCompany.id,
          selectedTask.id,
          progress,
          completionNotes,
          groupId ?? undefined
        )
        setProgressUpdate('')
        setCompletionNotes('')
        setTaskFormMode(null)
        await loadUserTasks()
      }
    } catch (error) {
      console.error('Error updating task progress:', error)
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
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
        if (!currentCompany?.id) throw new Error('Missing company')
        await TaskTemplateService.updateBoardOrder(currentCompany.id, updates, groupId ?? undefined)
      } catch (error) {
        console.error('Error saving board order:', error)
        toast.error('Failed to save task order')
        // Revert optimistic update by reloading tasks
        await loadUserTasks(true)
      }
      return
    }

    // ── CASE B: Cross-column drop — change status ─────────────────────────
    // Resolve status (could be dropped on another task)
    let newStatus = over.id as string
    if (overTask) {
      newStatus = overTask.status
    }

    // Validate status
    const validStatusOptions = statusMetadata.map(s => s.code)
    if (!validStatusOptions.includes(newStatus)) {
      return
    }

    if (task.status === newStatus) return

    // Status restriction: Cannot change from 'assigned' to other statuses except 'in_progress'
    if (task.status === assignedStatusCode && newStatus !== inProgressStatusCode) {
      toast.error('Please start the task first before changing to this status')
      return
    }

    setTasks(prevTasks => {
      const updated = prevTasks.map(t =>
        t.id === taskId ? { ...t, status: newStatus as GeneratedTask['status'] } : t
      )
      return updated
    })

    try {
      await TaskTemplateService.updateTaskStatus(
        currentCompany?.id || '',
        taskId,
        newStatus as GeneratedTask['status'],
        undefined,
        undefined,
        false,
        groupId ?? undefined
      )
    } catch (error) {
      console.error('Error updating task status:', error)
      toast.error('Failed to update status')
      await loadUserTasks(true)
    }
  }

  function handleDragStart(event: any) {
    setActiveId(event.active.id as string)
  }

  function handleDragCancel() {
    setActiveId(null)
  }

  async function updateTaskStatus(taskId: string, status: GeneratedTask['status']) {
    if (!currentCompany?.id || !taskId) {
      console.error('Cannot update task status: missing company or task ID')
      return
    }

    try {
      await TaskTemplateService.updateTaskStatus(
        currentCompany.id,
        taskId,
        status,
        undefined,
        undefined,
        false,
        groupId ?? undefined
      )
      await loadUserTasks()
    } catch (error) {
      console.error('Error updating task status:', error)
    }
  }

  async function updateTaskProgress(taskId: string) {
    if (!currentCompany?.id || !progressUpdate || !taskId) {
      console.error('Cannot update task progress: missing company, progress, or task ID')
      return
    }

    try {
      const progress = parseInt(progressUpdate)
      if (progress >= 0 && progress <= 100) {
        await TaskTemplateService.updateTaskProgress(
          currentCompany.id,
          taskId,
          progress,
          completionNotes,
          groupId ?? undefined
        )
        setProgressUpdate('')
        setCompletionNotes('')
        await loadUserTasks()
      }
    } catch (error) {
      console.error('Error updating task progress:', error)
    }
  }

  const handleDeleteTaskClick = (task: GeneratedTask) => {
    // Permission check: Only creator (reporter) can delete, unless admin
    const isCreator = task.reporter === currentUser?.id

    if (isCreator || isAdmin) {
      setDeleteDialog({ open: true, task })
    } else {
      toast.error('You can only delete tasks you created')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.task || !currentCompany?.id) return

    try {
      await TaskTemplateService.deleteTask(currentCompany.id, deleteDialog.task.id!, groupId ?? undefined)

      // Remove from local state immediately
      setTasks(prev => prev.filter(t => t.id !== deleteDialog.task!.id))

      toast.success('Task deleted successfully')
      setDeleteDialog({ open: false, task: null })
    } catch (error) {
      console.error('Error deleting task:', error)
      toast.error('Failed to delete task')
    }
  }

  // Reactive enrichment: Merge tasks with latest workspace/project data and display names for sorting
  const derivedTasks = useMemo(() => {
    return tasks.map(task => {
      // Find project to potentially get workspaceId from it
      const project = allProjects.find((p: any) => p.id === task.projectId)

      // Use task's workspaceId if available, fall back to project's workspaceId
      const workspaceId = task.workspaceId || project?.workspaceId
      const workspace = allWorkspaces.find(w => w.id === workspaceId)

      const reporterDisplayName = task.reporter
        ? (users.find(u => u.id === task.reporter)?.name || (task as any).reporterName || task.reporter)
        : ''
      const assigneeDisplayName = task.assignedUserId
        ? (users.find(u => u.id === task.assignedUserId)?.name || (task as any).assignedToName || task.assignedUserId)
        : ''

      return {
        ...task,
        workspaceName: workspace?.name || (task as any).workspaceName,
        // Prioritize reactive project name, fallback to what's on the task
        projectName: project?.name || task.projectName,
        reporterDisplayName,
        assigneeDisplayName
      }
    })
  }, [tasks, allWorkspaces, allProjects, users])

  const filteredTasks = derivedTasks.filter(task => {
    if (!task || typeof task !== 'object') return false

    // Tab filtering
    if ((viewTab === 'assigned' || viewTab === 'boards') && task.assignedUserId !== currentUser?.id) return false
    if (viewTab === 'assigned_by_me') {
      // Must be reported by me
      if (task.reporter !== currentUser?.id) return false
    }

    // Show all tasks assigned to the user, including subtasks
    const matchesSearch = (task.title?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (task.description?.toLowerCase().includes(searchTerm.toLowerCase()) || false)

    // When no status filter is selected, we only show ACTIVE tasks (incomplete)
    // To see completed/cancelled tasks, user must explicitly select those filters
    const matchesStatus = statusFilter.size === 0
      ? !['completed', 'cancelled'].includes(task.status)
      : statusFilter.has(task.status)
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter

    // Task type filter
    if (taskTypeFilter.size > 0) {
      const match = task.taskType && taskTypes.some((t) => (task.taskType === t.id || task.taskType === t.name) && taskTypeFilter.has(t.id))
      if (!match) return false
    }

    // Requirement type filter
    if (requirementTypeFilter.size > 0) {
      const hasReqType = task.requirementType?.trim()
      const matchUnspecified = requirementTypeFilter.has('__unspecified__') && !hasReqType
      const matchTyped = hasReqType && requirementTypes.some((r) => r.id !== '__unspecified__' && (task.requirementType === r.id || task.requirementType === r.name) && requirementTypeFilter.has(r.id))
      if (!matchUnspecified && !matchTyped) return false
    }

    // Reporter filter (for "assigned to me" and "boards" tabs)
    if ((viewTab === 'assigned' || viewTab === 'boards') && reporterFilter.size > 0) {
      const rid = (task as { reporter?: string }).reporter
      if (!rid || !reporterFilter.has(rid)) return false
    }

    // Assignee filter (only for "assigned by me" tab)
    if (viewTab === 'assigned_by_me' && assigneeFilter.size > 0) {
      if (!task.assignedUserId || !assigneeFilter.has(task.assignedUserId)) return false
    }

    return matchesSearch && matchesStatus && matchesPriority
  }).sort((a, b) => {
    if (!sortConfig) return 0
    const { key, direction } = sortConfig
    let valA: any = (a as any)[key]
    let valB: any = (b as any)[key]

    // Priority weighted sorting
    if (key === 'priority') {
      const weights: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 }
      valA = weights[(a.priority || 'medium').toLowerCase()] || 0
      valB = weights[(b.priority || 'medium').toLowerCase()] || 0
    }

    // String sorting (normalize empty to '' for consistent order)
    const dateKeys = ['startDate', 'dueDate', 'endDate', 'createdAt', 'actualStartDate', 'actualEndDate']
    if (!dateKeys.includes(key) && key !== 'priority' && key !== 'duration') {
      if (typeof valA === 'string') valA = valA.toLowerCase()
      else if (valA == null || valA === '') valA = ''
      if (typeof valB === 'string') valB = valB.toLowerCase()
      else if (valB == null || valB === '') valB = ''
    }

    // Duration calculation sorting
    if (key === 'duration') {
      const startA = new Date(a.startDate || a.createdAt || 0).getTime()
      const endA = new Date(a.endDate || a.dueDate || 0).getTime()
      const startB = new Date(b.startDate || b.createdAt || 0).getTime()
      const endB = new Date(b.endDate || b.dueDate || 0).getTime()
      valA = endA - startA
      valB = endB - startB
    }

    // Date sorting safety
    if (key === 'startDate' || key === 'dueDate' || key === 'endDate' || key === 'createdAt' || key === 'actualStartDate' || key === 'actualEndDate') {
      valA = valA ? new Date(valA).getTime() : 0
      valB = valB ? new Date(valB).getTime() : 0
    }

    if (valA < valB) return direction === 'asc' ? -1 : 1
    if (valA > valB) return direction === 'asc' ? 1 : -1
    return 0
  })

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { key, direction: 'asc' }
    })
  }

  const renderSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="h-3 w-3 opacity-30 ml-2" />
    return sortConfig.direction === 'asc' ?
      <ArrowUp className="h-3 w-3 text-blue-600 ml-2 animate-in fade-in zoom-in-50" /> :
      <ArrowDown className="h-3 w-3 text-blue-600 ml-2 animate-in fade-in zoom-in-50" />
  }

  const assignedStatus = statusMetadata.find(status => status.code === 'assigned')
  const inProgressStatusMeta = statusMetadata.find(status => status.code === 'in_progress')
  const completedStatusMeta = statusMetadata.find(status => status.code === 'completed')
  const assignedStatusCode = (assignedStatus?.code ?? 'assigned') as GeneratedTask['status']
  const inProgressStatusCode = (inProgressStatusMeta?.code ?? 'in_progress') as GeneratedTask['status']
  const completedStatusCode = (completedStatusMeta?.code ?? 'completed') as GeneratedTask['status']

  const taskStats = {
    total: tasks.length,
    assigned: tasks.filter(t => t.status === assignedStatusCode).length,
    inProgress: tasks.filter(t => t.status === inProgressStatusCode).length,
    completed: tasks.filter(t => t.status === completedStatusCode).length,
    overdue: tasks.filter(t => isOverdue(t)).length,
    assignedToMe: tasks.filter(t => t.assignedUserId === currentUser?.id).length,
    assignedByMe: tasks.filter(t => t.reporter === currentUser?.id).length,
  }

  // Group tasks by status for Jira-style display - MUST be before any early returns
  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, GeneratedTask[]> = {}
    filteredTasks.forEach(task => {
      const status = task.status || 'open'
      if (!grouped[status]) {
        grouped[status] = []
      }
      grouped[status].push(task)
    })
    return grouped
  }, [filteredTasks])

  // Get status display order - match Jira style
  const statusOrder = ['in_progress', 'assigned', 'open', 'on_hold', 'approval_required', 'escalated', 'completed', 'cancelled']
  const statusDisplayNames: Record<string, string> = {
    'in_progress': 'IN PROGRESS',
    'assigned': 'TO DO',
    'open': 'TO DO',
    'on_hold': 'ON HOLD',
    'approval_required': 'APPROVAL REQUIRED',
    'escalated': 'ESCALATED',
    'completed': 'DONE',
    'cancelled': 'CANCELLED'
  }

  // Status display names for task items (right side)
  const getStatusDisplayName = (status: string) => {
    const statusMeta = statusMetadata.find(s => s.code === status)
    if (statusMeta) return statusMeta.name
    if (status === 'in_progress') return 'In Progress'
    if (status === 'assigned' || status === 'open') return 'To Do'
    return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')
  }

  // Check if any filters are active
  const hasFiltersActive = statusFilter.size > 0 || taskTypeFilter.size > 0 || requirementTypeFilter.size > 0 || reporterFilter.size > 0 || assigneeFilter.size > 0
  const clearFilters = () => {
    setStatusFilter(new Set())
    setTaskTypeFilter(new Set())
    setRequirementTypeFilter(new Set())
    setReporterFilter(new Set())
    setAssigneeFilter(new Set())
  }

  // FilterPopover component for multi-select filters
  const FilterPopover = ({
    label,
    icon: Icon,
    count,
    children,
  }: {
    label: string
    icon: React.ElementType
    count: number
    children: React.ReactNode
  }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={count > 0 ? 'default' : 'outline'}
          size="sm"
          className={cn('h-9 gap-1.5', count > 0 && 'bg-primary text-primary-foreground')}
        >
          <Icon className="h-4 w-4" />
          {label}
          {count > 0 && (
            <span className="ml-1 h-4 min-w-4 px-1 rounded-full bg-primary-foreground/20 text-xs flex items-center justify-center">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        {children}
      </PopoverContent>
    </Popover>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your tasks...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div>
          {/* Jira-style Tabs - Horizontal with underline */}
          <div className="border-b border-border mb-4">
            <div className="flex items-center gap-6">
              <button
                onClick={() => setViewTab('assigned')}
                className={cn(
                  "px-0 py-3 text-sm font-medium border-b-2 border-transparent transition-colors relative",
                  viewTab === 'assigned'
                    ? "text-primary border-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Assigned to me {taskStats.assignedToMe > 0 && `(${taskStats.assignedToMe})`}
              </button>

              <button
                onClick={() => setViewTab('assigned_by_me')}
                className={cn(
                  "px-0 py-3 text-sm font-medium border-b-2 border-transparent transition-colors relative",
                  viewTab === 'assigned_by_me'
                    ? "text-primary border-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Assigned by me {taskStats.assignedByMe > 0 && `(${taskStats.assignedByMe})`}
              </button>
              <button
                onClick={() => setViewTab('starred')}
                className={cn(
                  "px-0 py-3 text-sm font-medium border-b-2 border-transparent transition-colors",
                  viewTab === 'starred'
                    ? "text-primary border-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Starred
              </button>
              <button
                onClick={() => setViewTab('boards')}
                className={cn(
                  "px-0 py-3 text-sm font-medium border-b-2 border-transparent transition-colors",
                  viewTab === 'boards'
                    ? "text-primary border-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Boards
              </button>
              <button
                onClick={() => setViewTab('approvals')}
                className={cn(
                  "px-0 py-3 text-sm font-medium border-b-2 border-transparent transition-colors",
                  viewTab === 'approvals'
                    ? "text-primary border-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Approvals {approvalCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                    {approvalCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Quick Access & Starred Projects - Horizontal Layout */}
          {viewTab === 'starred' && (
            <div className="mb-6">
              {/* Starred Projects - Horizontal Scroll */}
              {starredProjects.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Starred Projects</h3>
                  <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
                    {starredProjects.map((project: any) => (
                      <Link key={project.id} href={`/projects/${project.id}`} className="flex-shrink-0">
                        <Card className="cursor-pointer hover:shadow-md transition-all w-64">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between gap-4 mb-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div
                                  className="w-4 h-4 rounded-sm flex-shrink-0"
                                  style={{ backgroundColor: project.color || '#3b82f6' }}
                                />
                                <span className="text-sm font-bold truncate">{project.name}</span>
                              </div>
                              {project.status && (
                                <Badge variant="outline" className="text-[10px] h-5 px-1.5 shrink-0">
                                  {project.status}
                                </Badge>
                              )}
                            </div>
                            {project.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
                                {project.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                              {project.projectCode && (
                                <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">{project.projectCode}</span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Starred Workspaces - Horizontal Scroll */}
              {starredWorkspaces.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Starred Workspaces</h3>
                  <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
                    {starredWorkspaces.map((workspace) => (
                      <Link key={workspace.id} href={`/workspaces/${workspace.id}`} className="flex-shrink-0">
                        <Card className="cursor-pointer hover:shadow-md transition-all w-64">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between gap-4 mb-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div
                                  className="w-4 h-4 rounded-sm flex-shrink-0"
                                  style={{ backgroundColor: workspace.color || '#3b82f6' }}
                                />
                                <span className="text-sm font-bold truncate">{workspace.name}</span>
                              </div>
                              {workspace.status && (
                                <Badge variant="outline" className="text-[10px] h-5 px-1.5 shrink-0">
                                  {workspace.status}
                                </Badge>
                              )}
                            </div>
                            {workspace.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
                                {workspace.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground min-h-[1.25rem]">
                              {/* Bottom row for consistency if needed later */}
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {!loadingStarred && starredProjects.length === 0 && starredWorkspaces.length === 0 && (
                <div className="text-center py-12">
                  <Star className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No starred projects or workspaces</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Star projects or workspaces to see them here</p>
                </div>
              )}

              {loadingStarred && (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-sm text-muted-foreground">Loading starred items...</p>
                </div>
              )}
            </div>
          )}

          {/* Search and Filters - Show for assigned, assigned_by_me, and boards tabs */}
          {(viewTab === 'assigned' || viewTab === 'assigned_by_me' || viewTab === 'boards') && (
            <div className="flex items-center gap-3 flex-wrap mb-4" style={{ marginLeft: '2px' }}>
              <Input
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-xs h-9"
              />
              {/* Status filter - hide for boards view since columns already show status */}
              {viewTab !== 'boards' && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={statusFilter.size > 0 ? 'default' : 'outline'}
                      size="sm"
                      className={cn('h-9 gap-1.5', statusFilter.size > 0 && 'bg-primary text-primary-foreground')}
                    >
                      <CheckCircle className="h-4 w-4" />
                      Status
                      {statusFilter.size > 0 && (
                        <span className="ml-1 h-4 min-w-4 px-1 rounded-full bg-primary-foreground/20 text-xs flex items-center justify-center">
                          {statusFilter.size}
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-3" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <p className="text-sm font-medium mb-2">Status</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {statusMetadata.map(status => (
                        <label key={status.code} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={statusFilter.has(status.code)}
                            onCheckedChange={(checked) => {
                              setStatusFilter(prev => {
                                const next = new Set(prev)
                                if (checked) next.add(status.code)
                                else next.delete(status.code)
                                return next
                              })
                            }}
                          />
                          <span className="text-sm">{status.name}</span>
                        </label>
                      ))}
                      {statusMetadata.length === 0 && (
                        <p className="text-sm text-muted-foreground">No statuses</p>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              <FilterPopover label="Task type" icon={Layers} count={taskTypeFilter.size}>
                <p className="text-sm font-medium mb-2">Task type</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {taskTypes.map(t => (
                    <label key={t.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={taskTypeFilter.has(t.id)}
                        onCheckedChange={(checked) => {
                          setTaskTypeFilter(prev => {
                            const next = new Set(prev)
                            if (checked) next.add(t.id)
                            else next.delete(t.id)
                            return next
                          })
                        }}
                      />
                      <span className="text-sm">{t.name}</span>
                    </label>
                  ))}
                  {taskTypes.length === 0 && (
                    <p className="text-sm text-muted-foreground">No task types</p>
                  )}
                </div>
              </FilterPopover>
              <FilterPopover label="Requirement type" icon={FileText} count={requirementTypeFilter.size}>
                <p className="text-sm font-medium mb-2">Requirement type</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {requirementTypes.map(r => (
                    <label key={r.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={requirementTypeFilter.has(r.id)}
                        onCheckedChange={(checked) => {
                          setRequirementTypeFilter(prev => {
                            const next = new Set(prev)
                            if (checked) next.add(r.id)
                            else next.delete(r.id)
                            return next
                          })
                        }}
                      />
                      <span className="text-sm">{r.name}</span>
                    </label>
                  ))}
                  {requirementTypes.length === 0 && (
                    <p className="text-sm text-muted-foreground">No requirement types</p>
                  )}
                </div>
              </FilterPopover>
              {/* Reporter filter - for "Assigned to me" and "Boards" tabs */}
              {(viewTab === 'assigned' || viewTab === 'boards') && (
                <FilterPopover label="Reporter" icon={User} count={reporterFilter.size}>
                  <p className="text-sm font-medium mb-2">Reporter</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {reporterUsers.map(u => (
                      <label key={u.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={reporterFilter.has(u.id)}
                          onCheckedChange={(checked) => {
                            setReporterFilter(prev => {
                              const next = new Set(prev)
                              if (checked) next.add(u.id)
                              else next.delete(u.id)
                              return next
                            })
                          }}
                        />
                        <span className="text-sm">{u.name}</span>
                      </label>
                    ))}
                    {reporterUsers.length === 0 && (
                      <p className="text-sm text-muted-foreground">No reporters</p>
                    )}
                  </div>
                </FilterPopover>
              )}
              {/* Assignee filter - only for "Assigned by me" tab */}
              {viewTab === 'assigned_by_me' && (
                <FilterPopover label="Assignee" icon={UserPlus} count={assigneeFilter.size}>
                  <p className="text-sm font-medium mb-2">Assignee</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {assigneeUsers.map(u => (
                      <label key={u.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={assigneeFilter.has(u.id)}
                          onCheckedChange={(checked) => {
                            setAssigneeFilter(prev => {
                              const next = new Set(prev)
                              if (checked) next.add(u.id)
                              else next.delete(u.id)
                              return next
                            })
                          }}
                        />
                        <span className="text-sm">{u.name}</span>
                      </label>
                    ))}
                    {assigneeUsers.length === 0 && (
                      <p className="text-sm text-muted-foreground">No assignees</p>
                    )}
                  </div>
                </FilterPopover>
              )}
              {hasFiltersActive && (
                <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground" onClick={clearFilters}>
                  <X className="h-4 w-4" />
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Tasks grouped by status - Jira Style */}
        <div className="flex-1 overflow-y-auto pb-6">
          {(viewTab === 'assigned' || viewTab === 'assigned_by_me') && (
            <div className="border rounded-md overflow-hidden">
              <Table style={{ tableLayout: 'fixed', width: '100%' }}>
                <colgroup>
                  {viewTab === 'assigned_by_me' && <col style={{ width: getListColumnWidth('checkbox') }} />}
                  <col style={{ width: getListColumnWidth('task') }} />
                  <col style={{ width: getListColumnWidth('project') }} />
                  <col style={{ width: viewTab === 'assigned' ? getListColumnWidth('reporter') : getListColumnWidth('assignee') }} />
                  <col style={{ width: getListColumnWidth('taskType') }} />
                  <col style={{ width: getListColumnWidth('requirementType') }} />
                  <col style={{ width: getListColumnWidth('workspace') }} />
                  <col style={{ width: getListColumnWidth('priority') }} />
                  <col style={{ width: getListColumnWidth('status') }} />
                  <col style={{ width: getListColumnWidth('dueDate') }} />
                </colgroup>
                <TableHeader>
                  <TableRow>
                    {viewTab === 'assigned_by_me' && (
                      <TableHead className="relative w-0 group overflow-visible">
                        <div className="flex items-center justify-center">
                          <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-3 min-w-3 cursor-col-resize border-r border-border/50 group-hover:border-primary group-hover:bg-primary/20 hover:bg-primary/25 transition-colors z-20 flex items-center justify-center select-none"
                          onMouseDown={(e) => { e.preventDefault(); if (e.button === 0) handleListResizeStart('checkbox', e.clientX) }}
                          onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); handleListResizeReset('checkbox') }}
                          title="Drag to resize; double-click to reset"
                        >
                          <span className="w-0.5 h-4 rounded-full bg-muted-foreground/30 group-hover:bg-primary/70 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" aria-hidden />
                        </div>
                      </TableHead>
                    )}
                    <TableHead className="relative w-0 group overflow-visible">
                      <button type="button" onClick={() => handleSort('title')} className="flex items-center font-medium hover:text-foreground transition-colors w-full text-left">
                        Task
                        {renderSortIcon('title')}
                      </button>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-3 min-w-3 cursor-col-resize border-r border-border/50 group-hover:border-primary group-hover:bg-primary/20 hover:bg-primary/25 transition-colors z-20 flex items-center justify-center select-none"
                        onMouseDown={(e) => { e.preventDefault(); if (e.button === 0) handleListResizeStart('task', e.clientX) }}
                        onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); handleListResizeReset('task') }}
                        title="Drag to resize; double-click to reset"
                      >
                        <span className="w-0.5 h-4 rounded-full bg-muted-foreground/30 group-hover:bg-primary/70 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" aria-hidden />
                      </div>
                    </TableHead>
                    <TableHead className="relative w-0 group overflow-visible">
                      <button type="button" onClick={() => handleSort('projectName')} className="flex items-center font-medium hover:text-foreground transition-colors w-full text-left">
                        Project
                        {renderSortIcon('projectName')}
                      </button>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-3 min-w-3 cursor-col-resize border-r border-border/50 group-hover:border-primary group-hover:bg-primary/20 hover:bg-primary/25 transition-colors z-20 flex items-center justify-center select-none"
                        onMouseDown={(e) => { e.preventDefault(); if (e.button === 0) handleListResizeStart('project', e.clientX) }}
                        onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); handleListResizeReset('project') }}
                        title="Drag to resize; double-click to reset"
                      >
                        <span className="w-0.5 h-4 rounded-full bg-muted-foreground/30 group-hover:bg-primary/70 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" aria-hidden />
                      </div>
                    </TableHead>
                    <TableHead className="relative w-0 group overflow-visible">
                      {viewTab === 'assigned' ? (
                        <button type="button" onClick={() => handleSort('reporterDisplayName')} className="flex items-center font-medium hover:text-foreground transition-colors w-full text-left">
                          Reporter
                          {renderSortIcon('reporterDisplayName')}
                        </button>
                      ) : (
                        <button type="button" onClick={() => handleSort('assigneeDisplayName')} className="flex items-center font-medium hover:text-foreground transition-colors w-full text-left">
                          Assignee
                          {renderSortIcon('assigneeDisplayName')}
                        </button>
                      )}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-3 min-w-3 cursor-col-resize border-r border-border/50 group-hover:border-primary group-hover:bg-primary/20 hover:bg-primary/25 transition-colors z-20 flex items-center justify-center select-none"
                        onMouseDown={(e) => { e.preventDefault(); if (e.button === 0) handleListResizeStart(viewTab === 'assigned' ? 'reporter' : 'assignee', e.clientX) }}
                        onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); handleListResizeReset(viewTab === 'assigned' ? 'reporter' : 'assignee') }}
                        title="Drag to resize; double-click to reset"
                      >
                        <span className="w-0.5 h-4 rounded-full bg-muted-foreground/30 group-hover:bg-primary/70 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" aria-hidden />
                      </div>
                    </TableHead>
                    <TableHead className="relative w-0 group overflow-visible">
                      <button type="button" onClick={() => handleSort('taskType')} className="flex items-center font-medium hover:text-foreground transition-colors w-full text-left">
                        Task type
                        {renderSortIcon('taskType')}
                      </button>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-3 min-w-3 cursor-col-resize border-r border-border/50 group-hover:border-primary group-hover:bg-primary/20 hover:bg-primary/25 transition-colors z-20 flex items-center justify-center select-none"
                        onMouseDown={(e) => { e.preventDefault(); if (e.button === 0) handleListResizeStart('taskType', e.clientX) }}
                        onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); handleListResizeReset('taskType') }}
                        title="Drag to resize; double-click to reset"
                      >
                        <span className="w-0.5 h-4 rounded-full bg-muted-foreground/30 group-hover:bg-primary/70 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" aria-hidden />
                      </div>
                    </TableHead>
                    <TableHead className="relative w-0 group overflow-visible">
                      <button type="button" onClick={() => handleSort('requirementType')} className="flex items-center font-medium hover:text-foreground transition-colors w-full text-left">
                        Requirement type
                        {renderSortIcon('requirementType')}
                      </button>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-3 min-w-3 cursor-col-resize border-r border-border/50 group-hover:border-primary group-hover:bg-primary/20 hover:bg-primary/25 transition-colors z-20 flex items-center justify-center select-none"
                        onMouseDown={(e) => { e.preventDefault(); if (e.button === 0) handleListResizeStart('requirementType', e.clientX) }}
                        onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); handleListResizeReset('requirementType') }}
                        title="Drag to resize; double-click to reset"
                      >
                        <span className="w-0.5 h-4 rounded-full bg-muted-foreground/30 group-hover:bg-primary/70 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" aria-hidden />
                      </div>
                    </TableHead>
                    <TableHead className="relative w-0 group overflow-visible">
                      <button type="button" onClick={() => handleSort('workspaceName')} className="flex items-center font-medium hover:text-foreground transition-colors w-full text-left">
                        Workspace
                        {renderSortIcon('workspaceName')}
                      </button>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-3 min-w-3 cursor-col-resize border-r border-border/50 group-hover:border-primary group-hover:bg-primary/20 hover:bg-primary/25 transition-colors z-20 flex items-center justify-center select-none"
                        onMouseDown={(e) => { e.preventDefault(); if (e.button === 0) handleListResizeStart('workspace', e.clientX) }}
                        onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); handleListResizeReset('workspace') }}
                        title="Drag to resize; double-click to reset"
                      >
                        <span className="w-0.5 h-4 rounded-full bg-muted-foreground/30 group-hover:bg-primary/70 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" aria-hidden />
                      </div>
                    </TableHead>
                    <TableHead className="relative w-0 group overflow-visible">
                      <button type="button" onClick={() => handleSort('priority')} className="flex items-center font-medium hover:text-foreground transition-colors w-full text-left">
                        Priority
                        {renderSortIcon('priority')}
                      </button>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-3 min-w-3 cursor-col-resize border-r border-border/50 group-hover:border-primary group-hover:bg-primary/20 hover:bg-primary/25 transition-colors z-20 flex items-center justify-center select-none"
                        onMouseDown={(e) => { e.preventDefault(); if (e.button === 0) handleListResizeStart('priority', e.clientX) }}
                        onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); handleListResizeReset('priority') }}
                        title="Drag to resize; double-click to reset"
                      >
                        <span className="w-0.5 h-4 rounded-full bg-muted-foreground/30 group-hover:bg-primary/70 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" aria-hidden />
                      </div>
                    </TableHead>
                    <TableHead className="relative w-0 group overflow-visible">
                      <button type="button" onClick={() => handleSort('status')} className="flex items-center font-medium hover:text-foreground transition-colors w-full text-left">
                        Status
                        {renderSortIcon('status')}
                      </button>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-3 min-w-3 cursor-col-resize border-r border-border/50 group-hover:border-primary group-hover:bg-primary/20 hover:bg-primary/25 transition-colors z-20 flex items-center justify-center select-none"
                        onMouseDown={(e) => { e.preventDefault(); if (e.button === 0) handleListResizeStart('status', e.clientX) }}
                        onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); handleListResizeReset('status') }}
                        title="Drag to resize; double-click to reset"
                      >
                        <span className="w-0.5 h-4 rounded-full bg-muted-foreground/30 group-hover:bg-primary/70 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" aria-hidden />
                      </div>
                    </TableHead>
                    <TableHead className="relative w-0 group overflow-visible">
                      <button type="button" onClick={() => handleSort('dueDate')} className="flex items-center font-medium hover:text-foreground transition-colors w-full text-left">
                        Due Date
                        {renderSortIcon('dueDate')}
                      </button>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-3 min-w-3 cursor-col-resize border-r border-border/50 group-hover:border-primary group-hover:bg-primary/20 hover:bg-primary/25 transition-colors z-20 flex items-center justify-center select-none"
                        onMouseDown={(e) => { e.preventDefault(); if (e.button === 0) handleListResizeStart('dueDate', e.clientX) }}
                        onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); handleListResizeReset('dueDate') }}
                        title="Drag to resize; double-click to reset"
                      >
                        <span className="w-0.5 h-4 rounded-full bg-muted-foreground/30 group-hover:bg-primary/70 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" aria-hidden />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((task) => (
                    <TaskTableRow
                      key={task.id}
                      task={task}
                      viewTab={viewTab}
                      onClick={(task) => {
                        setSelectedTask(task)
                        setTaskFormMode('view')
                      }}
                      userNameById={userIdToName}
                      userAvatarById={userIdToAvatar}
                      taskTypes={taskTypes}
                      requirementTypes={requirementTypes}
                    />
                  ))}
                  {filteredTasks.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={viewTab === 'assigned_by_me' ? 10 : 9} className="text-center py-12">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <FileText className="w-12 h-12 mb-3 opacity-20" />
                          <p className="text-sm">No tasks found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {viewTab === 'boards' && (
            <div className="flex-1 min-h-0">
              <TaskKanbanView
                tasks={filteredTasks}
                statuses={statusMetadata}
                visibleStatusCodes={boardColumnCodes}
                onVisibleStatusCodesChange={handleBoardColumnCodesChange}
                onDragEnd={handleDragEnd}
                onDragStart={handleDragStart}
                onDragCancel={handleDragCancel}
                activeId={activeId}
                onTaskClick={(task) => {
                  setSelectedTask(task)
                  setTaskFormMode('view')
                }}
                users={users}
                currentUserId={currentUser?.id}
              />
            </div>
          )}

          {viewTab === 'approvals' && (
            <ApprovalsTab onCountChange={setApprovalCount} />
          )}

          {viewTab !== 'assigned' && viewTab !== 'assigned_by_me' && viewTab !== 'starred' && viewTab !== 'boards' && viewTab !== 'approvals' && (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">Coming soon</p>
            </div>
          )}
        </div>
      </div>

      {/* Task Form and Dialogs */}
      <TaskForm
        isOpen={taskFormMode === 'edit'}
        onClose={() => {
          setTaskFormMode(null)
          setSelectedTask(null)
        }}
        onSubmit={handleTaskFormSubmit}
        mode="edit"
        task={selectedTask}
        isUpdatingProgress={false}
        showWbsFields={activeTab === 'gantt'}
        progressUpdate={progressUpdate}
        onProgressUpdate={(progress, notes) => {
          setProgressUpdate(progress)
          setCompletionNotes(notes)
        }}
        completionNotes={completionNotes}
        onNotesChange={(notes) => setCompletionNotes(notes)}
        isLoading={isSavingTask}
      />

      {/* Modern Centered Task Detail Dialog */}
      <TaskDetailDialog
        task={selectedTask}
        groupId={groupId ?? undefined}
        open={taskFormMode === 'view'}
        onOpenChange={(open) => {
          if (!open) {
            setTaskFormMode(null)
            setSelectedTask(null)
          }
        }}
        onUpdate={async (updatedTask) => {
          setTasks(prev => {
            const updated = prev.map(t => t.id === updatedTask.id ? updatedTask : t)
            // Filter out completed and cancelled tasks
            return updated.filter(t => t.status !== 'completed' && t.status !== 'cancelled')
          })
        }}
      />

      <ConfirmationDialog
        open={deleteDialog.open}
        onOpenChange={(open) => {
          if (!open) setDeleteDialog({ open: false, task: null })
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Task"
        description={`Are you sure you want to delete "${deleteDialog.task?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div >
  )
}
