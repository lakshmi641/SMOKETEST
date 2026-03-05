'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Activity,
    CheckCircle,
    XCircle,
    Clock,
    User,
    MessageSquare,
    Shield,
    AlertTriangle,
    ArrowUpRight,
    Play,
    Pause,
    Flag,
    RefreshCw,
    Bell,
    UserCheck,
    Zap,
    Pencil,
} from 'lucide-react'
import {
    getTaskActivities,
    subscribeToTaskActivities,
} from '@/lib/services/task-activity-service'
import type {
    TaskActivity,
    TaskActivityCategory,
} from '@/types/task-activity-schema'
import { cn } from '@/lib/utils'

interface TaskActivityTimelineProps {
    companyId: string
    taskId: string
    groupId?: string | null
    className?: string
    maxHeight?: string
    realtime?: boolean
}

export function TaskActivityTimeline({
    companyId,
    taskId,
    groupId,
    className,
    maxHeight = '500px',
    realtime = true,
}: TaskActivityTimelineProps) {
    const [activities, setActivities] = useState<TaskActivity[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<TaskActivityCategory | 'all'>('all')

    useEffect(() => {
        if (!companyId || !taskId) return

        if (realtime) {
            // Real-time subscription
            const unsubscribe = subscribeToTaskActivities(companyId, taskId, (newActivities) => {
                setActivities(newActivities)
                setLoading(false)
            }, groupId ?? undefined)

            return () => unsubscribe()
        } else {
            // One-time fetch
            loadActivities()
        }
    }, [companyId, taskId, groupId, realtime])

    const loadActivities = async () => {
        setLoading(true)
        try {
            const data = await getTaskActivities(companyId, taskId, undefined, groupId ?? undefined)
            setActivities(data)
        } catch (error) {
            console.error('Error loading activities:', error)
        } finally {
            setLoading(false)
        }
    }

    // Apply category filter (task_created now shows with proper description)
    const filteredActivities = filter === 'all'
        ? activities
        : activities.filter(a => a.category === filter)

    if (loading) {
        return (
            <Card className={className}>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        Activity Timeline
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="flex gap-3">
                                <Skeleton className="h-8 w-8 rounded-full" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-3 w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className={className}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        Activity Timeline
                        {realtime && (
                            <Badge variant="outline" className="text-[10px] h-4">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1 animate-pulse" />
                                Live
                            </Badge>
                        )}
                    </CardTitle>
                    {!realtime && (
                        <Button variant="ghost" size="sm" onClick={loadActivities}>
                            <RefreshCw className="w-4 h-4" />
                        </Button>
                    )}
                </div>

                {/* Category Filter */}
                <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="mt-2">
                    <TabsList className="h-8">
                        <TabsTrigger value="all" className="text-xs px-2 h-6">All</TabsTrigger>
                        <TabsTrigger value="lifecycle" className="text-xs px-2 h-6">Lifecycle</TabsTrigger>
                        <TabsTrigger value="approval" className="text-xs px-2 h-6">Approval</TabsTrigger>
                        <TabsTrigger value="escalation" className="text-xs px-2 h-6">Escalation</TabsTrigger>
                        <TabsTrigger value="comment" className="text-xs px-2 h-6">Comments</TabsTrigger>
                    </TabsList>
                </Tabs>
            </CardHeader>

            <CardContent>
                <ScrollArea style={{ maxHeight }} className="pr-4">
                    {filteredActivities.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No activities yet</p>
                        </div>
                    ) : (
                        <div className="relative pl-6 space-y-0">
                            {/* Timeline line */}
                            <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-border" />

                            {filteredActivities.map((activity, index) => (
                                <ActivityItem
                                    key={activity.id}
                                    activity={activity}
                                    isFirst={index === 0}
                                    isLast={index === filteredActivities.length - 1}
                                />
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    )
}

// ============================================================================
// ACTIVITY ITEM
// ============================================================================

function ActivityItem({
    activity,
    isFirst,
    isLast,
}: {
    activity: TaskActivity
    isFirst: boolean
    isLast: boolean
}) {
    const { icon, bgColor, textColor } = getActivityStyle(activity)

    return (
        <div className={cn("relative pb-4", isLast && "pb-0")}>
            {/* Timeline dot */}
            <div className={cn(
                "absolute -left-[19px] w-4 h-4 rounded-full border-2 border-background flex items-center justify-center z-10",
                bgColor
            )}>
                {icon}
            </div>

            {/* Content */}
            <div className="ml-2">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("font-medium text-sm", textColor)}>{activity.actorName}</span>
                    <span className="text-sm text-muted-foreground">
                        {/* For system approvals, show simplified description */}
                        {(() => {
                            // Check multiple indicators for reporter approval
                            const isReporterApproval = activity.approvalData?.isSystemApproval ||
                                activity.approvalData?.workflowId === '__SYSTEM_REPORTER_APPROVAL__' ||
                                activity.approvalData?.stageName === 'Reporter Review' ||
                                activity.description?.includes('Reporter Review')

                            if (isReporterApproval && activity.type === 'approval_decision') {
                                // Determine decision from approvalData or parse from description
                                const decision = activity.approvalData?.decision ||
                                    (activity.description?.includes('APPROVED') ? 'approved' : 'rejected')
                                return decision === 'approved'
                                    ? 'approved the task'
                                    : 'rejected the task'
                            }
                            return activity.description
                        })()}
                    </span>
                </div>

                {/* APPROVAL PROGRESSION DETAILS */}
                {activity.approvalData && (
                    <ApprovalActivityDetails
                        data={activity.approvalData}
                        type={activity.type}
                        isSystemApproval={
                            activity.approvalData.isSystemApproval ||
                            activity.approvalData.workflowId === '__SYSTEM_REPORTER_APPROVAL__' ||
                            activity.approvalData.stageName === 'Reporter Review'
                        }
                    />
                )}

                {/* ESCALATION PROGRESSION DETAILS */}
                {activity.escalationData && (
                    <EscalationActivityDetails data={activity.escalationData} type={activity.type} />
                )}

                {/* Comment preview */}
                {activity.commentData?.commentText && (
                    <p className="mt-1 text-sm text-muted-foreground italic border-l-2 border-muted pl-2">
                        "{activity.commentData.commentText}"
                    </p>
                )}

                {/* Status changes */}
                {activity.changes && activity.changes.length > 0 && (
                    <div className="mt-1 text-sm text-muted-foreground">
                        {activity.changes.map((change, i) => (
                            <span key={i} className="inline-flex items-center gap-1">
                                <Badge variant="outline" className="text-[10px] h-4">{change.oldValue as string}</Badge>
                                <ArrowUpRight className="w-3 h-3" />
                                <Badge variant="secondary" className="text-[10px] h-4">{change.newValue as string}</Badge>
                            </span>
                        ))}
                    </div>
                )}

                <p className="mt-1 text-xs text-muted-foreground">
                    {formatActivityTime(activity.createdAt)}
                </p>
            </div>
        </div>
    )
}

// ============================================================================
// APPROVAL ACTIVITY DETAILS
// ============================================================================

function ApprovalActivityDetails({
    data,
    type,
    isSystemApproval,
}: {
    data: TaskActivity['approvalData']
    type: TaskActivity['type']
    isSystemApproval?: boolean
}) {
    if (!data) return null

    // For system approvals (Reporter Approval), show simplified view
    if (isSystemApproval) {
        return (
            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-sm border border-blue-100 dark:border-blue-900">
                {/* Decision Badge */}
                <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                        Reporter Approval
                    </Badge>
                    {data.decision && (
                        <Badge variant={data.decision === 'approved' ? 'default' : 'destructive'} className="text-xs">
                            {data.decision === 'approved' ? (
                                <><CheckCircle className="w-3 h-3 mr-1" /> Approved</>
                            ) : (
                                <><XCircle className="w-3 h-3 mr-1" /> Rejected</>
                            )}
                        </Badge>
                    )}
                </div>

                {/* Comments */}
                {data.comments && (
                    <p className="mt-2 text-muted-foreground italic border-l-2 border-blue-300 pl-2">
                        "{data.comments}"
                    </p>
                )}
            </div>
        )
    }

    return (
        <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-sm border border-blue-100 dark:border-blue-900">
            {/* Progress Bar */}
            {data.totalStages > 0 && data.currentStageNumber > 0 && (
                <div className="mb-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Stage {data.currentStageNumber} of {data.totalStages}</span>
                        <span className="text-blue-600 dark:text-blue-400">{data.workflowName}</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                            className={cn(
                                "h-1.5 rounded-full transition-all duration-500",
                                data.decision === 'rejected' ? 'bg-red-500' : 'bg-blue-500'
                            )}
                            style={{
                                width: `${(data.currentStageNumber / data.totalStages) * 100}%`
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Stage Info */}
            <div className="flex items-center gap-2 flex-wrap">
                {data.stageName && (
                    <Badge variant="secondary" className="text-xs">
                        {data.stageName}
                    </Badge>
                )}
                {data.decision && (
                    <Badge variant={data.decision === 'approved' ? 'default' : 'destructive'} className="text-xs">
                        {data.decision === 'approved' ? (
                            <><CheckCircle className="w-3 h-3 mr-1" /> Approved</>
                        ) : (
                            <><XCircle className="w-3 h-3 mr-1" /> Rejected</>
                        )}
                    </Badge>
                )}
            </div>

            {/* Pending Approver */}
            {data.pendingApproverName && !data.decision && (
                <div className="mt-2 flex items-center gap-2 text-muted-foreground">
                    <User className="w-3 h-3" />
                    <span>Pending: </span>
                    <span className="font-medium text-foreground">{data.pendingApproverName}</span>
                    {data.pendingApproverPosition && (
                        <span className="text-xs">({data.pendingApproverPosition})</span>
                    )}
                </div>
            )}

            {/* Comments */}
            {data.comments && (
                <p className="mt-2 text-muted-foreground italic border-l-2 border-blue-300 pl-2">
                    "{data.comments}"
                </p>
            )}

            {/* Time in stage */}
            {data.timeInStage && (
                <p className="mt-1 text-xs text-muted-foreground">
                    Time in stage: {formatDuration(data.timeInStage)}
                </p>
            )}
        </div>
    )
}

// ============================================================================
// ESCALATION ACTIVITY DETAILS
// ============================================================================

function EscalationActivityDetails({
    data,
    type,
}: {
    data: TaskActivity['escalationData']
    type: TaskActivity['type']
}) {
    if (!data) return null

    return (
        <div className="mt-2 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg text-sm border border-orange-100 dark:border-orange-900">
            {/* Progress Bar */}
            {data.totalLevels > 0 && data.currentLevelNumber > 0 && (
                <div className="mb-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Level {data.currentLevelNumber} of {data.totalLevels}</span>
                        <span className="text-orange-600 dark:text-orange-400">{data.pathName}</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                            className="h-1.5 rounded-full bg-orange-500 transition-all duration-500"
                            style={{
                                width: `${(data.currentLevelNumber / data.totalLevels) * 100}%`
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Level Info */}
            <div className="flex items-center gap-2 flex-wrap">
                {data.levelName && (
                    <Badge variant="secondary" className="text-xs">
                        {data.levelName}
                    </Badge>
                )}
                <Badge variant="outline" className="text-xs capitalize">
                    {getEscalationActionIcon(data.action)} {data.action.replace('_', ' ')}
                </Badge>
            </div>

            {/* Target User */}
            {data.targetUserName && (
                <div className="mt-2 flex items-center gap-2 text-muted-foreground">
                    <ArrowUpRight className="w-3 h-3" />
                    <span>Target: </span>
                    <span className="font-medium text-foreground">{data.targetUserName}</span>
                    {data.targetPosition && (
                        <span className="text-xs">({data.targetPosition})</span>
                    )}
                </div>
            )}

            {/* Escalation reason */}
            {data.reason && (
                <p className="mt-2 text-muted-foreground italic border-l-2 border-orange-300 pl-2">
                    {data.reason}
                </p>
            )}

            {/* Time in level */}
            {data.timeInLevel && (
                <p className="mt-1 text-xs text-muted-foreground">
                    Time in level: {formatDuration(data.timeInLevel)}
                </p>
            )}
        </div>
    )
}

// ============================================================================
// HELPERS
// ============================================================================

function getActivityStyle(activity: TaskActivity) {
    // Special icons and colors for specific activity types

    // Task Created - Blue (creation)
    if (activity.type === 'task_created') {
        return {
            icon: <Play className="w-2 h-2 text-white" />,
            bgColor: 'bg-blue-500',
            textColor: 'text-blue-700 dark:text-blue-300',
        }
    }

    // Task Started - Cyan (in progress)
    if (activity.type === 'task_started') {
        return {
            icon: <Play className="w-2 h-2 text-white" />,
            bgColor: 'bg-cyan-500',
            textColor: 'text-cyan-700 dark:text-cyan-300',
        }
    }

    // Status Changed - Indigo (status updates)
    if (activity.type === 'status_changed') {
        return {
            icon: <Flag className="w-2 h-2 text-white" />,
            bgColor: 'bg-indigo-500',
            textColor: 'text-indigo-700 dark:text-indigo-300',
        }
    }

    // Task Completed - Green (success)
    if (activity.type === 'task_completed') {
        return {
            icon: <CheckCircle className="w-2 h-2 text-white" />,
            bgColor: 'bg-green-500',
            textColor: 'text-green-700 dark:text-green-300',
        }
    }

    // Task Cancelled - Red (cancelled)
    if (activity.type === 'task_cancelled') {
        return {
            icon: <XCircle className="w-2 h-2 text-white" />,
            bgColor: 'bg-red-500',
            textColor: 'text-red-700 dark:text-red-300',
        }
    }

    // Field Changed - Amber/Yellow (modifications)
    if (activity.type === 'field_changed') {
        return {
            icon: <Pencil className="w-2 h-2 text-white" />,
            bgColor: 'bg-amber-500',
            textColor: 'text-amber-700 dark:text-amber-300',
        }
    }

    // Assignments - Purple
    if (activity.type === 'task_assigned') {
        return {
            icon: <UserCheck className="w-2 h-2 text-white" />,
            bgColor: 'bg-purple-500',
            textColor: 'text-purple-700 dark:text-purple-300',
        }
    }

    if (activity.type === 'task_reassigned') {
        return {
            icon: <UserCheck className="w-2 h-2 text-white" />,
            bgColor: 'bg-violet-500',
            textColor: 'text-violet-700 dark:text-violet-300',
        }
    }

    if (activity.type === 'task_unassigned') {
        return {
            icon: <User className="w-2 h-2 text-white" />,
            bgColor: 'bg-slate-500',
            textColor: 'text-slate-700 dark:text-slate-300',
        }
    }

    // Time Logged - Teal
    if (activity.type === 'time_logged') {
        return {
            icon: <Clock className="w-2 h-2 text-white" />,
            bgColor: 'bg-teal-500',
            textColor: 'text-teal-700 dark:text-teal-300',
        }
    }

    // Approval events
    if (activity.type === 'approval_workflow_completed') {
        return {
            icon: <CheckCircle className="w-2 h-2 text-white" />,
            bgColor: 'bg-green-500',
            textColor: 'text-green-700 dark:text-green-300',
        }
    }

    if (activity.type === 'approval_workflow_rejected') {
        return {
            icon: <XCircle className="w-2 h-2 text-white" />,
            bgColor: 'bg-red-500',
            textColor: 'text-red-700 dark:text-red-300',
        }
    }

    // Default category-based styles
    const styles: Record<TaskActivityCategory, { icon: React.ReactNode; bgColor: string; textColor: string }> = {
        lifecycle: {
            icon: <Play className="w-2 h-2 text-white" />,
            bgColor: 'bg-blue-500',
            textColor: 'text-blue-700 dark:text-blue-300',
        },
        assignment: {
            icon: <UserCheck className="w-2 h-2 text-white" />,
            bgColor: 'bg-purple-500',
            textColor: 'text-purple-700 dark:text-purple-300',
        },
        status: {
            icon: <Flag className="w-2 h-2 text-white" />,
            bgColor: 'bg-amber-500',
            textColor: 'text-amber-700 dark:text-amber-300',
        },
        approval: {
            icon: <Shield className="w-2 h-2 text-white" />,
            bgColor: 'bg-blue-500',
            textColor: 'text-blue-700 dark:text-blue-300',
        },
        escalation: {
            icon: <Zap className="w-2 h-2 text-white" />,
            bgColor: 'bg-orange-500',
            textColor: 'text-orange-700 dark:text-orange-300',
        },
        comment: {
            icon: <MessageSquare className="w-2 h-2 text-white" />,
            bgColor: 'bg-green-500',
            textColor: 'text-green-700 dark:text-green-300',
        },
    }

    return styles[activity.category] || styles.lifecycle
}

function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m`
    return `${seconds}s`
}

/**
 * Format activity timestamp based on recency
 * < 1 min → "Just now"
 * < 10 min → "X min ago"
 * ≥ 10 min → exact DD/MM/YYYY HH:mm
 */
function formatActivityTime(createdAt: string): string {
    const now = Date.now()
    const activityTime = new Date(createdAt).getTime()
    const diffMs = now - activityTime
    const diffMin = Math.floor(diffMs / 60000)

    if (diffMin < 1) return 'Just now'
    if (diffMin < 10) return `${diffMin} min ago`

    // ≥ 10 minutes → exact timestamp
    return new Date(createdAt).toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    })
}

function getEscalationActionIcon(action: string): string {
    const icons: Record<string, string> = {
        notify: '🔔',
        remind: '⏰',
        escalate: '⬆️',
        reassign: '🔄',
        auto_approve: '✅',
        auto_reject: '❌',
    }
    return icons[action] || '📋'
}

export default TaskActivityTimeline
