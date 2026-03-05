'use client'

import { cn } from '@/lib/utils'
import { useDraggable } from '@dnd-kit/core'
import { GripVertical, Clock, Calendar as CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import type { GeneratedTask } from '@/types/task-template-schema'
import { getStatusColors } from '@/lib/utils/task-status-colors'

// ============================================================================
// Types
// ============================================================================

interface CalendarTaskItemProps {
    task: GeneratedTask
    onClick: (task: GeneratedTask) => void
    compact?: boolean
    isDragging?: boolean
    showDate?: boolean
}

// ============================================================================
// Priority Indicator
// ============================================================================

function getPriorityIndicator(priority: GeneratedTask['priority']) {
    switch (priority) {
        case 'urgent':
            return { icon: '🔴', label: 'Urgent' }
        case 'high':
            return { icon: '🟠', label: 'High' }
        case 'medium':
            return { icon: '🟡', label: 'Medium' }
        case 'low':
            return { icon: '⚪', label: 'Low' }
        default:
            return { icon: '', label: '' }
    }
}

// ============================================================================
// Draggable Task Item
// ============================================================================

export function CalendarTaskItem({
    task,
    onClick,
    compact = false,
    isDragging = false,
    showDate = false
}: CalendarTaskItemProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging: isBeingDragged } = useDraggable({
        id: task.id,
        data: { task },
    })

    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed'

    // Override status colors if overdue
    const statusColors = isOverdue ? {
        bg: 'bg-red-50',
        bgDark: 'dark:bg-red-950/50',
        border: 'border-l-red-500',
        dot: 'bg-red-500',
        text: 'text-red-700',
        textDark: 'dark:text-red-300',
    } : getStatusColors(task.status)

    const priority = getPriorityIndicator(task.priority)
    const showPriorityIcon = task.priority === 'urgent' || task.priority === 'high'

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    } : undefined

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                'group relative',
                isBeingDragged && 'opacity-50 z-50'
            )}
        >
            <button
                onClick={(e) => {
                    e.stopPropagation()
                    onClick(task)
                }}
                className={cn(
                    'w-full text-left rounded transition-all duration-150',
                    'border-l-[3px]',
                    'hover:shadow-md',
                    'focus:outline-none focus:ring-2 focus:ring-primary/30',
                    'cursor-pointer',
                    statusColors.bg,
                    statusColors.bgDark,
                    statusColors.border,
                    compact ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm',
                    isDragging && 'shadow-lg ring-2 ring-primary',
                    'flex items-center justify-between gap-2'
                )}
                title={`${task.title}${isOverdue ? ' (Overdue)' : ''}${priority.label ? ` • ${priority.label}` : ''} (Drag to reschedule)`}
                data-testid="calendar-task-item"
            >
                <div className="flex items-center gap-1 min-w-0 flex-1">
                    {/* Drag handle */}
                    <span
                        {...attributes}
                        {...listeners}
                        className={cn(
                            'flex-shrink-0 cursor-grab active:cursor-grabbing touch-none',
                            'text-muted-foreground/40 hover:text-muted-foreground',
                            'opacity-0 group-hover:opacity-100 transition-opacity',
                            compact ? 'mr-0' : 'mr-0.5'
                        )}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <GripVertical className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
                    </span>

                    {/* Status dot or Overdue Icon */}
                    {isOverdue ? (
                        <span className="flex-shrink-0 text-red-500 mr-0.5">
                            <Clock className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
                        </span>
                    ) : (
                        <span
                            className={cn(
                                'flex-shrink-0 rounded-full',
                                statusColors.dot,
                                compact ? 'w-1.5 h-1.5' : 'w-2 h-2'
                            )}
                        />
                    )}

                    {/* Task title */}
                    <span className={cn(
                        'truncate font-medium',
                        compact ? 'text-xs' : 'text-sm',
                        statusColors.text,
                        statusColors.textDark
                    )}>
                        {task.title}
                    </span>

                    {/* Priority indicator (for urgent/high only) */}
                    {showPriorityIcon && (
                        <span
                            className="flex-shrink-0 text-[10px]"
                            title={priority.label}
                        >
                            {priority.icon}
                        </span>
                    )}
                </div>

                {/* User Avatar & Dates */}
                <div className="flex items-center gap-2 shrink-0">
                    {showDate && (
                        <div className="flex flex-col items-end text-[10px] text-muted-foreground mr-1">
                            <span className="flex items-center gap-1">
                                <span>{task.startDate ? format(new Date(task.startDate), 'MMM d') : 'No start'}</span>
                                <span>-</span>
                                <span>{task.dueDate ? format(new Date(task.dueDate), 'MMM d') : 'No end'}</span>
                            </span>
                        </div>
                    )}
                    {!compact && task.assignedUserId && (
                        <div
                            className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold border border-primary/20"
                            title="Assigned User"
                        >
                            U
                        </div>
                    )}
                </div>
            </button>
        </div>
    )
}

// ============================================================================
// Skeleton Component
// ============================================================================

export function CalendarTaskItemSkeleton() {
    return (
        <div
            className="w-full h-6 bg-muted/50 rounded animate-pulse"
            data-testid="calendar-task-skeleton"
        />
    )
}

// ============================================================================
// More Tasks Indicator
// ============================================================================

interface MoreTasksProps {
    count: number
    onClick?: () => void
}

export function MoreTasksIndicator({ count }: MoreTasksProps) {
    return (
        <button
            type="button"
            className={cn(
                'w-full text-left px-1.5 py-0.5',
                'text-xs font-medium text-muted-foreground',
                'hover:text-foreground hover:bg-muted/50 rounded',
                'transition-colors cursor-pointer'
            )}
            data-testid="more-tasks-indicator"
        >
            +{count} more
        </button>
    )
}
