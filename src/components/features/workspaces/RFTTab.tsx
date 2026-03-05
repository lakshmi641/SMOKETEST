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
import { ClipboardCheck, CheckCircle2, Clock, CalendarDays, User, FolderKanban, Globe } from 'lucide-react'
import { format, startOfDay, differenceInDays } from 'date-fns'
import type { GeneratedTask } from '@/types/task-template-schema'
import type { EnhancedProject } from '@/types/project-schema'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface RFTTabProps {
    tasks: GeneratedTask[]
    projects: EnhancedProject[]
    currentUser: { id: string; name: string }
    companyId: string
    users: { id: string; name: string }[]
    workspaceId: string
    onStatusChange: (taskId: string, newStatus: GeneratedTask['status']) => Promise<void>
    isRftGuest?: boolean
}

export function RFTTab({
    tasks,
    projects,
    currentUser,
    users,
    companyId,
    workspaceId,
    onStatusChange,
    isRftGuest = false
}: RFTTabProps) {
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [priorityFilter, setPriorityFilter] = useState<string>('all')
    const [typeFilter, setTypeFilter] = useState<string>('all')
    const [assigneeFilter, setAssigneeFilter] = useState<string>('all')

    const today = useMemo(() => startOfDay(new Date()), [])

    // Dynamic members list: only those with tasks in this specific project list
    const activeMembers = useMemo(() => {
        const memberIdsWithTasks = new Set(tasks.map(t => t.assignedUserId))
        return users.filter(u => memberIdsWithTasks.has(u.id))
    }, [tasks, users])

    const filteredTasks = useMemo(() => {
        return tasks.filter(task => {
            // Status Filter (includes 'overdue' logic)
            if (statusFilter === 'overdue') {
                const dueDate = task.dueDate ? startOfDay(new Date(task.dueDate)) : null
                if (!dueDate || dueDate >= today || task.status === 'completed') return false
            } else if (statusFilter !== 'all' && task.status !== statusFilter) {
                return false
            }

            // Priority Filter
            if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false

            // Type Filter
            if (typeFilter === 'recurring' && !task.metadata?.isRecurring) return false
            if (typeFilter === 'one-off' && task.metadata?.isRecurring) return false

            // Member Filter
            if (assigneeFilter !== 'all' && task.assignedUserId !== assigneeFilter) return false

            return true
        }).sort((a, b) => {
            // Sort by due date (desc), then priority
            const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0
            const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0
            if (dateA !== dateB) return dateB - dateA

            const priorityOrder = { 'urgent': 0, 'high': 1, 'medium': 2, 'low': 3 }
            return (priorityOrder[a.priority as keyof typeof priorityOrder] || 99) -
                (priorityOrder[b.priority as keyof typeof priorityOrder] || 99)
        })
    }, [tasks, statusFilter, priorityFilter, typeFilter, assigneeFilter, today])

    const stats = useMemo(() => {
        const total = tasks.length
        const completed = tasks.filter(t => t.status === 'completed').length
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0
        return { total, completed, progress }
    }, [tasks])

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-[#FAF5FF] dark:bg-purple-950/20 border-purple-100 dark:border-purple-900 border shadow-sm rounded-xl overflow-hidden">
                    <CardContent className="py-4 px-6 flex items-center justify-between">
                        <div>
                            <p className="text-[12px] font-bold text-purple-600 dark:text-purple-400">RFT Project Summary</p>
                            <h2 className="text-2xl font-extrabold tracking-tight text-[#581C87] dark:text-purple-100 mt-0.5">{stats.total} Total Tasks</h2>
                            <p className="text-[10px] text-purple-600/60 dark:text-purple-400/60 mt-0.5 font-semibold tracking-tight">All tasks in the RFT project</p>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-white dark:bg-purple-900/40 flex items-center justify-center border border-purple-200/50 shadow-sm">
                            <ClipboardCheck className="h-5 w-5 text-purple-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card className={cn(
                    "border shadow-sm bg-white dark:bg-slate-950 rounded-xl overflow-hidden",
                    stats.progress === 100 ? "border-l-4 border-l-green-500" : "border-l-4 border-l-blue-500"
                )}>
                    <CardContent className="py-4 px-6 flex items-center justify-between">
                        <div className="flex-1 mr-4">
                            <p className="text-[12px] font-bold text-muted-foreground/60">Overall Completion</p>
                            <div className="flex items-center gap-3 mt-0.5">
                                <h2 className="text-2xl font-extrabold tracking-tight">{stats.progress}%</h2>
                                <div className="flex-1 max-w-[120px] h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className={cn("h-full transition-all duration-500", stats.progress === 100 ? "bg-green-500" : "bg-blue-500")}
                                        style={{ width: `${stats.progress}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className={cn(
                            "h-10 w-10 rounded-xl flex items-center justify-center border shadow-sm",
                            stats.progress === 100 ? "bg-green-50/50 border-green-100" : "bg-blue-50/50 border-blue-100"
                        )}>
                            {stats.progress === 100 ? (
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : (
                                <Clock className="h-5 w-5 text-blue-500" />
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Visibility Label */}
            <div className="flex items-center">
                {isRftGuest ? (
                    <Badge variant="outline" className="bg-orange-50/80 text-orange-700 border-orange-200 shadow-sm flex items-center gap-1.5 px-3 py-1 font-semibold tracking-tight">
                        <Globe className="h-3.5 w-3.5 opacity-70" />
                        RFT Project — My requests only (Source Member)
                    </Badge>
                ) : (
                    <Badge variant="outline" className="bg-blue-50/80 text-blue-700 border-blue-200 shadow-sm flex items-center gap-1.5 px-3 py-1 font-semibold tracking-tight">
                        <Globe className="h-3.5 w-3.5 text-blue-500/70" />
                        RFT Project — Full visibility (Target Team)
                    </Badge>
                )}
            </div>

            {/* Filtering Bar */}
            <Card className="shadow-sm overflow-hidden">
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0 pb-6 pt-7 px-7">
                    <div className="space-y-1">
                        <CardTitle className="text-2xl font-bold text-foreground/90 tracking-tight">RFT Project Tasks</CardTitle>
                        <CardDescription className="text-xs font-semibold text-muted-foreground/50 tracking-normal capitalize">
                            All tasks belonging to the RFT infrastructure
                        </CardDescription>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[124px] h-9 bg-white dark:bg-muted/10 border-muted-foreground/20 text-[11px] font-bold shadow-sm rounded-lg">
                                <SelectValue placeholder="All Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="assigned">Assigned</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="overdue">Overdue</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                            <SelectTrigger className="w-[124px] h-9 bg-white dark:bg-muted/10 border-muted-foreground/20 text-[11px] font-bold shadow-sm rounded-lg">
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

                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-[124px] h-9 bg-white dark:bg-muted/10 border-muted-foreground/20 text-[11px] font-bold shadow-sm rounded-lg">
                                <SelectValue placeholder="All Types" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="recurring">Recurring</SelectItem>
                                <SelectItem value="one-off">One-off</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                            <SelectTrigger className="w-[144px] h-9 bg-white dark:bg-muted/10 border-muted-foreground/20 text-[11px] font-bold shadow-sm rounded-lg">
                                <SelectValue placeholder="All Members" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Members</SelectItem>
                                {activeMembers.map(user => (
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
                                className="text-[10px] font-bold h-8 uppercase text-muted-foreground/60 hover:text-primary transition-all"
                            >
                                Clear
                            </Button>
                        )}
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    {filteredTasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                            <div className="w-14 h-14 rounded-full bg-slate-50 dark:bg-slate-900/10 flex items-center justify-center mb-4 border border-slate-100 dark:border-slate-800">
                                <CheckCircle2 className="h-7 w-7 text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold">No tasks found</h3>
                            <p className="text-sm max-w-sm mt-1 font-medium text-muted-foreground/60">
                                Try adjusting your filters or check other tabs.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-[#F9FAFB] dark:bg-muted/10 border-b border-muted/50">
                                        <TableHead className="w-[60px] pl-7"></TableHead>
                                        <TableHead className="text-[12px] font-extrabold tracking-widest text-[#94A3B8] h-14">Task</TableHead>
                                        <TableHead className="text-[12px] font-extrabold tracking-widest text-[#94A3B8] h-14">Assignee</TableHead>
                                        <TableHead className="text-[12px] font-extrabold tracking-widest text-[#94A3B8] h-14">Project</TableHead>
                                        <TableHead className="text-[12px] font-extrabold tracking-widest text-[#94A3B8] h-14">Type</TableHead>
                                        <TableHead className="text-[12px] font-extrabold tracking-widest text-[#94A3B8] h-14">Status</TableHead>
                                        <TableHead className="text-[12px] font-extrabold tracking-widest text-[#94A3B8] h-14">Priority</TableHead>
                                        <TableHead className="text-[12px] font-extrabold tracking-widest text-[#94A3B8] h-14">Reporter</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredTasks.map((task) => {
                                        const project = projects.find(p => p.id === task.projectId)
                                        const assignee = users.find(u => u.id === task.assignedUserId)
                                        const reporter = users.find(u => u.id === task.reporter)
                                        const isCompleted = task.status === 'completed'

                                        const dueDate = task.dueDate ? startOfDay(new Date(task.dueDate)) : null
                                        const isOverdue = dueDate && dueDate < today && !isCompleted
                                        const overdueDays = isOverdue ? Math.abs(differenceInDays(dueDate, today)) : 0

                                        return (
                                            <TableRow key={task.id} className={cn(
                                                "hover:bg-[#F8FAFC] dark:hover:bg-muted/5 border-muted/20 transition-colors h-[72px]",
                                                isOverdue && "bg-orange-50/40 dark:bg-orange-900/10",
                                                isCompleted && "bg-[#F8FAFC]/50 opacity-80"
                                            )}>
                                                <TableCell className="pl-7">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className={cn(
                                                            "h-6 w-6 rounded-full shrink-0 border-2 transition-all duration-300",
                                                            isCompleted ? "border-green-500 bg-green-500 text-white" : "border-slate-200 text-transparent"
                                                        )}
                                                        onClick={() => onStatusChange(task.id, isCompleted ? 'in_progress' : 'completed')}
                                                    >
                                                        {isCompleted && <CheckCircle2 className="h-4 w-4" />}
                                                    </Button>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <Link
                                                            href={`/workspaces/${workspaceId}/projects/${task.projectId}?taskId=${task.id}`}
                                                            className="cursor-pointer group"
                                                        >
                                                            <span className={cn(
                                                                "text-sm font-medium text-foreground/80 group-hover:text-primary transition-colors block mb-0.5 leading-snug",
                                                                isCompleted && "line-through decoration-slate-400 text-muted-foreground"
                                                            )}>
                                                                {task.title}
                                                            </span>
                                                            <div className="text-[10px] font-medium text-muted-foreground/40 tracking-tight">
                                                                | {format(task.dueDate ? new Date(task.dueDate) : new Date(), 'dd/MM/yyyy')}
                                                            </div>
                                                        </Link>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-[10px] font-medium text-[#475569] uppercase tracking-tight">
                                                        {assignee?.name || task.assignedToName || 'UNASSIGNED'}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    {project ? (
                                                        <Badge variant="outline" className="font-medium text-[9px] bg-white border-muted px-3 py-1 rounded-full text-muted-foreground uppercase tracking-tight">
                                                            {project.name}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="secondary"
                                                        className={cn(
                                                            "text-[10px] font-medium px-3 py-1 rounded-full uppercase shadow-none",
                                                            task.metadata?.isRecurring
                                                                ? "bg-purple-50 text-purple-600 border-purple-100"
                                                                : "bg-slate-50 text-slate-600 border-slate-100"
                                                        )}
                                                    >
                                                        {task.metadata?.isRecurring ? 'Recurring' : 'One-off'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        {isOverdue ? (
                                                            <span className="text-[10px] font-medium text-[#EF4444]">
                                                                {overdueDays} {overdueDays === 1 ? 'day' : 'days'} overdue
                                                            </span>
                                                        ) : (
                                                            <Badge
                                                                variant="outline"
                                                                className={cn(
                                                                    "text-[9px] font-medium px-2.5 py-0.5 rounded-full uppercase w-fit",
                                                                    task.status === 'in_progress' && "border-blue-200 text-blue-600 bg-blue-50/50",
                                                                    task.status === 'on_hold' && "border-orange-200 text-orange-600 bg-orange-50/50",
                                                                    task.status === 'completed' && "border-green-200 text-green-600 bg-green-50/50",
                                                                    task.status === 'assigned' && "border-slate-200 text-slate-600 bg-slate-50"
                                                                )}
                                                            >
                                                                {task.status?.replace('_', ' ')}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className={cn(
                                                        "text-[10px] font-medium",
                                                        task.priority === 'urgent' && "text-red-600",
                                                        task.priority === 'high' && "text-orange-600",
                                                        task.priority === 'medium' && "text-slate-600",
                                                        task.priority === 'low' && "text-slate-400"
                                                    )}>
                                                        {task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : 'Medium'}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-[10px] font-medium text-[#1E293B] uppercase tracking-tight">
                                                        {reporter?.name || task.reporterName || 'SYSTEM'}
                                                    </span>
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
