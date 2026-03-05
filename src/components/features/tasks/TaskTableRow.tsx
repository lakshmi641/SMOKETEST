'use client'

import { TableRow, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Calendar, CheckSquare } from 'lucide-react'
import { formatDate } from '@/lib/utils/date-utils'
import type { GeneratedTask } from '@/types/task-template-schema'
import { getPriorityColor, getStatusColor, isOverdue } from './utils'
import { cn } from '@/lib/utils'
import { formatTaskId } from '@/lib/utils/task-display'

interface TaskTableRowProps {
    task: GeneratedTask
    viewTab: 'assigned' | 'assigned_by_me' | 'starred' | 'boards'
    onClick: (task: GeneratedTask) => void
    userNameById: (userId?: string) => string
    userAvatarById: (userId?: string) => string | null
    taskTypes?: Array<{ id: string; name: string }>
    requirementTypes?: Array<{ id: string; name: string }>
}

export function TaskTableRow({
    task,
    viewTab,
    onClick,
    userNameById,
    userAvatarById,
    taskTypes = [],
    requirementTypes = []
}: TaskTableRowProps) {
    const isCreator = viewTab === 'assigned_by_me'

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2)
    }

    const reporterName = userNameById(task.reporter)
    const assigneeName = userNameById(task.assignedUserId)
    const reporterAvatar = userAvatarById(task.reporter)
    const assigneeAvatar = userAvatarById(task.assignedUserId)

    return (
        <TableRow
            className={cn(
                "cursor-pointer hover:bg-muted/50 transition-colors",
                isOverdue(task) && "bg-red-50/50"
            )}
            onClick={() => onClick(task)}
        >
            {viewTab === 'assigned_by_me' && (
                <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center">
                        <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                    </div>
                </TableCell>
            )}

            {/* Task Column - width controlled by table colgroup */}
            <TableCell className="min-w-0 overflow-hidden">
                <div className="flex flex-col">
                    <span className="text-xs font-mono text-muted-foreground mb-1">
                        {formatTaskId(task)}
                    </span>
                    <div className="flex items-center gap-2">
                        {task.metadata?.isRecurring && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] h-4 px-1.5 uppercase font-bold shrink-0">
                                Rec
                            </Badge>
                        )}
                        <span className="font-medium text-sm line-clamp-1">{task.title}</span>

                    </div>
                </div>
            </TableCell>

            {/* Project Column */}
            <TableCell>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 transition-colors">
                    {task.projectName || 'Internal'}
                </Badge>
            </TableCell>

            {/* Reporter/Assignee Column */}
            <TableCell>
                <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                        {viewTab === 'assigned_by_me' ? (
                            <>
                                <AvatarImage src={assigneeAvatar || undefined} />
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                    {getInitials(assigneeName)}
                                </AvatarFallback>
                            </>
                        ) : (
                            <>
                                <AvatarImage src={reporterAvatar || undefined} />
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                    {getInitials(reporterName)}
                                </AvatarFallback>
                            </>
                        )}
                    </Avatar>
                    <span className="text-sm text-muted-foreground truncate max-w-[100px]">
                        {viewTab === 'assigned_by_me' ? assigneeName : reporterName}
                        {viewTab === 'assigned_by_me' && task.assignedToName?.includes(',') && (
                            <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1 rounded-full font-bold">
                                +{task.assignedToName.split(',').length - 1}
                            </span>
                        )}
                    </span>
                </div>
            </TableCell>

            {/* Task Type Column */}
            <TableCell>
                <span className="text-sm text-muted-foreground">
                    {task.taskType
                        ? (taskTypes.find(t => t.id === task.taskType)?.name ?? task.taskType)
                        : '—'}
                </span>
            </TableCell>

            {/* Requirement Type Column */}
            <TableCell>
                <span className="text-sm text-muted-foreground">
                    {task.requirementType
                        ? (requirementTypes.find(r => r.id === task.requirementType || r.name === task.requirementType)?.name ?? task.requirementType)
                        : '—'}
                </span>
            </TableCell>

            {/* Workspace Column */}
            <TableCell>
                <span className="text-sm text-muted-foreground">
                    {(task as any).workspaceName || '-'}
                </span>
            </TableCell>

            {/* Priority Column */}
            <TableCell>
                <Badge className={cn("capitalize font-normal", getPriorityColor(task.priority))}>
                    {task.priority || 'medium'}
                </Badge>
            </TableCell>

            {/* Status Column */}
            <TableCell>
                <Badge className={cn("capitalize font-normal", getStatusColor(task.status))}>
                    {task.status.replace('_', ' ')}
                </Badge>
            </TableCell>

            {/* Due Date Column */}
            <TableCell className="whitespace-nowrap">
                <div className={cn(
                    "flex items-center gap-1.5 text-xs",
                    isOverdue(task) ? "text-red-600 font-medium" : "text-muted-foreground"
                )}>
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(task.dueDate)}
                </div>
            </TableCell>
        </TableRow>
    )
}
