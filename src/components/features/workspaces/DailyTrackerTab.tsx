'use client'

import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { CheckCircle2, Circle, Clock, CalendarDays, ExternalLink, Filter, User, Tag, AlertCircle } from 'lucide-react'
import { format, startOfDay, endOfDay, isWithinInterval, differenceInDays } from 'date-fns'
import type { GeneratedTask } from '@/types/task-template-schema'
import type { EnhancedProject } from '@/types/project-schema'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface DailyTrackerTabProps {
    tasks: GeneratedTask[]
    projects: EnhancedProject[]
    currentUser: { id: string; name: string }
    companyId: string
    users: { id: string; name: string }[]
    workspaceId: string
    onStatusChange: (taskId: string, newStatus: GeneratedTask['status']) => Promise<void>
}

export function DailyTrackerTab({
    tasks,
    projects,
    currentUser,
    users,
    companyId,
    workspaceId,
    onStatusChange
}: DailyTrackerTabProps) {
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [priorityFilter, setPriorityFilter] = useState<string>('all')
    const [typeFilter, setTypeFilter] = useState<string>('all')
    const [assigneeFilter, setAssigneeFilter] = useState<string>('all')

    const today = useMemo(() => new Date(), [])
    const dayStart = startOfDay(today)
    const dayEnd = endOfDay(today)

    // Filter tasks for Today + Overdue pending tasks across all team members
    const todaysTasks = useMemo(() => {
        return tasks.filter(task => {
            // 1. Check date match (must be due today OR overdue and pending)
            const taskDate = task.dueDate ? new Date(task.dueDate) : null
            if (!taskDate) return false

            const isToday = isWithinInterval(taskDate, { start: dayStart, end: dayEnd })
            const isOverdue = taskDate < dayStart && task.status !== 'completed'

            if (!isToday && !isOverdue) return false

            // 2. Status Filter
            if (statusFilter === 'overdue') {
                if (!isOverdue) return false
            } else if (statusFilter !== 'all' && task.status !== statusFilter) {
                // Keep existing status filtering for other cases if needed, 
                // but user asked for 2 options, so we handle 'overdue' specifically.
                return false
            }

            // 3. Priority Filter
            if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false

            // 4. Type Filter
            if (typeFilter === 'recurring' && !task.metadata?.isRecurring) return false
            if (typeFilter === 'one-off' && task.metadata?.isRecurring) return false

            // 5. Assignee Filter
            if (assigneeFilter !== 'all' && task.assignedUserId !== assigneeFilter) return false

            return true
        }).sort((a, b) => {
            const dateA = startOfDay(a.dueDate ? new Date(a.dueDate) : today)
            const dateB = startOfDay(b.dueDate ? new Date(b.dueDate) : today)

            // 1. Primary: Date Descending (18/02 -> 16/02 -> 11/02)
            if (dateB.getTime() !== dateA.getTime()) {
                return dateB.getTime() - dateA.getTime()
            }

            // 2. Secondary: Completed last
            if (a.status === 'completed' && b.status !== 'completed') return 1
            if (a.status !== 'completed' && b.status === 'completed') return -1

            // 3. Tertiary: Priority
            const statusOrder = { 'urgent': 0, 'high': 1, 'medium': 2, 'low': 3 }
            const priorityA = statusOrder[a.priority as keyof typeof statusOrder] || 99
            const priorityB = statusOrder[b.priority as keyof typeof statusOrder] || 99

            return priorityA - priorityB
        })
    }, [tasks, statusFilter, priorityFilter, typeFilter, assigneeFilter, dayStart, dayEnd])

    const stats = useMemo(() => {
        const total = todaysTasks.length
        const completed = todaysTasks.filter(t => t.status === 'completed').length
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0
        return { total, completed, progress }
    }, [todaysTasks])

    return (
        <div className="space-y-6">
            {/* Header / Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-[#EFF6FF] dark:bg-blue-950/20 border-blue-100 dark:border-blue-900 border shadow-sm rounded-xl overflow-hidden">
                    <CardContent className="pt-6 flex items-center justify-between">
                        <div>
                            <p className="text-[13px] font-bold text-blue-600 dark:text-blue-400">Today's Focus</p>
                            <h2 className="text-4xl font-extrabold tracking-tight text-[#1E3A8A] dark:text-blue-100 mt-0.5">{stats.total} Tasks</h2>
                            <p className="text-[11px] text-blue-600/60 dark:text-blue-400/60 mt-1 font-semibold tracking-tight">Includes overdue pending tasks</p>
                        </div>
                        <div className="h-12 w-12 rounded-xl bg-white dark:bg-blue-900/40 flex items-center justify-center border border-blue-200/50 shadow-sm">
                            <CalendarDays className="h-6 w-6 text-blue-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card className={cn(
                    "border shadow-sm bg-white dark:bg-slate-950 rounded-xl overflow-hidden",
                    stats.progress === 100 ? "border-l-4 border-l-green-500" : "border-l-4 border-l-[#F97316]"
                )}>
                    <CardContent className="pt-6 flex items-center justify-between">
                        <div>
                            <p className="text-[13px] font-bold text-muted-foreground/60">Completion</p>
                            <h2 className="text-4xl font-extrabold tracking-tight mt-0.5">{stats.progress}%</h2>
                        </div>
                        <div className={cn(
                            "h-12 w-12 rounded-xl flex items-center justify-center border shadow-sm",
                            stats.progress === 100 ? "bg-green-50/50 border-green-100" : "bg-orange-50/50 border-orange-100"
                        )}>
                            {stats.progress === 100 ? (
                                <CheckCircle2 className="h-6 w-6 text-green-500" />
                            ) : (
                                <Clock className="h-6 w-6 text-[#F97316]" />
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Task List */}
            <Card className="shadow-sm overflow-hidden">
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0 pb-6 pt-7 px-7">
                    <div className="space-y-1">
                        <CardTitle className="text-2xl font-bold text-foreground/90 tracking-tight">Your Schedule</CardTitle>
                        <CardDescription className="text-xs font-semibold text-muted-foreground/50 tracking-normal uppercase">
                            Team's daily tasks for {format(new Date(), 'EEEE, MMMM do, yyyy')}
                        </CardDescription>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Status Filter */}
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[120px] h-9 bg-white dark:bg-muted/10 border-muted-foreground/20 text-[11px] font-bold shadow-sm rounded-lg hover:bg-muted/5 transition-colors">
                                <SelectValue placeholder="All Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="overdue">Overdue</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Priority Filter */}
                        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                            <SelectTrigger className="w-[120px] h-9 bg-white dark:bg-muted/10 border-muted-foreground/20 text-[11px] font-bold shadow-sm rounded-lg hover:bg-muted/5 transition-colors">
                                <SelectValue placeholder="All Priority" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Priority</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Type Filter */}
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-[120px] h-9 bg-white dark:bg-muted/10 border-muted-foreground/20 text-[11px] font-bold shadow-sm rounded-lg hover:bg-muted/5 transition-colors">
                                <SelectValue placeholder="All Types" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="recurring">Recurring</SelectItem>
                                <SelectItem value="one-off">One-off</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Members Filter */}
                        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                            <SelectTrigger className="w-[140px] h-9 bg-white dark:bg-muted/10 border-muted-foreground/20 text-[11px] font-bold shadow-sm rounded-lg hover:bg-muted/5 transition-colors">
                                <SelectValue placeholder="All Members" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Members</SelectItem>
                                {users.map(user => (
                                    <SelectItem key={user.id} value={user.id}>{user.id === currentUser.id ? 'Me (You)' : user.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {(statusFilter !== 'all' || priorityFilter !== 'all' || typeFilter !== 'all' || assigneeFilter !== 'all') && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setStatusFilter('all')
                                    setPriorityFilter('all')
                                    setTypeFilter('all')
                                    setAssigneeFilter('all')
                                }}
                                className="text-[10px] font-bold h-8 uppercase text-muted-foreground/60 hover:text-primary transition-all ml-1"
                            >
                                Clear
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {todaysTasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                            <div className="w-14 h-14 rounded-full bg-green-50 dark:bg-green-900/10 flex items-center justify-center mb-4 border border-green-100 dark:border-green-900/30 shadow-sm">
                                <CheckCircle2 className="h-7 w-7 text-green-500/60" />
                            </div>
                            <h3 className="text-lg font-bold text-foreground/80">No tasks found</h3>
                            <p className="text-sm max-w-sm mt-1 font-medium text-muted-foreground/60">
                                No tasks match your current selection for today.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-[#F9FAFB] dark:bg-muted/10 hover:bg-[#F9FAFB] border-b border-muted/50">
                                        <TableHead className="w-[80px] pl-7"></TableHead>
                                        <TableHead className="text-[10px] font-extrabold uppercase tracking-widest text-[#94A3B8] h-14">Task</TableHead>
                                        <TableHead className="text-[10px] font-extrabold uppercase tracking-widest text-[#94A3B8] h-14 text-center">Assignee</TableHead>
                                        <TableHead className="text-[10px] font-extrabold uppercase tracking-widest text-[#94A3B8] h-14">Project</TableHead>
                                        <TableHead className="text-[10px] font-extrabold uppercase tracking-widest text-[#94A3B8] h-14">Type</TableHead>
                                        <TableHead className="text-[10px] font-extrabold uppercase tracking-widest text-[#94A3B8] h-14">Status</TableHead>
                                        <TableHead className="text-[10px] font-extrabold uppercase tracking-widest text-[#94A3B8] h-14 text-center">Priority</TableHead>
                                        <TableHead className="text-[10px] font-extrabold uppercase tracking-widest text-[#94A3B8] h-14">Reporter</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {todaysTasks.map((task) => {
                                        const project = projects.find(p => p.id === task.projectId)
                                        const assignee = users.find(u => u.id === task.assignedUserId)
                                        const reporter = users.find(u => u.id === task.reporter)
                                        const isCompleted = task.status === 'completed'

                                        return (
                                            <TableRow key={task.id} className={cn("hover:bg-[#F8FAFC] dark:hover:bg-muted/5 border-muted/20 transition-colors h-[72px]", isCompleted && "bg-[#F8FAFC]/50")}>
                                                <TableCell className="pl-7">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className={cn(
                                                            "h-6 w-6 rounded-full shrink-0 border-2 transition-all duration-300",
                                                            isCompleted ? "border-slate-300 text-slate-300 bg-slate-50" : "border-slate-200 text-transparent"
                                                        )}
                                                        onClick={() => onStatusChange(task.id, isCompleted ? 'in_progress' : 'completed')}
                                                    >
                                                        {isCompleted && <div className="h-2 w-2 rounded-full bg-slate-300" />}
                                                    </Button>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <Link
                                                            href={`/workspaces/${workspaceId}/projects/${task.projectId}?taskId=${task.id}`}
                                                            className="cursor-pointer group"
                                                        >
                                                            <span className={cn(
                                                                "text-sm font-bold text-foreground/80 group-hover:text-primary transition-colors block mb-0.5 leading-snug",
                                                                isCompleted && "text-muted-foreground line-through decoration-slate-400"
                                                            )}>
                                                                {task.title}
                                                            </span>
                                                            <div className="text-[10px] font-bold text-muted-foreground/40 tracking-tight">
                                                                | {format(task.dueDate ? new Date(task.dueDate) : new Date(), 'dd/MM/yyyy')}
                                                            </div>
                                                        </Link>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex flex-col items-center justify-center min-w-[120px]">
                                                        <span className="text-[10px] font-extrabold text-[#475569] uppercase leading-[1.3] text-center max-w-[140px] break-words">
                                                            {assignee?.name || task.assignedToName || 'UNASSIGNED'}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {project ? (
                                                        <Badge variant="outline" className="font-extrabold text-[9px] bg-white border-muted/80 dark:bg-muted/20 px-3 py-1 rounded-full text-muted-foreground/70 uppercase shadow-none tracking-tight">
                                                            {project.name}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {task.metadata?.isRecurring ? (
                                                        <Badge variant="secondary" className="bg-[#FAF5FF] text-[#9333EA] dark:bg-purple-900/40 dark:text-purple-300 border-[#F3E8FF] text-[10px] font-extrabold px-3 py-1 rounded-full shadow-none uppercase">
                                                            Recurring
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="secondary" className="bg-[#F8FAFC] text-[#64748B] dark:bg-slate-800 dark:text-slate-400 text-[10px] font-extrabold px-3 py-1 rounded-full shadow-none uppercase">
                                                            Once-off
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {!isCompleted && task.dueDate && new Date(task.dueDate) < dayStart ? (
                                                        <span className="text-[10px] font-bold text-[#D97706] whitespace-nowrap">
                                                            {Math.abs(differenceInDays(new Date(task.dueDate), dayStart))} {Math.abs(differenceInDays(new Date(task.dueDate), dayStart)) === 1 ? 'day' : 'days'} overdue
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground/30 font-extrabold text-[12px]">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="outline" className={cn(
                                                        "uppercase text-[9px] font-extrabold px-3 py-1 rounded-full border shadow-none min-w-[75px] justify-center tracking-tight",
                                                        (task.priority === 'urgent') ? "border-red-100 text-red-500 bg-red-50/50" :
                                                            (task.priority === 'high') ? "border-orange-100 text-orange-600 bg-orange-50/50" :
                                                                "text-[#64748B] bg-slate-50 border-slate-200"
                                                    )}>
                                                        {task.priority || 'MEDIUM'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-extrabold text-[#1E293B] uppercase leading-[1.3] break-words max-w-[140px] tracking-tight">
                                                            {reporter?.name || task.reporterName || 'SYSTEM'}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
