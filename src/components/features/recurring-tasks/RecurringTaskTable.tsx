'use client'

import * as React from "react"
import { WorkspaceRecurringConfig } from "@/types/recurring-task-schema"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import {
    Calendar,
    Clock,
    User,
    MoreHorizontal,
    Edit,
    Trash2,
    Eye,
    Repeat,
    Play,
    Network,
    History,
    PauseCircle,
    PlayCircle,
    Archive,
    RefreshCw,
    CheckCircle2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format, parseISO } from "date-fns"
import { ActionMenu, createViewAction, createEditAction, createDeleteAction, ActionMenuItem } from "@/components/ui/action-menu"

export interface RecurringTaskTableProps {
    configs: WorkspaceRecurringConfig[]
    users?: { id: string; name: string; position?: string; positionId?: string; positionName?: string }[]
    projects?: { id: string; name: string; projectCode?: string }[]
    onEdit?: (config: WorkspaceRecurringConfig) => void
    onDelete?: (config: WorkspaceRecurringConfig) => void
    onView?: (config: WorkspaceRecurringConfig) => void
    onRunNow?: (config: WorkspaceRecurringConfig) => void
    onToggle?: (config: WorkspaceRecurringConfig) => void
    onArchive?: (config: WorkspaceRecurringConfig) => void
    onUnarchive?: (config: WorkspaceRecurringConfig) => void
    className?: string
}

const getStatusColor = (status: string, isActive: boolean) => {
    if (!isActive) return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    switch (status) {
        case 'active':
            return 'bg-green-100 text-green-700 border-green-200'
        case 'ghosted':
            return 'bg-red-100 text-red-700 border-red-200'
        case 'archived':
            return 'bg-gray-100 text-gray-700 border-gray-200'
        default:
            return 'bg-muted/10 text-muted-foreground border-muted/20'
    }
}

const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
        case 'critical':
            return 'bg-red-100 text-red-700 border-red-200'
        case 'high':
            return 'bg-orange-100 text-orange-700 border-orange-200'
        case 'medium':
            return 'bg-blue-100 text-blue-700 border-blue-200'
        case 'low':
            return 'bg-green-100 text-green-700 border-green-200'
        default:
            return 'bg-muted/10 text-muted-foreground border-muted/20'
    }
}

export const RecurringTaskTable: React.FC<RecurringTaskTableProps> = ({
    configs,
    users = [],
    projects = [],
    onEdit,
    onDelete,
    onView,
    onRunNow,
    onToggle,
    onArchive,
    onUnarchive,
    className
}) => {
    return (
        <div className={cn("w-full bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col", className)}>
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-400px)] min-h-[400px] scrollbar-ultrathin">
                <Table>
                    <TableHeader className="bg-slate-50/50 sticky top-0 z-10">
                        <TableRow>
                            <TableHead className="font-bold text-slate-500 py-4 bg-slate-50/50">Task Configuration</TableHead>
                            <TableHead className="font-bold text-slate-500 bg-slate-50/50">Project</TableHead>
                            <TableHead className="font-bold text-slate-500 bg-slate-50/50">Status</TableHead>
                            <TableHead className="font-bold text-slate-500 bg-slate-50/50">Priority</TableHead>
                            <TableHead className="font-bold text-slate-500 bg-slate-50/50">Schedule</TableHead>
                            <TableHead className="font-bold text-slate-500 bg-slate-50/50">Assignee</TableHead>
                            <TableHead className="font-bold text-slate-500 bg-slate-50/50">Next Run</TableHead>
                            <TableHead className="w-[80px] text-right pr-6 bg-slate-50/50">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {configs.map((config) => {
                            const project = projects.find(p => p.id === config.projectId)
                            let assigneeName = 'System'
                            let assigneeSubtext = 'Automated'

                            if (config.assignment.type === 'specific_user') {
                                const user = users.find(u => u.id === config.assignment.value)
                                assigneeName = user?.name || 'Unknown User'
                                assigneeSubtext = user?.position || 'Employee'
                            } else if (config.assignment.type === 'position') {
                                const posId = config.assignment.value
                                const posName = (config.assignment.positionName || '').trim().toLowerCase()

                                const positionUsers = users.filter(u => {
                                    if (posId && u.positionId === posId) return true
                                    if (!posName) return false
                                    const uPos = (u.positionName || u.position || '').trim().toLowerCase()
                                    return uPos === posName
                                })

                                if (positionUsers.length > 0) {
                                    assigneeName = positionUsers[0]?.name ?? assigneeName
                                    if (positionUsers.length > 1) {
                                        assigneeName = `${positionUsers.length} Users`
                                    }
                                    assigneeSubtext = positionUsers[0]?.position || config.assignment.positionName || 'Position'
                                } else {
                                    assigneeName = 'Vacant'
                                    assigneeSubtext = config.assignment.positionName || 'Position'
                                }
                            }

                            return (
                                <TableRow key={config.id} className="hover:bg-slate-50/80 transition-colors group cursor-pointer" onClick={() => onView?.(config)}>
                                    <TableCell className="py-4">
                                        <div className="flex items-start gap-3">
                                            <div className="mt-1 h-8 w-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary border border-primary/10">
                                                <Repeat className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-slate-900 group-hover:text-primary transition-colors flex items-center gap-2">
                                                    {config.taskDefinition.title}
                                                </div>
                                                <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                                                    {config.taskDefinition.description || 'No description provided'}
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-slate-900">{project?.name || 'No Project'}</span>
                                            {project?.projectCode && (
                                                <span className="text-[10px] font-mono text-slate-500">{project.projectCode}</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn("capitalize px-2.5 py-0.5 font-semibold", getStatusColor(config.status, config.isActive))}>
                                            {config.isActive ? config.status : 'Paused'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn("capitalize px-2.5 py-0.5 font-semibold", getPriorityColor(config.taskDefinition.priority))}>
                                            {config.taskDefinition.priority}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-sm font-bold text-slate-700 capitalize">
                                                {config.schedule.frequency}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-medium">
                                                Every {config.schedule.interval} {config.schedule.frequency.replace('ly', '')}(s)
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className={cn(
                                                "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold border",
                                                config.assignment.type === 'position'
                                                    ? "bg-purple-50 text-purple-600 border-purple-100"
                                                    : "bg-slate-100 text-slate-500 border-slate-200"
                                            )}>
                                                {config.assignment.type === 'position' ? <Network className="h-3 w-3" /> : (assigneeName?.charAt(0) || 'U')}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-sm font-medium text-slate-600 truncate max-w-[120px]">
                                                    {assigneeName}
                                                </span>
                                                <span className="text-[9px] text-purple-500 font-medium uppercase tracking-wider truncate max-w-[120px]">
                                                    {assigneeSubtext}
                                                </span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5">
                                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                                            <span className="text-sm font-bold text-slate-700">
                                                {config.nextRunAt ? format(parseISO(config.nextRunAt), 'MMM d, h:mm a') : 'N/A'}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-end gap-2">
                                            {/* Run Button / Status */}
                                            {config.isActive && config.status !== 'ghosted' && (() => {
                                                const todayStr = new Date().toISOString().split('T')[0]
                                                const lastRunDate = config.lastRunAt ? config.lastRunAt.split('T')[0] : null
                                                const alreadyRunToday = lastRunDate === todayStr

                                                if (alreadyRunToday) {
                                                    return (
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            disabled
                                                            className="h-8 gap-2 bg-slate-100 text-slate-400 font-medium px-3 border border-transparent opacity-80"
                                                        >
                                                            <CheckCircle2 className="h-4 w-4" />
                                                            Run Completed
                                                        </Button>
                                                    )
                                                }

                                                if (onRunNow) {
                                                    return (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                onRunNow(config)
                                                            }}
                                                            title="Run Now"
                                                        >
                                                            <Play className="h-4 w-4" />
                                                        </Button>
                                                    )
                                                }
                                                return null
                                            })()}

                                            {/* Quick Edit Action */}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-500 hover:text-slate-800"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onEdit?.(config)
                                                }}
                                                title="Edit Configuration"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>

                                            {/* More Actions Menu */}
                                            <ActionMenu
                                                items={[
                                                    {
                                                        label: "Edit Config",
                                                        icon: <Edit className="h-4 w-4" />,
                                                        onClick: () => onEdit?.(config)
                                                    },
                                                    {
                                                        label: "View History",
                                                        icon: <History className="h-4 w-4" />,
                                                        onClick: () => onView?.(config)
                                                    },
                                                    ...(onToggle && config.status !== 'archived' ? [{
                                                        label: config.isActive ? 'Pause Schedule' : 'Resume Schedule',
                                                        icon: config.isActive ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />,
                                                        onClick: () => onToggle(config)
                                                    }] : []),
                                                    ...(onArchive && config.status !== 'archived' ? [{
                                                        label: 'Archive Config',
                                                        icon: <Archive className="h-4 w-4" />,
                                                        onClick: () => onArchive(config),
                                                        variant: "destructive" as const
                                                    }] : []),
                                                    ...(onUnarchive && config.status === 'archived' ? [{
                                                        label: 'Unarchive Config',
                                                        icon: <RefreshCw className="h-4 w-4" />,
                                                        onClick: () => onUnarchive(config)
                                                    }] : []),
                                                    createDeleteAction(() => onDelete?.(config))
                                                ]}
                                                size="sm"
                                            />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
