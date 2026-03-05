'use client'

/**
 * Recurring Task Card Component
 * Displays a single recurring task configuration with actions
 */

import React from 'react'
import { Calendar, Clock, User, AlertTriangle, MoreVertical, Play, Edit, Archive, Repeat, CheckCircle2, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
import { WorkspaceRecurringConfig, RecurringConfigVersion } from '@/types/recurring-task-schema'
import { format, parseISO } from 'date-fns'
import * as RecurringTaskService from '@/lib/services/recurring-tasks/recurring-task-service'
import toast from 'react-hot-toast'
import { History, CheckCircle2 as CheckCircleIcon } from 'lucide-react'

interface RecurringTaskCardProps {
    config: WorkspaceRecurringConfig
    users?: { id: string; name: string; position?: string; positionId?: string; positionName?: string }[]
    onEdit?: (config: WorkspaceRecurringConfig) => void
    onView?: (config: WorkspaceRecurringConfig) => void
    onToggle?: (config: WorkspaceRecurringConfig) => void
    onArchive?: (config: WorkspaceRecurringConfig) => void
    onUnarchive?: (config: WorkspaceRecurringConfig) => void
    onRunNow?: (config: WorkspaceRecurringConfig) => void
    onDelete?: (config: WorkspaceRecurringConfig) => void
    onResolveGhost?: (config: WorkspaceRecurringConfig) => void
    projects?: { id: string; name: string; projectCode?: string }[]
}

export function RecurringTaskCard({
    config,
    users = [],
    onEdit,
    onView,
    onToggle,
    onArchive,
    onUnarchive,
    onRunNow,
    onDelete,
    onResolveGhost,
    projects = [],
}: RecurringTaskCardProps) {
    const [showHistory, setShowHistory] = React.useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)
    const [versions, setVersions] = React.useState<RecurringConfigVersion[]>([])
    const [isLoadingHistory, setIsLoadingHistory] = React.useState(false)

    const isGhosted = config.status === 'ghosted'
    const isPaused = !config.isActive || config.status === 'paused'

    // Find assignee name
    const assigneeName = React.useMemo(() => {
        if (config.assignment.type === 'position') {
            return config.assignment.positionName || 'Position'
        }
        const user = users.find(u => u.id === config.assignment.value)
        return user ? user.name : 'Unknown User'
    }, [config.assignment, users])

    // Find project info
    const projectInfo = React.useMemo(() => {
        const project = projects.find(p => p.id === config.projectId)
        return project ? { name: project.name, code: project.projectCode } : null
    }, [config.projectId, projects])

    // Get color for priority
    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'critical': return 'bg-red-100 text-red-800 border-red-200'
            case 'high': return 'bg-orange-100 text-orange-800 border-orange-200'
            case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
            case 'low': return 'bg-green-100 text-green-800 border-green-200'
            default: return 'bg-gray-100 text-gray-800 border-gray-200'
        }
    }

    // Format schedule text
    const getScheduleText = () => {
        const { frequency } = config.schedule
        return frequency.charAt(0).toUpperCase() + frequency.slice(1)
    }

    const nextRunText = React.useMemo(() => {
        try {
            return format(parseISO(config.nextRunAt), 'MMM d, yyyy h:mm a')
        } catch {
            return 'Invalid date'
        }
    }, [config.nextRunAt])

    const fetchHistory = async () => {
        setIsLoadingHistory(true)
        try {
            const history = await RecurringTaskService.getConfigVersions(
                config.id,
                config.companyId,
                config.createdBy
            )
            setVersions(history)
            setShowHistory(true)
        } catch (error) {
            toast.error('Failed to fetch version history')
        } finally {
            setIsLoadingHistory(false)
        }
    }

    const lifecycleText = React.useMemo(() => {
        const { endCondition, startDate } = config.schedule
        let text = ''

        // Start Date
        if (startDate) {
            const start = parseISO(startDate)
            if (start > new Date()) {
                text = `Starts ${format(start, 'MMM d, yyyy')}`
            }
        }

        // End Condition
        if (endCondition.type === 'on_date' && endCondition.endDate) {
            text = text ? `${text} • Ends ${format(parseISO(endCondition.endDate), 'MMM d, yyyy')}` : `Ends on ${format(parseISO(endCondition.endDate), 'MMM d, yyyy')}`
            return text
        }
        if (endCondition.type === 'after_count' && endCondition.occurrenceCount) {
            text = text ? `${text} • Ends after ${endCondition.occurrenceCount} tasks` : `Ends after ${endCondition.occurrenceCount} tasks`
            return text
        }

        return text || null
    }, [config.schedule, config.runCount])

    return (
        <>
            <Card className={`group transition-all hover:border-primary/50 shadow-sm overflow-hidden ${isGhosted ? 'border-red-200 bg-red-50/30' : ''}`}>
                <CardContent className="p-0">
                    <div className="flex flex-col sm:flex-row sm:items-center p-4 gap-4">
                        {/* Main Content Area */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1">
                                {config.isActive && config.status === 'active' && (
                                    <div className="relative flex h-2 w-2">
                                        <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></div>
                                        <div className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></div>
                                    </div>
                                )}
                                <div className={`p-1.5 rounded-md ${config.isActive && config.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-primary/10 text-primary'}`}>
                                    <Repeat className="h-4 w-4" />
                                </div>
                                <h3
                                    className="text-base font-semibold truncate text-gray-900 cursor-pointer hover:text-primary hover:underline underline-offset-4 decoration-primary/30"
                                    onClick={() => onView?.(config)}
                                >
                                    {config.taskDefinition.title}
                                </h3>
                                {config.status === 'archived' && <Badge variant="outline" className="text-[10px] px-1.5 h-4 uppercase border-gray-300 bg-gray-50 text-gray-500">Archived</Badge>}
                                {isPaused && config.status !== 'archived' && <Badge variant="secondary" className="text-[10px] px-1.5 h-4 uppercase font-semibold">Paused</Badge>}
                                {isGhosted && <Badge variant="destructive" className="text-[10px] px-1.5 h-4 uppercase font-bold tracking-tight">Ghosted</Badge>}
                                {projectInfo && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 h-4 bg-muted/30 font-mono">
                                        {projectInfo.code || projectInfo.name.substring(0, 3).toUpperCase()}
                                    </Badge>
                                )}
                            </div>

                            <p className="text-sm text-gray-500 line-clamp-1 mb-3">
                                {config.taskDefinition.description || 'No description provided'}
                            </p>

                            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                                <div className="flex items-center gap-1.5 py-1 px-2 rounded-md bg-gray-50">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span>Due: {getScheduleText()}</span>
                                </div>
                                <div className="flex items-center gap-1.5 py-1 px-2 rounded-md bg-gray-50">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>Next run: {nextRunText}</span>
                                </div>
                                <div className="flex items-center gap-1.5 py-1 px-2 rounded-md bg-blue-50/50 text-blue-700">
                                    <User className="h-3.5 w-3.5" />
                                    <span className="font-medium">{assigneeName}</span>
                                </div>
                                {lifecycleText && (
                                    <div className="flex items-center gap-1.5 py-1 px-2 rounded-md bg-orange-50 text-orange-700 border border-orange-100">
                                        <AlertTriangle className="h-3.5 w-3.5" />
                                        <span>{lifecycleText}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2 mt-3">
                                <Badge className={`${getPriorityColor(config.taskDefinition.priority)} text-[10px] px-2 py-0 h-5 border`}>
                                    {config.taskDefinition.priority}
                                </Badge>
                                <Button
                                    variant="ghost"
                                    className="h-5 p-0 hover:bg-transparent"
                                    onClick={fetchHistory}
                                    disabled={isLoadingHistory}
                                >
                                    <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 border text-primary bg-primary/5 hover:bg-primary/10 cursor-pointer">
                                        v{(config.currentVersion || 1) - 1} {isLoadingHistory ? '...' : ''}
                                    </Badge>
                                </Button>
                            </div>
                        </div>

                        {/* Actions Area */}
                        <div className="flex items-center justify-end gap-2 sm:pl-4 sm:border-l">
                            {onRunNow && !isGhosted && (() => {
                                const today = new Date().toISOString().split('T')[0]
                                const lastRunDate = config.lastRunAt ? config.lastRunAt.split('T')[0] : null
                                const alreadyRunToday = lastRunDate === today

                                return (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={alreadyRunToday}
                                        onClick={() => onRunNow(config)}
                                        className={`h-8 gap-1.5 text-xs border-none font-semibold px-3 ${alreadyRunToday
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            : 'bg-yellow-400 text-black hover:bg-yellow-500'
                                            }`}
                                    >
                                        {alreadyRunToday ? (
                                            <>
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                Run Completed
                                            </>
                                        ) : (
                                            <>
                                                <Play className="h-3.5 w-3.5 fill-current" />
                                                Run Now
                                            </>
                                        )}
                                    </Button>
                                )
                            })()}

                            {isGhosted && onResolveGhost && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onResolveGhost(config)}
                                    className="h-8 gap-1.5 text-xs bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200 font-semibold"
                                >
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    Resolve
                                </Button>
                            )}

                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500" onClick={() => onEdit?.(config)}>
                                    <Edit className="h-3.5 w-3.5" />
                                </Button>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500">
                                            <MoreVertical className="h-3.5 w-3.5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48 z-[9999]">
                                        <DropdownMenuItem onClick={() => onEdit?.(config)}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            Edit Config
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={fetchHistory}>
                                            <History className="mr-2 h-4 w-4" />
                                            View History
                                        </DropdownMenuItem>
                                        {config.status !== 'archived' && (
                                            <DropdownMenuItem onClick={() => onToggle?.(config)}>
                                                <Repeat className="mr-2 h-4 w-4" />
                                                {config.isActive ? 'Pause Schedule' : 'Resume Schedule'}
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuSeparator />
                                        {config.status === 'archived' ? (
                                            <DropdownMenuItem onClick={() => onUnarchive?.(config)} className="text-green-600">
                                                <Repeat className="mr-2 h-4 w-4" />
                                                Unarchive Config
                                            </DropdownMenuItem>
                                        ) : (
                                            <DropdownMenuItem onClick={() => onArchive?.(config)} className="text-red-600">
                                                <Archive className="mr-2 h-4 w-4" />
                                                Archive Config
                                            </DropdownMenuItem>
                                        )}
                                        {onDelete && (
                                            <>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => setShowDeleteConfirm(true)}
                                                    className="text-destructive focus:text-destructive font-semibold"
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete Permanently
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    </div>

                    {/* Ghost Task Banner - Sub-area */}
                    {isGhosted && (
                        <div className="px-4 py-2 bg-red-100/50 border-t border-red-100 flex items-center gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                            <span className="text-[11px] text-red-700 font-medium">
                                {config.ghostReason === 'position_vacant' ? 'No users assigned to this position' :
                                    config.ghostReason === 'user_inactive' ? 'Assigned user is inactive' :
                                        'Assignment issue detected'}
                            </span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Delete Confirmation Dialog */}
            <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            Delete Recurring Task
                        </DialogTitle>
                        <DialogDescription className="pt-2">
                            This will permanently delete the recurring task configuration <strong>"{config.taskDefinition.title}"</strong>,
                            its version history, and execution logs.
                            <br /><br />
                            Generated tasks scheduled for the future will not be created. Existing tasks already generated will not be affected.
                            <br /><br />
                            <strong>This action cannot be undone.</strong>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                setShowDeleteConfirm(false)
                                onDelete?.(config)
                            }}
                        >
                            Delete Permanently
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Version History Dialog */}
            <Dialog open={showHistory} onOpenChange={setShowHistory}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto z-[9999]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <History className="h-5 w-5 text-primary" />
                            Version History: {config.taskDefinition.title}
                        </DialogTitle>
                        <DialogDescription>
                            Audit trail of configuration changes and updates.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 mt-6">
                        {versions.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                                <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>No history records found.</p>
                            </div>
                        ) : (
                            versions.map((v, idx) => {
                                const isInitial = idx === versions.length - 1
                                const changedFields = v.changedFields || []
                                const hasAssignmentChange = changedFields.some(f => f.includes('assignment'))
                                const hasScheduleChange = changedFields.some(f => f.includes('schedule'))
                                const hasDefinitionChange = changedFields.some(f => f.includes('taskDefinition'))
                                const hasProjectChange = changedFields.includes('projectId')

                                const assignment = v.snapshot?.assignment
                                const prevVersion = versions[idx + 1]
                                const isRealAssignmentChange = isInitial || (
                                    hasAssignmentChange &&
                                    prevVersion?.snapshot?.assignment?.value !== assignment?.value
                                )

                                // Determine primary label
                                let primaryLabel = 'Configuration Update'
                                if (isInitial) primaryLabel = 'Recurring Task Created'
                                else if (hasAssignmentChange && !hasScheduleChange && !hasDefinitionChange) primaryLabel = 'Assignment Updated'
                                else if (hasScheduleChange && !hasAssignmentChange && !hasDefinitionChange) primaryLabel = 'Schedule Updated'
                                else if (hasDefinitionChange && !hasAssignmentChange && !hasScheduleChange) primaryLabel = 'Task Details Updated'
                                else if (changedFields.length > 0) primaryLabel = 'Multiple Changes'

                                // Derive Assignment Text
                                let assignmentText = ''
                                if (assignment) {
                                    if (assignment.type === 'position') {
                                        assignmentText = `Position: ${assignment.positionName || 'Unknown Position'}`
                                    } else if (assignment.type === 'specific_user') {
                                        const userName = users.find(u => u.id === assignment.value)?.name || 'Unknown User'
                                        assignmentText = `User: ${userName}`
                                    }
                                }

                                return (
                                    <div key={v.id} className="relative pl-8 pb-8 border-l last:pb-0 group">
                                        <div className={`absolute left-[-9px] top-0 h-4 w-4 rounded-full border-2 border-background ${hasAssignmentChange ? 'bg-blue-500' : 'bg-gray-300'}`} />

                                        <div className="flex flex-col gap-2">
                                            {/* Header Row */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant={hasAssignmentChange ? 'default' : 'secondary'} className="text-[10px] px-2 h-5">
                                                        v{(v.version || 1) - 1}
                                                    </Badge>
                                                    <span className="text-sm font-semibold text-gray-900">
                                                        {primaryLabel}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-muted-foreground font-mono">
                                                    {v.createdAt ? format(parseISO(v.createdAt), 'MMM d, h:mm a') : ''}
                                                </span>
                                            </div>

                                            {/* Assignment Context (Special Highlight) */}
                                            {isRealAssignmentChange && assignmentText && (
                                                <div className="bg-blue-50/50 p-3 rounded-md border border-blue-100 text-sm text-blue-800 flex items-center gap-2 mt-1">
                                                    <User className="h-4 w-4 text-blue-500" />
                                                    <span className="font-medium">
                                                        {isInitial ? 'Assigned to' : 'Reassigned to'} {assignmentText}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Other Changes Tags */}
                                            {(() => {
                                                const displayFields = changedFields.filter(f => {
                                                    // Filter out assignment fields if we already show the big banner
                                                    if (isRealAssignmentChange && f.includes('assignment')) return false

                                                    // content check for false positives
                                                    const getVal = (obj: any, path: string) => path.split('.').reduce((o: any, i: string) => o?.[i], obj)
                                                    const currentVal = getVal(v.snapshot, f)
                                                    const prevVal = prevVersion ? getVal(prevVersion.snapshot, f) : undefined

                                                    // Ignore if both are effectively empty/null for arrays/objects
                                                    if (Array.isArray(currentVal) && Array.isArray(prevVal)) {
                                                        return JSON.stringify(currentVal.sort()) !== JSON.stringify(prevVal.sort())
                                                    }
                                                    // Ignore if strictly equal (should be handled by backend, but safe to double check)
                                                    if (currentVal === prevVal) return false

                                                    return true
                                                })

                                                if (displayFields.length === 0 || isInitial) return null

                                                const FIELD_LABELS: Record<string, string> = {
                                                    'taskDefinition.title': 'Title',
                                                    'taskDefinition.description': 'Description',
                                                    'taskDefinition.priority': 'Priority',
                                                    'taskDefinition.estimatedHours': 'Est. Hours',
                                                    'schedule.frequency': 'Frequency',
                                                    'schedule.startDate': 'Start Date',
                                                    'schedule.weekDays': 'Days of Week',
                                                    'projectId': 'Project',
                                                    'isActive': 'Status'
                                                }

                                                return (
                                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                                        {displayFields.map(f => (
                                                            <span key={f} className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full border border-gray-200 font-medium capitalize">
                                                                {FIELD_LABELS[f] || f.split('.').pop()?.replace(/([A-Z])/g, ' $1').trim()}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )
                                            })()}
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                    <DialogFooter>
                        <div className="text-[10px] text-muted-foreground w-full text-center pt-4">
                            Showing partial history for this configuration.
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
