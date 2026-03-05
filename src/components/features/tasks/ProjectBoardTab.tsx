'use client'

import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Search, Filter, X, Users, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TaskKanbanView } from './TaskKanbanView'
import { formatTaskId as formatTaskIdUtil } from '@/lib/utils/task-display'
import type { GeneratedTask } from '@/types/task-template-schema'
import type { EnhancedProject } from '@/types/project-schema'
import type { DragEndEvent } from '@dnd-kit/core'

export interface ProjectBoardTabProps {
  tasks: GeneratedTask[]
  statusMetadata: Array<{ code: string; name: string; color?: string }>
  projectUsers: Array<{ id: string; name?: string; email?: string; avatar?: string | null }>
  project: EnhancedProject | null
  workspace?: any
  companyId: string | null
  currentCompanyDomain?: string | null
  onDragEnd: (event: DragEndEvent) => void
  onDragStart: (event: { active: { id: string } }) => void
  onDragCancel: () => void
  activeId: string | null
  onTaskClick: (task: GeneratedTask) => void
  currentUserId?: string | null
  onCreateTask: () => void
}

export function ProjectBoardTab(props: ProjectBoardTabProps) {
  const {
    tasks,
    statusMetadata,
    projectUsers,
    project,
    companyId,
    currentCompanyDomain,
    onDragEnd,
    onDragStart,
    onDragCancel,
    activeId,
    onTaskClick,
    currentUserId,
    onCreateTask,
  } = props

  const [searchTerm, setSearchTerm] = useState('')
  const [assigneeId, setAssigneeId] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())

  // Only show project members (team + manager) in the assignee filter
  const projectMemberUsers = useMemo(() => {
    if (!project) return []
    const memberIds = new Set<string>()
    if (project.manager) memberIds.add(project.manager)
    if (Array.isArray(project.team)) project.team.forEach(id => memberIds.add(id))
    return projectUsers.filter(u => memberIds.has(u.id))
  }, [project, projectUsers])

  const filteredTasks = useMemo(() => {
    let result = tasks
    const term = searchTerm.trim().toLowerCase()
    if (term) {
      result = result.filter(task => {
        const title = (task.title || '').toLowerCase()
        const desc = (task.description || '').toLowerCase()
        const taskId = formatTaskIdUtil(task, project, companyId ?? undefined, currentCompanyDomain ?? undefined)?.toLowerCase() ?? ''
        return title.includes(term) || desc.includes(term) || taskId.includes(term)
      })
    }
    if (assigneeId !== 'all') {
      result = result.filter(task => task.assignedUserId === assigneeId)
    }
    if (statusFilter.size > 0) {
      result = result.filter(task => task.status && statusFilter.has(task.status))
    }
    return result
  }, [tasks, searchTerm, assigneeId, statusFilter, project, companyId, currentCompanyDomain])

  const hasFiltersActive = searchTerm.trim() !== '' || assigneeId !== 'all' || statusFilter.size > 0
  const clearFilters = () => {
    setSearchTerm('')
    setAssigneeId('all')
    setStatusFilter(new Set())
  }

  if (tasks.length === 0) {
    return (
      <Card className="flex-1 flex flex-col min-h-0">
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground py-12">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p>No tasks in this project yet</p>
            <Button className="mt-4" onClick={onCreateTask}>
              Create Task
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 w-full">
        <div className="flex items-center gap-3 flex-wrap shrink-0 mt-1 ml-1">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search board"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setAssigneeId('all')}
              className={cn(
                'rounded-full p-1 border-2 transition-colors',
                assigneeId === 'all'
                  ? 'border-primary bg-primary/10'
                  : 'border-transparent bg-muted hover:bg-muted/80'
              )}
              title="All assignees"
            >
              <Users className="h-5 w-5 text-muted-foreground" />
            </button>
            {projectMemberUsers.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setAssigneeId(prev => prev === u.id ? 'all' : u.id)}
                className={cn(
                  'rounded-full border-2 transition-transform hover:scale-105',
                  assigneeId === u.id ? 'border-primary ring-2 ring-primary/20' : 'border-transparent'
                )}
                title={u.name || u.email || 'Assignee'}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={u.avatar ?? undefined} alt="" />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {(u.name || u.email || '?').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </button>
            ))}
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <Filter className="h-4 w-4" />
                Filter
                {statusFilter.size > 0 && (
                  <span className="ml-1 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                    {statusFilter.size}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="start">
              <p className="text-sm font-medium mb-2">Status</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {statusMetadata.map(s => (
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
              </div>
              <Button variant="ghost" size="sm" className="w-full mt-2 gap-1.5" onClick={clearFilters}>
                <X className="h-3.5 w-3.5" />
                Clear all filters
              </Button>
            </PopoverContent>
          </Popover>
          {hasFiltersActive && (
            <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground" onClick={clearFilters}>
              <X className="h-4 w-4" />
              Clear filters
            </Button>
          )}
        </div>
        <TaskKanbanView
          tasks={filteredTasks}
          statuses={statusMetadata}
          onDragEnd={onDragEnd}
          onDragStart={onDragStart}
          onDragCancel={onDragCancel}
          activeId={activeId}
          onTaskClick={onTaskClick}
          users={projectUsers.map(u => ({ id: u.id, name: u.name ?? u.email ?? '', avatar: u.avatar ?? null }))}
          currentUserId={currentUserId ?? undefined}
        />
      </div>
    </div>
  )
}
