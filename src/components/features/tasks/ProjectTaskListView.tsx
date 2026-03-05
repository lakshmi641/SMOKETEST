'use client'

import { useMemo, useState, Fragment, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { FileText, ArrowUp, ArrowDown, Settings2, ChevronRight, ChevronDown, GitBranch, Ghost, AlertTriangle, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GeneratedTask } from '@/types/task-template-schema'
import { CustomFieldCell } from '@/components/features/custom-fields'
import type { ProjectCustomFieldWithDefinition } from '@/types/custom-field'
import { getStatusColors } from '@/lib/utils/task-status-colors'
import { formatDate, formatFriendlyDate, formatFriendlyDateOnly } from './utils'
import { toTitleCase } from '@/lib/utils/string-utils'
import { formatISODate } from '@/lib/utils/date-utils'
import { MemberSelect, MemberSelection } from '@/components/common/MemberSelect'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { usePermission } from '@/hooks/usePermission'
import { PERMISSIONS } from '@/lib/constants/permissions'

// Column resize handle component
function ResizeHandle({
  columnId,
  onResizeStart,
  onReset,
}: {
  columnId: string
  onResizeStart: (key: string, clientX: number) => void
  onReset?: (key: string) => void
}) {
  return (
    <div
      className="absolute right-0 top-0 bottom-0 w-3 min-w-3 cursor-col-resize border-r border-border/50 group-hover:border-primary group-hover:bg-primary/20 hover:bg-primary/25 transition-colors z-20 flex items-center justify-center select-none"
      onMouseDown={(e) => {
        e.preventDefault()
        if (e.button !== 0) return
        onResizeStart(columnId, e.clientX)
      }}
      onDoubleClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onReset?.(columnId)
      }}
      title="Drag to resize; double-click to reset"
    >
      <span className="w-0.5 h-4 rounded-full bg-muted-foreground/30 group-hover:bg-primary/70 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" aria-hidden />
    </div>
  )
}

// Column width constants
const PROJECT_LIST_STORAGE_KEY = 'project-list-column-widths'
const PROJECT_LIST_DEFAULT_WIDTHS: Record<string, number> = {
  ghost: 40,
  checkbox: 40,
  work: 320,
  assignee: 180,
  reporter: 160,
  taskType: 120,
  requirementType: 140,
  priority: 100,
  status: 140,
  resolution: 100,
  created: 120,
  updated: 120,
  dueDate: 150,
  startDate: 120,
  settings: 50,
}
const DEFAULT_COLUMN_WIDTH = 120
const MIN_COLUMN_WIDTH = 50

function DueDateCell({ task, onDueDateChange }: { task: GeneratedTask; onDueDateChange: (taskId: string, newDueDate: string) => Promise<void> }) {
  const [localDate, setLocalDate] = useState(formatISODate(task.dueDate) || '')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLocalDate(formatISODate(task.dueDate) || '')
  }, [task.dueDate])

  const handleChange = async (e: any) => {
    const value = e.target.value
    setLocalDate(value)
    if (!task.id || !value) return
    setSaving(true)
    try {
      // For date-only, we usually set to 12:00 PM to avoid timezone issues
      const iso = new Date(value + 'T12:00:00.000Z').toISOString()
      await onDueDateChange(task.id, iso)
    } finally {
      setSaving(false)
    }
  }

  const handleContainerClick = () => {
    const el = inputRef.current as any
    if (el) {
      try {
        if ('showPicker' in el) {
          el.showPicker();
        } else {
          el.focus();
          el.click();
        }
      } catch (e) {
        el.focus();
        el.click();
      }
    }
  }

  return (
    <div
      className="relative group cursor-pointer"
      onClick={handleContainerClick}
    >
      <input
        ref={inputRef}
        type="date"
        value={localDate}
        onChange={handleChange}
        disabled={saving}
        className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
      />
      <div className={cn(
        'flex h-7 w-full min-w-[150px] items-center gap-2 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors group-hover:bg-accent/50',
        saving && 'opacity-60'
      )}>
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="truncate">
          {task.dueDate ? formatFriendlyDateOnly(task.dueDate) : 'No due date'}
        </span>
      </div>
    </div>
  )
}

interface Column {
  id: string
  label: string
  type: 'standard' | 'custom'
  order: number
}

interface ProjectTaskListViewProps {
  tasks: GeneratedTask[]
  loading: boolean
  projectUsers: any[]
  statusMetadata: Array<{ code: string; name: string; color?: string }>
  loadingStatuses: boolean
  projectFields: ProjectCustomFieldWithDefinition[]
  projectCustomFields?: Record<string, any> // Project-level default values for custom fields
  companyId: string
  projectId: string
  workspaceId?: string
  formatTaskId: (task: GeneratedTask) => string // Updated to accept full task for sequential ID support
  // Bulk selection
  selectedTaskIds: Set<string>
  onSelectAll: (checked: boolean) => void
  onSelectTask: (taskId: string, checked: boolean) => void
  onBulkStatusChange: (status: GeneratedTask['status']) => Promise<void>
  onBulkAssigneeChange: (selection: MemberSelection) => Promise<void>
  onBulkDelete: () => Promise<void>
  // Sorting
  sortColumn: { field: string; direction: 'asc' | 'desc' } | null
  onSort: (field: string) => void
  // Columns
  allColumns: Column[]
  visibleOrderedColumns: string[]
  columnChooserOpen: boolean
  onOpenColumnChooser: () => void
  // Task actions
  onViewTask: (task: GeneratedTask) => void
  onUpdateTaskStatus: (taskId: string, status: GeneratedTask['status']) => Promise<void>
  onUpdateTaskAssignee?: (taskId: string, selection: MemberSelection | null) => Promise<void>
  onUpdateTaskValue: (taskId: string, fieldId: string, value: any) => Promise<void>
  onUpdateTaskCustomField: (task: GeneratedTask, fieldId: string, value: any) => Promise<void>
  onCreateTask: () => void
  currentUserId?: string
  taskTypes?: Array<{ id: string; name: string }>
  requirementTypes?: Array<{ id: string; name: string }>
  onDueDateChange?: (taskId: string, newDueDate: string) => Promise<void>
}

export function ProjectTaskListView({
  tasks,
  loading,
  projectUsers,
  statusMetadata,
  loadingStatuses,
  projectFields,
  projectCustomFields = {},
  companyId,
  projectId,
  workspaceId,
  formatTaskId,
  selectedTaskIds,
  onSelectAll,
  onSelectTask,
  onBulkStatusChange,
  onBulkAssigneeChange,
  onBulkDelete,
  sortColumn,
  onSort,
  allColumns,
  visibleOrderedColumns,
  onOpenColumnChooser,
  onViewTask,
  onUpdateTaskStatus,
  onUpdateTaskAssignee,
  onUpdateTaskValue,
  onUpdateTaskCustomField,
  onCreateTask,
  currentUserId,
  taskTypes = [],
  requirementTypes = [],
  onDueDateChange,
}: ProjectTaskListViewProps) {
  // Column resize state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(PROJECT_LIST_STORAGE_KEY)
        if (stored) return JSON.parse(stored)
      } catch { }
    }
    return {}
  })
  const resizeRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null)

  const getColumnWidth = (key: string) =>
    columnWidths[key] ?? PROJECT_LIST_DEFAULT_WIDTHS[key] ?? DEFAULT_COLUMN_WIDTH

  const handleResizeStart = useCallback((key: string, clientX: number) => {
    resizeRef.current = { key, startX: clientX, startWidth: getColumnWidth(key) }

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return
      const delta = e.clientX - resizeRef.current.startX
      const newWidth = Math.max(MIN_COLUMN_WIDTH, resizeRef.current.startWidth + delta)
      setColumnWidths((prev) => {
        const updated = { ...prev, [resizeRef.current!.key]: newWidth }
        try {
          localStorage.setItem(PROJECT_LIST_STORAGE_KEY, JSON.stringify(updated))
        } catch { }
        return updated
      })
    }

    const handleMouseUp = () => {
      resizeRef.current = null
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [])

  const handleResizeReset = useCallback((key: string) => {
    setColumnWidths((prev) => {
      const updated = { ...prev }
      delete updated[key]
      try {
        localStorage.setItem(PROJECT_LIST_STORAGE_KEY, JSON.stringify(updated))
      } catch { }
      return updated
    })
  }, [])

  const isAllSelected = tasks.length > 0 && selectedTaskIds.size === tasks.length
  const isIndeterminate = selectedTaskIds.size > 0 && selectedTaskIds.size < tasks.length

  // Apply column sorting
  const columnSortedTasks = useMemo(() => {
    if (!sortColumn) return tasks

    const sorted = [...tasks]
    sorted.sort((a, b) => {
      let aValue: any
      let bValue: any

      const parseDateForSort = (dateValue: any) => {
        if (!dateValue) return 0
        if (typeof dateValue.toDate === 'function') return dateValue.toDate().getTime()
        const date = new Date(dateValue)
        return isNaN(date.getTime()) ? 0 : date.getTime()
      }

      switch (sortColumn.field) {
        case 'title':
          aValue = a.title?.toLowerCase() || ''
          bValue = b.title?.toLowerCase() || ''
          break
        case 'assignee':
          aValue = projectUsers.find(u => u.id === a.assignedUserId)?.name || ''
          bValue = projectUsers.find(u => u.id === b.assignedUserId)?.name || ''
          break
        case 'reporter':
          aValue = projectUsers.find(u => u.id === (a.reporter || a.assignedBy || a.assignedUserId))?.name || a.reporterName || ''
          bValue = projectUsers.find(u => u.id === (b.reporter || b.assignedBy || b.assignedUserId))?.name || b.reporterName || ''
          break
        case 'priority':
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 }
          aValue = priorityOrder[a.priority] || 0
          bValue = priorityOrder[b.priority] || 0
          break
        case 'status':
          aValue = a.status
          bValue = b.status
          break
        case 'created':
          aValue = parseDateForSort(a.createdAt)
          bValue = parseDateForSort(b.createdAt)
          break
        case 'updated':
          aValue = parseDateForSort(a.updatedAt)
          bValue = parseDateForSort(b.updatedAt)
          break
        case 'dueDate':
          aValue = parseDateForSort(a.dueDate)
          bValue = parseDateForSort(b.dueDate)
          break
        case 'taskType':
          aValue = a.taskType || ''
          bValue = b.taskType || ''
          break
        case 'requirementType':
          aValue = a.requirementType || ''
          bValue = b.requirementType || ''
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortColumn.direction === 'asc' ? -1 : 1
      if (aValue > bValue) return sortColumn.direction === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }, [tasks, sortColumn, projectUsers])

  // Hierarchical view state
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())

  const toggleExpand = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev)
      if (newSet.has(taskId)) newSet.delete(taskId)
      else newSet.add(taskId)
      return newSet
    })
  }

  // Group tasks for hierarchy
  const { parents, childrenMap } = useMemo(() => {
    const p: GeneratedTask[] = []
    const c = new Map<string, GeneratedTask[]>()
    // Create a set of all task IDs for efficient lookup of orphans
    const taskIds = new Set(columnSortedTasks.map(t => t.id))

    columnSortedTasks.forEach(task => {
      if (task.parentTaskId && taskIds.has(task.parentTaskId)) {
        if (!c.has(task.parentTaskId)) c.set(task.parentTaskId, [])
        c.get(task.parentTaskId)!.push(task)
      } else {
        p.push(task)
      }
    })
    return { parents: p, childrenMap: c }
  }, [columnSortedTasks])

  const canEditGlobal = usePermission(PERMISSIONS.TASK_EDIT)

  const renderCell = (task: GeneratedTask, columnId: string, isSubtaskRow = false) => {
    const isCreator = task.reporter === currentUserId
    const canEditTask = canEditGlobal || isCreator
    const statusMeta = statusMetadata.find(s => s.code === task.status)
    const assignee = projectUsers.find(u => u.id === task.assignedUserId)
    // Use reporter → creator (assignedBy) → assignee so we always show a name when possible
    const effectiveReporterId = task.reporter || task.assignedBy || task.assignedUserId
    const reporter = projectUsers.find(u => u.id === effectiveReporterId)

    switch (columnId) {
      case 'work':
        const hasSubtasks = childrenMap.has(task.id) && childrenMap.get(task.id)!.length > 0
        const isExpanded = expandedTasks.has(task.id)

        return (
          <TableCell
            key={columnId}
            className="font-medium cursor-pointer text-left"
            onClick={() => onViewTask(task)}
          >
            {/* Add left padding for subtasks to create clear indentation */}
            <div className={`flex items-center gap-1.5 ${isSubtaskRow ? 'pl-8' : ''}`}>
              {!isSubtaskRow ? (
                // Parent Task Control - Professional expand/collapse button
                <div className="w-4 flex-shrink-0 flex items-center justify-center">
                  {hasSubtasks ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 p-0 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded transition-colors"
                      onClick={(e) => { e.stopPropagation(); toggleExpand(task.id) }}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      )}
                    </Button>
                  ) : null}
                </div>
              ) : (
                // Subtask Indent - Beautiful tree-like connector (Jira style)
                <div className="w-4 flex-shrink-0 flex items-center justify-start relative ml-1">
                  {/* Vertical line connecting to parent */}
                  <div className="absolute left-0 -top-3 h-[calc(50%+12px)] w-[1.5px] bg-gradient-to-b from-blue-200 to-blue-300 dark:from-blue-800 dark:to-blue-700" />
                  {/* Horizontal line to task */}
                  <div className="absolute left-0 top-1/2 w-3 h-[1.5px] bg-gradient-to-r from-blue-300 to-blue-200 dark:from-blue-700 dark:to-blue-800" />
                  {/* Corner dot for visual appeal */}
                  <div className="absolute left-[-1px] top-1/2 w-1 h-1 rounded-full bg-blue-400 dark:bg-blue-600 transform -translate-y-1/2" />
                </div>
              )}

              <div className="flex flex-col min-w-0 max-w-[300px] md:max-w-[400px]">
                {/* Task Title - Professional typography */}
                <span
                  className={`
                    truncate block
                    ${isSubtaskRow
                      ? 'text-sm text-gray-700 dark:text-gray-300 font-normal'
                      : 'text-sm font-semibold text-gray-900 dark:text-gray-100'
                    }
                  `}
                  title={task.title}
                >
                  {task.metadata?.isRecurring && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] h-4 px-1.5 uppercase font-bold shrink-0 inline-flex align-middle mr-1.5 mb-0.5">
                      Rec
                    </Badge>
                  )}
                  {task.title}
                  {task.dueDate && (
                    <span className="text-muted-foreground font-normal ml-2">
                      | {(() => {
                        const date = (task.dueDate as any)?.toDate ? (task.dueDate as any).toDate() : task.dueDate;
                        const isWeekly =
                          task.taskType?.toLowerCase() === 'weekly' ||
                          (typeof task.taskType === 'string' && task.taskType.toLowerCase().includes('week'));
                        if (isWeekly) {
                          const d = new Date(date);
                          const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                          return weekdays[d.getDay()];
                        }
                        return formatDate(date).split('/').slice(0, 2).join('/');
                      })()}
                    </span>
                  )}
                  {task.taskType && (
                    <span className="text-muted-foreground font-normal ml-2">
                      {task.taskType}
                    </span>
                  )}
                </span>
                {/* Task ID below title */}
                {formatTaskId(task) ? (
                  <span
                    className={`
                      text-xs font-mono tracking-tight mt-0.5
                      ${isSubtaskRow
                        ? 'text-blue-600 dark:text-blue-400 opacity-90'
                        : 'text-muted-foreground text-blue-600 dark:text-blue-400'
                      }
                    `}
                  >
                    {formatTaskId(task)}
                  </span>
                ) : null}

              </div>

              {/* Subtask indicator icon */}
              {isSubtaskRow && (
                <GitBranch className="h-3 w-3 text-blue-500 dark:text-blue-400 opacity-60 ml-1 flex-shrink-0" />
              )}
            </div>
          </TableCell>
        )
      case 'assignee':
        const parseAssigneeData = (name: string | undefined | null) => {
          if (!name) return { name: undefined, position: undefined };
          if (name.includes(' | ')) {
            const parts = name.split(' | ');
            return { name: parts.pop(), position: parts.join(' | ') };
          }
          if (name.includes(' - ')) {
            const parts = name.split(' - ');
            return { name: parts.pop(), position: parts.join(' - ') };
          }

          // Check if multiple names are present (comma-separated)
          if (name.includes(',')) {
            const users = name.split(',').map(u => u.trim());
            return { name: users[0], count: users.length, position: undefined };
          }

          return { name, position: undefined };
        };

        const { name: parsedName, position: parsedPosition, count: parsedCount } = parseAssigneeData(task.assignedToName);
        const displayAssigneeName = parsedName || assignee?.name || (assignee ? (assignee.email || assignee.id) : 'Unassigned');
        const displayPositionTitle = parsedPosition || (assignee?.position && assignee.position !== 'Unknown Position' ? assignee.position : undefined) || (task.assignedPositionId ? 'Position' : undefined);
        const isPosBased = !!task.assignedPositionId
        const canEditAssignee = canEditGlobal && onUpdateTaskAssignee
        const assigneeSelectValue: MemberSelection | undefined =
          task.assignedPositionId
            ? {
              type: 'position',
              id: task.assignedPositionId,
              label: displayAssigneeName !== 'Unassigned' ? displayAssigneeName : (task.assignedToName ?? undefined),
              userId: task.assignedUserId || undefined,
              userName: assignee?.name,
            }
            : task.assignedUserId
              ? {
                type: 'user',
                id: task.assignedUserId,
                label: task.assignedToName || assignee?.name || assignee?.email,
              }
              : undefined

        return (
          <TableCell key={columnId} onClick={(e) => e.stopPropagation()}>
            {canEditAssignee ? (
              <MemberSelect
                value={assigneeSelectValue}
                onValueChange={(selected) => {
                  onUpdateTaskAssignee(task.id, selected ?? null)
                }}
                placeholder="Assign..."
                className="w-[180px] min-w-0 [&_button]:h-7 [&_button]:text-xs"
                allowedUserIds={projectUsers.map((u: { id: string }) => u.id)}
                includeUsers={true}
                initialUsers={projectUsers}
              />
            ) : (
              <div className="flex items-center gap-2">
                {displayAssigneeName !== 'Unassigned' ? (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Avatar className="h-6 w-6 shrink-0 ring-2 ring-background">
                      <AvatarImage src={assignee?.avatar ?? undefined} alt="" />
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold uppercase">
                        {assignee?.name ? (assignee.name.split(/\s+/).length >= 2 ? (assignee.name.split(/\s+/)[0]!.charAt(0) + assignee.name.split(/\s+/)[1]!.charAt(0)) : assignee.name.charAt(0)) : displayAssigneeName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-medium truncate max-w-[150px] flex items-center gap-1">
                        {toTitleCase(displayAssigneeName || '')}
                        {parsedCount && parsedCount > 1 && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1 rounded-full font-bold">
                            +{parsedCount - 1}
                          </span>
                        )}
                      </span>
                      {displayPositionTitle && (
                        <span className="text-[10px] text-muted-foreground truncate block italic">
                          {toTitleCase(displayPositionTitle)} {assignee?.positionCode && `| ${assignee.positionCode}`}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-xs italic">Unassigned</span>
                )}
              </div>
            )}
          </TableCell>
        )
      case 'reporter':
        const parseReporterData = (name: string | undefined | null) => {
          if (!name) return { name: undefined, position: undefined };
          if (name.includes(' | ')) {
            const parts = name.split(' | ');
            return { name: parts.pop(), position: parts.join(' | ') };
          }
          if (name.includes(' - ')) {
            const parts = name.split(' - ');
            return { name: parts.pop(), position: parts.join(' - ') };
          }
          return { name, position: undefined };
        };

        const { name: parsedRepName, position: parsedRepPosition } = parseReporterData(task.reporterName);

        // Resolved name; default to "—" when unknown (image2-style placeholder)
        const rawReporterName = reporter ? (reporter.name || reporter.email) : (parsedRepName || '');
        const displayReporterName = rawReporterName || '—';
        const reporterInitials = displayReporterName !== '—'
          ? (displayReporterName.split(/\s+/).length >= 2
            ? (displayReporterName.split(/\s+/)[0]!.charAt(0) + displayReporterName.split(/\s+/)[1]!.charAt(0)).toUpperCase()
            : displayReporterName.charAt(0).toUpperCase())
          : '—';
        const isReporterPosBased = !!task.reporterPositionId

        // Use parsedRepPosition as priority subtitle, fallback to reporter object metadata
        const reporterSubtitle = parsedRepPosition || (reporter
          ? [reporter.position, reporter.role].filter(Boolean).filter((v: string) => v !== 'Unknown Position' && v !== 'employee').slice(0, 2).join(' · ')
          : '')
        return (
          <TableCell key={columnId}>
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6 shrink-0 ring-2 ring-background">
                <AvatarImage src={reporter?.avatar ?? undefined} alt="" />
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold uppercase">
                  {reporterInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0 max-w-[120px]">
                <span className="text-xs font-medium truncate block">
                  {toTitleCase(displayReporterName)}
                </span>
                {reporterSubtitle ? (
                  <span className="text-[10px] text-muted-foreground truncate block italic">
                    {toTitleCase(reporterSubtitle)} {reporter?.positionCode && `| ${reporter.positionCode}`}
                  </span>
                ) : null}
              </div>
            </div>
          </TableCell>
        )
      case 'taskType':
        const taskTypeName = task.taskType
          ? (taskTypes.find(t => t.id === task.taskType)?.name ?? task.taskType)
          : null
        return (
          <TableCell key={columnId}>
            <span className="text-sm text-muted-foreground">
              {taskTypeName ?? '—'}
            </span>
          </TableCell>
        )
      case 'requirementType':
        const requirementTypeName = task.requirementType
          ? (requirementTypes.find(r => r.id === task.requirementType)?.name ?? task.requirementType)
          : null
        return (
          <TableCell key={columnId}>
            <span className="text-sm text-muted-foreground">
              {requirementTypeName ?? '—'}
            </span>
          </TableCell>
        )
      case 'priority':
        return (
          <TableCell key={columnId}>
            <Badge variant="outline" className="capitalize text-xs">
              {task.priority}
            </Badge>
          </TableCell>
        )
      case 'status':
        return (
          <TableCell key={columnId} onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col gap-1.5">
              <Select
                value={task.status}
                onValueChange={(value) => {
                  if (task.id) {
                    onUpdateTaskStatus(task.id, value as GeneratedTask['status'])
                  }
                }}
                disabled={loadingStatuses}
              >
                <SelectTrigger className="w-[120px] h-7">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusMetadata.map(option => (
                    <SelectItem key={option.code} value={option.code}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {task.approvalStatus && (
                <Badge
                  variant="outline"
                  className={`
                    text-[9px] h-4 py-0 uppercase border-none px-1.5 font-bold tracking-tight rounded-sm
                    ${task.approvalStatus === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30' :
                      task.approvalStatus === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30' :
                        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 animate-pulse'}
                  `}
                >
                  {task.approvalStatus === 'pending' ? 'Approval Pending' : toTitleCase(task.approvalStatus)}
                </Badge>
              )}
            </div>
          </TableCell>
        )
      case 'resolution':
        return (
          <TableCell key={columnId}>
            <span className="text-sm text-muted-foreground">
              {task.status === 'completed' ? 'Done' : 'Unresolved'}
            </span>
          </TableCell>
        )
      case 'created':
        return (
          <TableCell key={columnId}>
            <span className="text-sm">
              {formatFriendlyDate(task.createdAt)}
            </span>
          </TableCell>
        )
      case 'updated':
        return (
          <TableCell key={columnId}>
            <span className="text-sm">
              {formatFriendlyDate(task.updatedAt)}
            </span>
          </TableCell>
        )
      case 'dueDate':
        return (
          <TableCell key={columnId} onClick={(e) => e.stopPropagation()}>
            {onDueDateChange && canEditGlobal ? (
              <DueDateCell
                task={task}
                onDueDateChange={onDueDateChange}
              />
            ) : task.dueDate ? (
              <span className="text-sm">
                {formatFriendlyDateOnly(task.dueDate)}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">None</span>
            )}
          </TableCell>
        )
      default:
        // Custom field
        const field = projectFields.find(f => f.id === columnId)
        if (!field) return null
        // Fallback chain: task value → project custom field → field definition default
        const taskValue = task.customFields?.[field.id]
        const projectValue = projectCustomFields?.[field.id]
        const definitionValue = field.definition.value
        const effectiveValue =
          (taskValue !== undefined && taskValue !== null && taskValue !== '') ? taskValue :
            (projectValue !== undefined && projectValue !== null && projectValue !== '') ? projectValue :
              definitionValue
        return (
          <TableCell key={columnId} onClick={(e) => e.stopPropagation()}>
            <CustomFieldCell
              taskId={task.id}
              field={field.definition}
              value={effectiveValue}
              companyId={companyId}
              projectId={projectId}
              task={task}
              allFields={projectFields}
              onValueChange={async (value) => {
                await onUpdateTaskCustomField(task, field.id, value)
              }}
              disabled={!canEditTask}
            />
          </TableCell>
        )
    }
  }

  return (
    <Card className="h-full flex flex-col min-h-0">
      <CardContent className="flex-1 flex flex-col min-h-0 p-0">
        {/* Bulk Actions Toolbar */}
        {selectedTaskIds.size > 0 && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                {selectedTaskIds.size} task{selectedTaskIds.size > 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center gap-2">
                <Select onValueChange={(value) => onBulkStatusChange(value as GeneratedTask['status'])}>
                  <SelectTrigger className="w-[150px] h-8">
                    <SelectValue placeholder="Change status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusMetadata.map(status => (
                      <SelectItem key={status.code} value={status.code}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="w-[200px]">
                  <MemberSelect
                    workspaceId={workspaceId}
                    placeholder="Assign to..."
                    onValueChange={(val) => {
                      if (val) onBulkAssigneeChange(val)
                    }}
                    className="h-8 text-xs"
                    includePositions={true}
                  />
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onBulkDelete}
                  className="h-8"
                >
                  Delete
                </Button>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSelectAll(false)}
              className="h-8"
            >
              Clear selection
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : tasks.length > 0 ? (
          <TooltipProvider>
            <div className="flex-1 overflow-auto min-h-0">
              <Table style={{ tableLayout: 'fixed', width: '100%' }}>
                {/* Column widths via colgroup */}
                <colgroup>
                  <col style={{ width: getColumnWidth('ghost') }} />
                  <col style={{ width: getColumnWidth('checkbox') }} />
                  {visibleOrderedColumns.map((columnId) => (
                    <col key={columnId} style={{ width: getColumnWidth(columnId) }} />
                  ))}
                  <col style={{ width: getColumnWidth('settings') }} />
                </colgroup>
                <TableHeader>
                  <TableRow>
                    {/* Ghost/Workflow Status Column */}
                    <TableHead className="relative w-0 group overflow-visible">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Ghost className="h-4 w-4 text-muted-foreground/50" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Workflow Status</p>
                        </TooltipContent>
                      </Tooltip>
                      <ResizeHandle columnId="ghost" onResizeStart={handleResizeStart} onReset={handleResizeReset} />
                    </TableHead>
                    {/* Checkbox Column - Always visible */}
                    <TableHead className="relative w-0 group overflow-visible">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={(e) => onSelectAll(e.target.checked)}
                        ref={(el) => {
                          if (el) {
                            el.indeterminate = isIndeterminate
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                      />
                      <ResizeHandle columnId="checkbox" onResizeStart={handleResizeStart} onReset={handleResizeReset} />
                    </TableHead>
                    {/* Dynamic Columns based on visibility and order */}
                    {visibleOrderedColumns.map((columnId) => {
                      const column = allColumns.find(c => c.id === columnId)
                      if (!column) return null

                      if (column.type === 'standard') {
                        switch (columnId) {
                          case 'work':
                            return (
                              <TableHead key={columnId} className="relative w-0 group overflow-visible text-left">
                                <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => onSort('title')}>
                                  {/* Spacer to align with row expander button (w-4) */}
                                  <div className="w-4" />
                                  Task
                                  {sortColumn?.field === 'title' && (
                                    sortColumn.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                  )}
                                </div>
                                <ResizeHandle columnId={columnId} onResizeStart={handleResizeStart} onReset={handleResizeReset} />
                              </TableHead>
                            )
                          case 'assignee':
                            return (
                              <TableHead key={columnId} className="relative w-0 group overflow-visible text-left">
                                <div className="flex items-center gap-2 cursor-pointer" onClick={() => onSort('assignee')}>
                                  Assignee
                                  {sortColumn?.field === 'assignee' && (
                                    sortColumn.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                  )}
                                </div>
                                <ResizeHandle columnId={columnId} onResizeStart={handleResizeStart} onReset={handleResizeReset} />
                              </TableHead>
                            )
                          case 'reporter':
                            return (
                              <TableHead key={columnId} className="relative w-0 group overflow-visible text-left">
                                <div className="flex items-center gap-2 cursor-pointer" onClick={() => onSort('reporter')}>
                                  Reporter
                                  {sortColumn?.field === 'reporter' && (
                                    sortColumn.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                  )}
                                </div>
                                <ResizeHandle columnId={columnId} onResizeStart={handleResizeStart} onReset={handleResizeReset} />
                              </TableHead>
                            )
                          case 'taskType':
                            return (
                              <TableHead key={columnId} className="relative w-0 group overflow-visible text-left">
                                <div className="flex items-center gap-2 cursor-pointer" onClick={() => onSort('taskType')}>
                                  Task type
                                  {sortColumn?.field === 'taskType' && (
                                    sortColumn.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                  )}
                                </div>
                                <ResizeHandle columnId={columnId} onResizeStart={handleResizeStart} onReset={handleResizeReset} />
                              </TableHead>
                            )
                          case 'requirementType':
                            return (
                              <TableHead key={columnId} className="relative w-0 group overflow-visible text-left">
                                <div className="flex items-center gap-2 cursor-pointer" onClick={() => onSort('requirementType')}>
                                  Requirement type
                                  {sortColumn?.field === 'requirementType' && (
                                    sortColumn.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                  )}
                                </div>
                                <ResizeHandle columnId={columnId} onResizeStart={handleResizeStart} onReset={handleResizeReset} />
                              </TableHead>
                            )
                          case 'priority':
                            return (
                              <TableHead key={columnId} className="relative w-0 group overflow-visible text-left">
                                <div className="flex items-center gap-2 cursor-pointer" onClick={() => onSort('priority')}>
                                  Priority
                                  {sortColumn?.field === 'priority' && (
                                    sortColumn.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                  )}
                                </div>
                                <ResizeHandle columnId={columnId} onResizeStart={handleResizeStart} onReset={handleResizeReset} />
                              </TableHead>
                            )
                          case 'status':
                            return (
                              <TableHead key={columnId} className="relative w-0 group overflow-visible text-left">
                                <div className="flex items-center gap-2 cursor-pointer" onClick={() => onSort('status')}>
                                  Status
                                  {sortColumn?.field === 'status' && (
                                    sortColumn.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                  )}
                                </div>
                                <ResizeHandle columnId={columnId} onResizeStart={handleResizeStart} onReset={handleResizeReset} />
                              </TableHead>
                            )
                          case 'resolution':
                            return (
                              <TableHead key={columnId} className="relative w-0 group overflow-visible text-left">
                                Resolution
                                <ResizeHandle columnId={columnId} onResizeStart={handleResizeStart} onReset={handleResizeReset} />
                              </TableHead>
                            )
                          case 'created':
                            return (
                              <TableHead key={columnId} className="relative w-0 group overflow-visible text-left">
                                <div className="flex items-center gap-2 cursor-pointer" onClick={() => onSort('created')}>
                                  Created
                                  {sortColumn?.field === 'created' && (
                                    sortColumn.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                  )}
                                </div>
                                <ResizeHandle columnId={columnId} onResizeStart={handleResizeStart} onReset={handleResizeReset} />
                              </TableHead>
                            )
                          case 'updated':
                            return (
                              <TableHead key={columnId} className="relative w-0 group overflow-visible text-left">
                                <div className="flex items-center gap-2 cursor-pointer" onClick={() => onSort('updated')}>
                                  Updated
                                  {sortColumn?.field === 'updated' && (
                                    sortColumn.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                  )}
                                </div>
                                <ResizeHandle columnId={columnId} onResizeStart={handleResizeStart} onReset={handleResizeReset} />
                              </TableHead>
                            )
                          case 'dueDate':
                            return (
                              <TableHead key={columnId} className="relative w-0 group overflow-visible text-left">
                                <div className="flex items-center gap-2 cursor-pointer" onClick={() => onSort('dueDate')}>
                                  Due date
                                  {sortColumn?.field === 'dueDate' && (
                                    sortColumn.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                  )}
                                </div>
                                <ResizeHandle columnId={columnId} onResizeStart={handleResizeStart} onReset={handleResizeReset} />
                              </TableHead>
                            )
                          case 'startDate':
                            return (
                              <TableHead key={columnId} className="relative w-0 group overflow-visible text-left">
                                <div className="flex items-center gap-2 cursor-pointer" onClick={() => onSort('startDate')}>
                                  Start date
                                  {sortColumn?.field === 'startDate' && (
                                    sortColumn.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                  )}
                                </div>
                                <ResizeHandle columnId={columnId} onResizeStart={handleResizeStart} onReset={handleResizeReset} />
                              </TableHead>
                            )
                          default:
                            return null
                        }
                      } else {
                        // Custom field column
                        const field = projectFields.find(f => f.id === columnId)
                        if (!field) return null
                        return (
                          <TableHead key={columnId} className="relative w-0 group overflow-visible">
                            <div className="flex items-center gap-2">
                              <span className="truncate">{field.definition.name}</span>
                            </div>
                            <ResizeHandle columnId={columnId} onResizeStart={handleResizeStart} onReset={handleResizeReset} />
                          </TableHead>
                        )
                      }
                    })}
                    {/* Column Chooser Icon */}
                    <TableHead className="w-10">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={onOpenColumnChooser}
                        className="h-6 w-6 opacity-60 hover:opacity-100"
                        title="Configure columns"
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parents.map((task) => {
                    const isSelected = selectedTaskIds.has(task.id)
                    const subtasks = childrenMap.get(task.id) || []
                    const isExpanded = expandedTasks.has(task.id)
                    const hasGhostIssue = task.hasGhostIssue || task.ghostInfo?.hasGhostApproval || task.ghostInfo?.hasGhostEscalation

                    const statusColors = getStatusColors(task.status)

                    return (
                      <Fragment key={task.id}>
                        {/* Parent Row */}
                        <TableRow
                          className={cn(
                            // Base status colors (only apply if not selected and no ghost issue)
                            !isSelected && !hasGhostIssue && statusColors.bg,
                            !isSelected && !hasGhostIssue && statusColors.bgDark,

                            !isSelected && !hasGhostIssue && statusColors.border,
                            !isSelected && !hasGhostIssue && statusColors.hover,
                            !isSelected && !hasGhostIssue && statusColors.hoverDark,
                            // Selected state takes priority
                            isSelected && 'bg-blue-50 dark:bg-blue-950/20',
                            // Ghost issue takes highest priority
                            hasGhostIssue && 'bg-red-50/50 dark:bg-red-950/20 border-l-4 border-l-red-500',
                            // Default hover for selected/ghost states
                            (isSelected || hasGhostIssue) && 'hover:bg-muted/50'
                          )}
                        >
                          {/* Ghost Indicator */}
                          <TableCell className="w-8 px-2">
                            {hasGhostIssue ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="cursor-pointer">
                                    <Ghost className="h-4 w-4 text-red-500 animate-pulse" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <div className="space-y-1">
                                    <p className="font-medium text-red-600">Workflow Issue</p>
                                    <p className="text-sm">
                                      {task.ghostInfo?.approvalGhostReason === 'position_vacant'
                                        ? 'Approval line has vacant position(s)'
                                        : task.ghostInfo?.approvalGhostReason === 'position_missing'
                                          ? 'Approval line position no longer exists'
                                          : task.ghostInfo?.approvalGhostReason === 'user_missing'
                                            ? 'Approval line has deleted user(s)'
                                            : task.ghostInfo?.approvalGhostReason === 'user_inactive'
                                              ? 'Approval line has inactive user(s)'
                                              : task.ghostInfo?.approvalGhostReason === 'approval_line_deleted'
                                                ? 'Approval line was deleted'
                                                : task.ghostInfo?.escalationGhostReason === 'position_vacant'
                                                  ? 'Escalation path has vacant position(s)'
                                                  : task.ghostInfo?.escalationGhostReason === 'user_missing'
                                                    ? 'Escalation path has deleted user(s)'
                                                    : task.ghostInfo?.escalationGhostReason === 'escalation_path_deleted'
                                                      ? 'Escalation path was deleted'
                                                      : 'Workflow configuration issue - click to resolve'}
                                    </p>
                                    {task.ghostInfo?.affectedApprovalPositions?.map((pos, i) => (
                                      <p key={i} className="text-xs text-muted-foreground">
                                        • {pos.positionTitle || pos.positionId}
                                      </p>
                                    ))}
                                    {task.ghostInfo?.affectedEscalationPositions?.map((pos, i) => (
                                      <p key={i} className="text-xs text-muted-foreground">
                                        • {pos.positionTitle || pos.positionId}
                                      </p>
                                    ))}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            ) : null}
                          </TableCell>
                          {/* Checkbox */}
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => onSelectTask(task.id, checked as boolean)}
                            />
                          </TableCell>
                          {/* Dynamic Columns */}
                          {visibleOrderedColumns.map(columnId => renderCell(task, columnId))}
                          {/* Empty cell for column chooser icon */}
                          <TableCell className="w-10"></TableCell>
                        </TableRow>

                        {/* Subtask Rows - Only if expanded */}
                        {isExpanded && subtasks.map(subtask => {
                          const isSubSelected = selectedTaskIds.has(subtask.id)
                          const subHasGhostIssue = subtask.hasGhostIssue || subtask.ghostInfo?.hasGhostApproval || subtask.ghostInfo?.hasGhostEscalation
                          const subStatusColors = getStatusColors(subtask.status)

                          // Get border color class for subtasks (thinner border)
                          const getSubtaskBorder = () => {
                            if (subHasGhostIssue) return 'border-l-2 border-l-red-400 dark:border-l-red-600'
                            if (isSubSelected) return 'border-l-2 border-l-blue-400 dark:border-l-blue-600'
                            // Extract color from status border (e.g., 'border-l-blue-500' -> 'border-l-2 border-l-blue-500')
                            const colorMatch = subStatusColors.border.match(/border-l-(\w+-\d+)/)
                            const colorClass = colorMatch ? `border-l-${colorMatch[1]}` : 'border-l-gray-400'
                            return `border-l-2 ${colorClass}`
                          }

                          return (
                            <TableRow
                              key={subtask.id}
                              className={cn(
                                'group transition-all duration-200',
                                // Base status colors (only apply if not selected and no ghost issue)
                                !isSubSelected && !subHasGhostIssue && subStatusColors.bg,
                                !isSubSelected && !subHasGhostIssue && subStatusColors.bgDark,
                                !isSubSelected && !subHasGhostIssue && subStatusColors.hover,
                                !isSubSelected && !subHasGhostIssue && subStatusColors.hoverDark,
                                // Selected state takes priority
                                isSubSelected && 'bg-blue-50/80 dark:bg-blue-950/30',
                                // Ghost issue takes highest priority
                                subHasGhostIssue && 'bg-red-50/40 dark:bg-red-950/20',
                                // Border styling
                                getSubtaskBorder(),
                                // Hover effects
                                (isSubSelected || subHasGhostIssue) && 'hover:bg-blue-50/60 dark:hover:bg-blue-950/25 hover:shadow-sm',
                                !isSubSelected && !subHasGhostIssue && 'hover:shadow-sm'
                              )}
                            >
                              {/* Ghost Indicator */}
                              <TableCell className="w-8 px-2">
                                {subHasGhostIssue ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="cursor-pointer">
                                        <Ghost className="h-4 w-4 text-red-500 animate-pulse" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                      <p className="font-medium text-red-600">Workflow Issue</p>
                                      <p className="text-sm">Click to resolve</p>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : null}
                              </TableCell>
                              {/* Checkbox */}
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={isSubSelected}
                                  onCheckedChange={(checked) => onSelectTask(subtask.id, checked as boolean)}
                                />
                              </TableCell>
                              {/* Dynamic Columns - Pass true for isSubtaskRow */}
                              {visibleOrderedColumns.map(columnId => renderCell(subtask, columnId, true))}
                              {/* Empty cell */}
                              <TableCell className="w-10"></TableCell>
                            </TableRow>
                          )
                        })}
                      </Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </TooltipProvider>
        ) : (
          <div className="text-center text-muted-foreground py-12">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p>No tasks in this project yet</p>
            <Button className="mt-4" onClick={onCreateTask}>
              Create Task
            </Button>
          </div>
        )}
      </CardContent>
    </Card >
  )
}

