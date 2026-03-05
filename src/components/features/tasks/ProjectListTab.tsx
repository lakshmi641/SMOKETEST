'use client'

import { useState, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { ProjectTaskListView } from './ProjectTaskListView'
import { TaskMasterDataService } from '@/lib/services'
import { TaskTemplateService } from '@/lib/services/tasks/task-template-service'
import { useTaskTypesQuery } from '@/hooks/queries/useTaskTypesQuery'
import { formatTaskId as formatTaskIdUtil } from '@/lib/utils/task-display'
import { cn } from '@/lib/utils'
import { Layers, FileText, User, UserPlus, X, CheckCircle } from 'lucide-react'
import type { GeneratedTask } from '@/types/task-template-schema'
import type { EnhancedProject } from '@/types/project-schema'
import type { ProjectCustomFieldWithDefinition } from '@/types/custom-field'
import toast from 'react-hot-toast'

export interface ProjectListTabProps {
  tasks: GeneratedTask[]
  loading: boolean
  projectUsers: any[]
  statusMetadata: Array<{ code: string; name: string; color?: string }>
  loadingStatuses: boolean
  projectFields: ProjectCustomFieldWithDefinition[]
  companyId: string
  projectId: string
  workspaceId?: string
  workspace?: any
  project: EnhancedProject | null
  groupId?: string
  currentCompanyDomain?: string | null
  formatTaskId: (task: GeneratedTask) => string
  selectedTaskIds: Set<string>
  onSelectAll: (checked: boolean) => void
  onSelectTask: (taskId: string, checked: boolean) => void
  onBulkStatusChange: (status: GeneratedTask['status']) => Promise<void>
  onBulkAssigneeChange: (selection: any) => Promise<void>
  onBulkDelete: () => Promise<void>
  sortColumn: { field: string; direction: 'asc' | 'desc' } | null
  onSort: (field: string) => void
  allColumns: { id: string; label: string; type: 'standard' | 'custom'; order: number }[]
  visibleOrderedColumns: string[]
  columnChooserOpen: boolean
  onOpenColumnChooser: () => void
  onViewTask: (task: GeneratedTask) => void
  onUpdateTaskStatus: (taskId: string, status: GeneratedTask['status']) => Promise<void>
  onUpdateTaskAssignee?: (taskId: string, selection: any) => Promise<void>
  onUpdateTaskValue: (taskId: string, fieldId: string, value: any) => Promise<void>
  onUpdateTaskCustomField: (task: GeneratedTask, fieldId: string, value: any) => Promise<void>
  onCreateTask: () => void
  currentUserId?: string | null
  setTasks: React.Dispatch<React.SetStateAction<GeneratedTask[]>>
  isAdmin?: boolean
}

export function ProjectListTab(props: ProjectListTabProps) {
  const {
    tasks,
    companyId,
    groupId,
    project,
    currentCompanyDomain,
    setTasks,
    currentUserId,
    formatTaskId,
    ...listViewProps
  } = props

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [taskTypeFilter, setTaskTypeFilter] = useState<Set<string>>(new Set())
  const [requirementTypeFilter, setRequirementTypeFilter] = useState<Set<string>>(new Set())
  const [reporterFilter, setReporterFilter] = useState<Set<string>>(new Set())
  const [assigneeFilter, setAssigneeFilter] = useState<Set<string>>(new Set())

  const { taskTypeOptions } = useTaskTypesQuery(companyId ?? undefined, groupId ?? undefined)
  const taskTypes = useMemo(
    () => taskTypeOptions.map((o) => ({ id: o.value, name: o.label })),
    [taskTypeOptions]
  )

  // Only show project members (team + manager) in the assignee filter
  const projectMemberUsers = useMemo(() => {
    if (!project) return []
    const memberIds = new Set<string>()
    if (project.manager) memberIds.add(project.manager)
    if (Array.isArray(project.team)) project.team.forEach(id => memberIds.add(id))
    return props.projectUsers.filter((u: { id: string }) => memberIds.has(u.id))
  }, [project, props.projectUsers])

  // Reporters: unique users who have reported tasks (from tasks + project users for names)
  const reporterUsers = useMemo(() => {
    const reporterIds = new Set<string>()
    tasks.forEach(t => {
      const rid = (t as { reporter?: string }).reporter || (t as { assignedBy?: string }).assignedBy
      if (rid) reporterIds.add(rid)
    })
    const usersMap = new Map<string, { id: string; name: string }>()
    props.projectUsers.forEach((u: { id: string; name?: string; email?: string }) => {
      if (reporterIds.has(u.id)) usersMap.set(u.id, { id: u.id, name: u.name || u.email || u.id })
    })
    tasks.forEach(t => {
      const rid = (t as { reporter?: string }).reporter || (t as { assignedBy?: string }).assignedBy
      if (rid && !usersMap.has(rid)) {
        const name = (t as { reporterName?: string }).reporterName || rid
        usersMap.set(rid, { id: rid, name })
      }
    })
    return Array.from(usersMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [tasks, props.projectUsers])

  const [requirementTypesFromDb, setRequirementTypesFromDb] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    if (!companyId) return
    const load = async () => {
      try {
        const reqTypes = await TaskMasterDataService.getRequirementTypes(companyId, groupId ?? undefined)
        setRequirementTypesFromDb(reqTypes?.map((r: { id: string; name: string }) => ({ id: r.id, name: r.name || r.id })) ?? [])
      } catch (e) {
        console.error('Error loading requirement types:', e)
      }
    }
    load()
  }, [companyId, groupId])

  // Merge DB types with types found in tasks (in case tasks have values not in DB) + Unspecified for filtering unset
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

  const filteredTasks = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return tasks.filter(task => {
      if (term) {
        const title = (task.title || '').toLowerCase()
        const desc = (task.description || '').toLowerCase()
        const taskId = formatTaskIdUtil(task, project, companyId ?? undefined, currentCompanyDomain ?? undefined)?.toLowerCase() ?? ''
        if (!title.includes(term) && !desc.includes(term) && !taskId.includes(term)) return false
      }
      if (statusFilter.size > 0 && !statusFilter.has(task.status)) return false
      if (taskTypeFilter.size > 0) {
        const match = task.taskType && taskTypes.some((t) => (task.taskType === t.id || task.taskType === t.name) && taskTypeFilter.has(t.id))
        if (!match) return false
      }
      if (requirementTypeFilter.size > 0) {
        const hasReqType = task.requirementType?.trim()
        const matchUnspecified = requirementTypeFilter.has('__unspecified__') && !hasReqType
        const matchTyped = hasReqType && requirementTypes.some((r) => r.id !== '__unspecified__' && (task.requirementType === r.id || task.requirementType === r.name) && requirementTypeFilter.has(r.id))
        if (!matchUnspecified && !matchTyped) return false
      }
      if (reporterFilter.size > 0) {
        const rid = (task as { reporter?: string }).reporter || (task as { assignedBy?: string }).assignedBy
        if (!rid || !reporterFilter.has(rid)) return false
      }
      if (assigneeFilter.size > 0) {
        if (!task.assignedUserId || !assigneeFilter.has(task.assignedUserId)) return false
      }
      return true
    })
  }, [tasks, searchTerm, statusFilter, taskTypeFilter, requirementTypeFilter, reporterFilter, assigneeFilter, taskTypes, requirementTypes, project, companyId, currentCompanyDomain])

  const hasFiltersActive = statusFilter.size > 0 || taskTypeFilter.size > 0 || requirementTypeFilter.size > 0 || reporterFilter.size > 0 || assigneeFilter.size > 0
  const clearFilters = () => {
    setStatusFilter(new Set())
    setTaskTypeFilter(new Set())
    setRequirementTypeFilter(new Set())
    setReporterFilter(new Set())
    setAssigneeFilter(new Set())
  }

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

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
      <div className="flex items-center gap-3 flex-wrap shrink-0 mt-1 ml-1">
        <Input
          placeholder="Search tasks..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-xs h-9"
        />
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
              {props.statusMetadata.map(s => (
                <label key={s.code} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={statusFilter.has(s.code)}
                    onCheckedChange={(checked) => {
                      setStatusFilter(prev => {
                        const next = new Set(prev)
                        if (checked) next.add(s.code)
                        else next.delete(s.code)
                        return next
                      })
                    }}
                  />
                  <span className="text-sm">{s.name}</span>
                </label>
              ))}
              {props.statusMetadata.length === 0 && (
                <p className="text-sm text-muted-foreground">No statuses</p>
              )}
            </div>
          </PopoverContent>
        </Popover>
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
        <FilterPopover label="Assignee" icon={UserPlus} count={assigneeFilter.size}>
          <p className="text-sm font-medium mb-2">Assignee</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {projectMemberUsers.map((u: { id: string; name?: string; email?: string }) => (
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
                <span className="text-sm">{u.name || u.email || u.id}</span>
              </label>
            ))}
            {projectMemberUsers.length === 0 && (
              <p className="text-sm text-muted-foreground">No team members</p>
            )}
          </div>
        </FilterPopover>
        {hasFiltersActive && (
          <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground" onClick={clearFilters}>
            <X className="h-4 w-4" />
            Clear filters
          </Button>
        )}
      </div>
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <ProjectTaskListView
          {...listViewProps}
          tasks={filteredTasks}
          companyId={companyId}
          formatTaskId={formatTaskId}
          projectCustomFields={project?.customFields}
          taskTypes={taskTypes}
          requirementTypes={requirementTypes}
          onDueDateChange={companyId ? async (taskId, newDueDate) => {
            const t = tasks.find(x => x.id === taskId)
            if (!t) return
            try {
              await TaskTemplateService.updateTaskStatus(companyId, taskId, t.status, { dueDate: newDueDate }, currentUserId ?? undefined, undefined, groupId ?? undefined)
              setTasks(prev => prev.map(x => x.id === taskId ? { ...x, dueDate: newDueDate } : x))
              toast.success('Due date updated')
            } catch (err: unknown) {
              console.error('Failed to update due date:', err)
              toast.error((err as Error)?.message || 'Failed to update due date')
            }
          } : undefined}
        />
      </div>
    </div>
  )
}
