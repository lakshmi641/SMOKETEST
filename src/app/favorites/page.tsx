'use client'

import { useState, useEffect, useMemo } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useStarredItems } from '@/hooks/useStarredItems'
import { useSidebarStore } from '@/store/sidebarStore'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { Building2, FolderKanban, Star, ChevronRight, ClipboardList, ListTodo, Clock, Calendar } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useCompany } from '@/hooks/useCompany'
import { TaskTemplateService } from '@/lib/services/tasks/task-template-service'
import type { GeneratedTask } from '@/types/task-template-schema'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { ViewToggle, ViewType } from '@/components/ui/view-toggle'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { formatDate } from '@/lib/utils/date-utils'

function TaskCard({ task, projects = [], workspaces = [], allTasks = [], hideTaskId = false }: {
    task: GeneratedTask,
    projects?: any[],
    workspaces?: any[],
    allTasks?: GeneratedTask[],
    hideTaskId?: boolean
}) {
    const statusColors: Record<string, string> = {
        open: 'bg-slate-100 text-slate-700 border-slate-200',
        assigned: 'bg-blue-100 text-blue-700 border-blue-200',
        in_progress: 'bg-amber-100 text-amber-700 border-amber-200',
        completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        on_hold: 'bg-orange-100 text-orange-700 border-orange-200',
        cancelled: 'bg-rose-100 text-rose-700 border-rose-200',
    }

    const priorityColors: Record<string, string> = {
        low: 'bg-slate-100 text-slate-600',
        medium: 'bg-blue-100 text-blue-600',
        high: 'bg-orange-100 text-orange-600',
        urgent: 'bg-rose-100 text-rose-600',
    }

    const projectName = projects.find(p => p.id === task.projectId)?.name
    const workspaceName = workspaces.find(w => w.id === task.workspaceId || w.id === projects.find(p => p.id === task.projectId)?.workspaceId)?.name
    const parentTaskName = task.parentTaskId ? allTasks.find(t => t.id === task.parentTaskId)?.title : null

    return (
        <Link
            href={`/projects/${task.projectId}/tasks/${task.id}`}
            className="group p-5 bg-card border rounded-xl hover:shadow-lg hover:border-primary/50 transition-all flex flex-col h-full"
        >
            <div className="flex items-start justify-between mb-3">
                <div className="flex flex-col gap-1 w-full overflow-hidden">
                    <div className="flex flex-wrap gap-x-2 gap-y-1 mb-1 items-center">
                        {workspaceName && (
                            <span className="text-[9px] font-bold text-primary/70 uppercase tracking-tight">
                                {workspaceName}
                            </span>
                        )}
                        {projectName && (
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">
                                • {projectName}
                            </span>
                        )}
                    </div>
                    {parentTaskName && (
                        <span className="text-[10px] font-medium text-amber-600 truncate mb-1 bg-amber-50 px-1.5 py-0.5 rounded w-fit">
                            Part of: {parentTaskName}
                        </span>
                    )}
                    <div className="flex items-center gap-2">
                        {!hideTaskId && task.projectCode && (
                            <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider flex-shrink-0">
                                {task.projectCode}-{task.taskNumber}
                            </span>
                        )}
                        <h3 className="font-bold text-base group-hover:text-primary transition-colors line-clamp-2 leading-tight">
                            {task.title}
                        </h3>
                    </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
            </div>

            <p className="text-xs text-muted-foreground line-clamp-2 mb-4 flex-grow">
                {task.description || 'No description provided'}
            </p>

            {task.progress > 0 && task.status !== 'completed' && (
                <div className="mb-4 space-y-1.5">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Progress</span>
                        <span>{task.progress}%</span>
                    </div>
                    <Progress value={task.progress} className="h-1" />
                </div>
            )}

            <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span>{task.dueDate ? formatDate(task.dueDate) : 'No due date'}</span>
                </div>
                {task.estimatedHours > 0 && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground justify-end cursor-help group/hours">
                                <Clock className="w-3 h-3 group-hover/hours:text-primary transition-colors" />
                                <span>{task.estimatedHours}h</span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[200px] border-primary/20 bg-white/95 backdrop-blur-sm p-3 shadow-xl">
                            <div className="space-y-1.5">
                                <p className="font-bold text-[11px] text-primary flex items-center gap-1.5">
                                    <Clock className="w-3 h-3" />
                                    Estimated Hours
                                </p>
                                <p className="text-[10px] text-muted-foreground leading-relaxed">
                                    The expected effort to complete this {task.parentTaskId ? 'subtask' : 'task'}.
                                </p>
                            </div>
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>

            <div className="mt-auto pt-3 border-t flex items-center justify-between">
                <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 uppercase font-bold tracking-tighter", statusColors[task.status] || 'bg-slate-100')}>
                    {task.status.replace('_', ' ')}
                </Badge>
                <div className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase", priorityColors[task.priority])}>
                    {task.priority}
                </div>
            </div>
        </Link>
    )
}

function WorkspacesTable({ workspaces }: { workspaces: any[] }) {
    return (
        <div className="border rounded-xl overflow-hidden bg-card">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead className="w-[300px]">Workspace</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Stats</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {workspaces.map((workspace) => (
                        <TableRow key={workspace.id} className="group cursor-pointer hover:bg-accent/5">
                            <TableCell>
                                <Link href={`/workspaces/${workspace.id}`} className="flex items-center gap-3">
                                    <div
                                        className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 border border-primary/20 shrink-0"
                                        style={workspace.color ? { backgroundColor: `${workspace.color}15`, borderColor: `${workspace.color}30` } : {}}
                                    >
                                        <FolderKanban
                                            className="w-4 h-4 text-primary"
                                            style={workspace.color ? { color: workspace.color } : {}}
                                        />
                                    </div>
                                    <span className="font-bold group-hover:text-primary transition-colors">
                                        {workspace.name}
                                    </span>
                                </Link>
                            </TableCell>
                            <TableCell>
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                    {workspace.description || 'No description provided'}
                                </p>
                            </TableCell>
                            <TableCell className="text-right text-[10px] text-muted-foreground font-medium">
                                <div className="flex flex-col">
                                    <span>{workspace.totalProjects || 0} Projects</span>
                                    <span>{workspace.totalTasks || 0} Tasks</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Link href={`/workspaces/${workspace.id}`}>
                                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                </Link>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

function ProjectsTable({ projects, workspaces }: { projects: any[], workspaces: any[] }) {
    return (
        <div className="border rounded-xl overflow-hidden bg-card">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead className="w-[300px]">Project</TableHead>
                        <TableHead>Workspace</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {projects.map((project) => {
                        const workspace = workspaces.find(w => w.id === (project as any).workspaceId)
                        return (
                            <TableRow key={project.id} className="group cursor-pointer hover:bg-accent/5">
                                <TableCell>
                                    <Link href={`/projects/${project.id}`} className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent/50 border border-border shrink-0">
                                            <Building2 className="w-4 h-4 text-muted-foreground opacity-50" />
                                        </div>
                                        <span className="font-bold group-hover:text-primary transition-colors">
                                            {project.name}
                                        </span>
                                    </Link>
                                </TableCell>
                                <TableCell>
                                    {workspace && (
                                        <span className="text-[10px] font-bold text-primary/70 uppercase tracking-tight">
                                            {workspace.name}
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <span className={cn(
                                        "px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider",
                                        project.status === 'active' ? "bg-success/10 text-success border border-success/20" : "bg-muted text-muted-foreground border border-border"
                                    )}>
                                        {project.status}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    {project.priority && (
                                        <span className="text-[10px] font-bold uppercase text-muted-foreground">
                                            {project.priority}
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Link href={`/projects/${project.id}`}>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </Link>
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    )
}

function TasksTable({ tasks, projects, workspaces, allTasks, hideTaskId = false }: {
    tasks: GeneratedTask[],
    projects: any[],
    workspaces: any[],
    allTasks: GeneratedTask[],
    hideTaskId?: boolean
}) {
    const statusColors: Record<string, string> = {
        open: 'bg-slate-100 text-slate-700 border-slate-200',
        assigned: 'bg-blue-100 text-blue-700 border-blue-200',
        in_progress: 'bg-amber-100 text-amber-700 border-amber-200',
        completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        on_hold: 'bg-orange-100 text-orange-700 border-orange-200',
        cancelled: 'bg-rose-100 text-rose-700 border-rose-200',
    }

    const priorityColors: Record<string, string> = {
        low: 'text-slate-600',
        medium: 'text-blue-600',
        high: 'text-orange-600',
        urgent: 'text-rose-600',
    }

    return (
        <div className="border rounded-xl overflow-hidden bg-card">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead className="w-[300px]">Task</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {tasks.map((task) => {
                        const projectName = projects.find(p => p.id === task.projectId)?.name
                        const workspaceName = workspaces.find(w => w.id === task.workspaceId || w.id === projects.find(p => p.id === task.projectId)?.workspaceId)?.name
                        const parentTaskName = task.parentTaskId ? allTasks.find(t => t.id === task.parentTaskId)?.title : null

                        return (
                            <TableRow key={task.id} className="group cursor-pointer hover:bg-accent/5">
                                <TableCell>
                                    <Link href={`/projects/${task.projectId}/tasks/${task.id}`} className="flex flex-col gap-0.5">
                                        {parentTaskName && (
                                            <span className="text-[9px] font-medium text-amber-600 uppercase tracking-tighter bg-amber-50 px-1 py-0 rounded w-fit">
                                                Subtask of: {parentTaskName}
                                            </span>
                                        )}
                                        <div className="flex items-center gap-2">
                                            {!hideTaskId && task.projectCode && (
                                                <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase flex-shrink-0">
                                                    {task.projectCode}-{task.taskNumber}
                                                </span>
                                            )}
                                            <span className="font-bold group-hover:text-primary transition-colors line-clamp-1">
                                                {task.title}
                                            </span>
                                        </div>
                                    </Link>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col text-[10px] uppercase font-bold tracking-tight">
                                        <span className="text-primary/70 truncate max-w-[120px]">{workspaceName}</span>
                                        <span className="text-muted-foreground truncate max-w-[120px]">{projectName}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 uppercase font-bold tracking-tighter", statusColors[task.status] || 'bg-slate-100')}>
                                        {task.status.replace('_', ' ')}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <span className={cn("text-[10px] font-bold uppercase", priorityColors[task.priority])}>
                                        {task.priority}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                                        <Calendar className="w-3 h-3" />
                                        <span>{task.dueDate ? formatDate(task.dueDate) : '-'}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2 w-[80px]">
                                        <Progress value={task.progress} className="h-1" />
                                        <span className="text-[10px] text-muted-foreground font-medium">{task.progress}%</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Link href={`/projects/${task.projectId}/tasks/${task.id}`}>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </Link>
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    )
}

export default function FavoritesPage() {
    const router = useRouter()
    const { currentCompany, groupId } = useCompany()
    const hideTaskId = (currentCompany?.id != null && currentCompany.id.toLowerCase().includes('autocracy')) ||
        (currentCompany?.domain != null && currentCompany.domain.toLowerCase().includes('autocracy'))
    const { starredItems, loading: loadingStarred } = useStarredItems()
    const { projects } = useSidebarStore()
    const { workspaces } = useWorkspace()

    const [starredTasksState, setStarredTasksState] = useState<GeneratedTask[]>([])
    const [loadingTasks, setLoadingTasks] = useState(false)
    const [viewMode, setViewMode] = useState<ViewType>('card')

    useEffect(() => {
        if (!currentCompany?.id || !starredItems.tasks?.size) {
            setStarredTasksState([])
            return
        }

        const fetchStarredTasks = async () => {
            setLoadingTasks(true)
            try {
                const taskIds = Array.from(starredItems.tasks)
                let tasks = await TaskTemplateService.getTasksByIds(currentCompany.id, taskIds, groupId ?? undefined)

                // Fetch missing parent tasks for subtasks
                const parentTaskIds = Array.from(new Set(
                    tasks
                        .filter(t => t.parentTaskId && !taskIds.includes(t.parentTaskId))
                        .map(t => t.parentTaskId!)
                ))

                if (parentTaskIds.length > 0) {
                    const parentTasks = await TaskTemplateService.getTasksByIds(currentCompany.id, parentTaskIds, groupId ?? undefined)
                    tasks = [...tasks, ...parentTasks]
                }

                setStarredTasksState(tasks)
            } catch (error) {
                console.error('Error fetching starred tasks:', error)
            } finally {
                setLoadingTasks(false)
            }
        }

        fetchStarredTasks()
    }, [currentCompany?.id, starredItems.tasks])

    const starredProjects = useMemo(() => {
        const projectIds = Array.from(starredItems.projects || [])
        return projects.filter(p => projectIds.includes(p.id))
    }, [projects, starredItems.projects])

    const starredWorkspaces = useMemo(() => {
        const workspaceIds = Array.from(starredItems.workspaces || [])
        return workspaces.filter(w => workspaceIds.includes(w.id))
    }, [workspaces, starredItems.workspaces])

    const starredTasks = useMemo(() => {
        const starIds = Array.from(starredItems.tasks || [])
        return starredTasksState.filter(t => starIds.includes(t.id) && !t.parentTaskId)
    }, [starredTasksState, starredItems.tasks])

    const starredSubtasks = useMemo(() => {
        const starIds = Array.from(starredItems.tasks || [])
        return starredTasksState.filter(t => starIds.includes(t.id) && !!t.parentTaskId)
    }, [starredTasksState, starredItems.tasks])

    const hasFavorites = starredProjects.length > 0 ||
        starredWorkspaces.length > 0 ||
        starredTasks.length > 0 ||
        starredSubtasks.length > 0

    const loading = loadingStarred || (loadingTasks && starredTasksState.length === 0)

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <TooltipProvider delayDuration={300}>
                <div className="w-full space-y-8">
                    <div className="flex items-end justify-between">
                        <div>
                            <h1 className="text-3xl font-bold flex items-center gap-3">
                                <Star className="w-8 h-8 text-warning fill-warning" />
                                Favorites
                            </h1>
                            <p className="text-muted-foreground mt-2">
                                Your most important projects and workspaces in one place.
                            </p>
                        </div>
                        <ViewToggle currentView={viewMode} onViewChange={setViewMode} />
                    </div>

                    {!hasFavorites ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed rounded-xl bg-accent/5">
                            <div className="bg-accent/10 p-4 rounded-full mb-4">
                                <Star className="w-12 h-12 text-muted-foreground opacity-20" />
                            </div>
                            <h3 className="text-xl font-semibold">No favorites yet</h3>
                            <p className="text-muted-foreground max-w-sm mt-2">
                                Star your projects and workspaces to see them here for quick access.
                            </p>
                            <div className="flex gap-4 mt-8">
                                <Button onClick={() => router.push('/workspaces')} variant="outline">
                                    Browse Workspaces
                                </Button>
                                <Button onClick={() => router.push('/projects')} variant="outline">
                                    Browse Projects
                                </Button>
                                <Button onClick={() => router.push('/my-tasks')}>
                                    Browse Tasks
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-8">
                            {starredWorkspaces.length > 0 && (
                                <section>
                                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                        <FolderKanban className="w-5 h-5 text-primary" />
                                        Starred Workspaces
                                    </h2>
                                    {viewMode === 'card' ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {starredWorkspaces.map((workspace) => (
                                                <Link
                                                    key={workspace.id}
                                                    href={`/workspaces/${workspace.id}`}
                                                    className="group p-5 bg-card border rounded-xl hover:shadow-lg hover:border-primary/50 transition-all"
                                                >
                                                    <div className="flex items-start justify-between mb-4">
                                                        <div
                                                            className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 border border-primary/20"
                                                            style={workspace.color ? { backgroundColor: `${workspace.color}15`, borderColor: `${workspace.color}30` } : {}}
                                                        >
                                                            <FolderKanban
                                                                className="w-5 h-5 text-primary"
                                                                style={workspace.color ? { color: workspace.color } : {}}
                                                            />
                                                        </div>
                                                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                                    </div>
                                                    <h3 className="font-bold text-lg group-hover:text-primary transition-colors">
                                                        {workspace.name}
                                                    </h3>
                                                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1 min-h-[2.5rem]">
                                                        {workspace.description || 'No description provided'}
                                                    </p>
                                                    <div className="mt-4 pt-4 border-t flex items-center justify-between text-xs text-muted-foreground">
                                                        <span>{workspace.totalProjects || 0} Projects</span>
                                                        <span>{workspace.totalTasks || 0} Tasks</span>
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    ) : (
                                        <WorkspacesTable workspaces={starredWorkspaces} />
                                    )}
                                </section>
                            )}

                            {starredProjects.length > 0 && (
                                <section>
                                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                        <Building2 className="w-5 h-5 text-primary" />
                                        Starred Projects
                                    </h2>
                                    {viewMode === 'card' ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {starredProjects.map((project) => {
                                                const workspace = workspaces.find(w => w.id === (project as any).workspaceId)
                                                return (
                                                    <Link
                                                        key={project.id}
                                                        href={`/projects/${project.id}`}
                                                        className="group p-5 bg-card border rounded-xl hover:shadow-lg hover:border-primary/50 transition-all"
                                                    >
                                                        <div className="flex items-start justify-between mb-4">
                                                            <div className="flex flex-col gap-1">
                                                                {workspace && (
                                                                    <span className="text-[10px] font-bold text-primary/70 uppercase tracking-tight truncate max-w-[200px]">
                                                                        {workspace.name}
                                                                    </span>
                                                                )}
                                                                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-accent/50 border border-border overflow-hidden">
                                                                    <Building2 className="w-5 h-5 text-muted-foreground opacity-50" />
                                                                </div>
                                                            </div>
                                                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                                        </div>
                                                        <h3 className="font-bold text-lg group-hover:text-primary transition-colors">
                                                            {project.name}
                                                        </h3>
                                                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1 min-h-[2.5rem]">
                                                            {project.description || 'No description provided'}
                                                        </p>
                                                        <div className="mt-4 pt-4 border-t flex items-center justify-between">
                                                            <div className="flex gap-2">
                                                                <span className={cn(
                                                                    "px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider",
                                                                    project.status === 'active' ? "bg-success/10 text-success border border-success/20" : "bg-muted text-muted-foreground border border-border"
                                                                )}>
                                                                    {project.status}
                                                                </span>
                                                            </div>
                                                            <span className="text-xs text-muted-foreground">
                                                                {project.priority && `${project.priority.toUpperCase()} Priority`}
                                                            </span>
                                                        </div>
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <ProjectsTable projects={starredProjects} workspaces={workspaces} />
                                    )}
                                </section>
                            )}

                            {starredTasks.length > 0 && (
                                <section>
                                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                        <ClipboardList className="w-5 h-5 text-primary" />
                                        Starred Tasks
                                    </h2>
                                    {viewMode === 'card' ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {starredTasks.map((task) => (
                                                <TaskCard
                                                    key={task.id}
                                                    task={task}
                                                    projects={projects}
                                                    workspaces={workspaces}
                                                    hideTaskId={hideTaskId}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <TasksTable
                                            tasks={starredTasks}
                                            projects={projects}
                                            workspaces={workspaces}
                                            allTasks={starredTasksState}
                                            hideTaskId={hideTaskId}
                                        />
                                    )}
                                </section>
                            )}

                            {starredSubtasks.length > 0 && (
                                <section>
                                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                        <ListTodo className="w-5 h-5 text-primary" />
                                        Starred Subtasks
                                    </h2>
                                    {viewMode === 'card' ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {starredSubtasks.map((task) => (
                                                <TaskCard
                                                    key={task.id}
                                                    task={task}
                                                    projects={projects}
                                                    workspaces={workspaces}
                                                    allTasks={starredTasksState}
                                                    hideTaskId={hideTaskId}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <TasksTable
                                            tasks={starredSubtasks}
                                            projects={projects}
                                            workspaces={workspaces}
                                            allTasks={starredTasksState}
                                            hideTaskId={hideTaskId}
                                        />
                                    )}
                                </section>
                            )}
                        </div>
                    )}
                </div>
            </TooltipProvider>
        </DashboardLayout>
    )
}
