'use client'

import { useMemo, useState } from 'react'
import { format, isSameDay, isToday } from 'date-fns'
import { formatISODate, getUTCNormalizedDate } from '@/lib/utils/date-utils'
import { cn } from '@/lib/utils'
import { CalendarTaskItem, MoreTasksIndicator } from './CalendarTaskItem'
import { QuickAddForm } from './QuickAddForm'
import { Plus } from 'lucide-react'
import type { GeneratedTask } from '@/types/task-template-schema'
import type { UseCalendarStateReturn } from './useCalendarState'

// ============================================================================
// Types
// ============================================================================

interface CalendarWeekViewProps {
    calendarState: UseCalendarStateReturn
    tasks: GeneratedTask[]
    projectId: string
    onTaskClick: (task: GeneratedTask) => void
    onQuickAddSubmit: (title: string, dueDate: string) => Promise<void>
}

// ============================================================================
// Component
// ============================================================================

export function CalendarWeekView({
    calendarState,
    tasks,
    projectId,
    onTaskClick,
    onQuickAddSubmit,
}: CalendarWeekViewProps) {
    const {
        calendarDays,
        filters,
        quickAddDate,
        openQuickAdd,
        closeQuickAdd,
        gridColumns,
    } = calendarState

    const [quickAddOpenDay, setQuickAddOpenDay] = useState<Date | null>(null)

    // ============================================================================
    // Filter and Group Tasks
    // ============================================================================

    const tasksByDate = useMemo(() => {
        const grouped = new Map<string, GeneratedTask[]>()
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        tasks.forEach((task) => {
            // Apply filters
            if (filters.search) {
                const searchLower = filters.search.toLowerCase()
                const matchesSearch =
                    task.title?.toLowerCase().includes(searchLower) ||
                    task.description?.toLowerCase().includes(searchLower)
                if (!matchesSearch) return
            }
            if (!filters.showCompleted && task.status === 'completed') {
                return
            }

            if (task.dueDate) {
                const dueDate = getUTCNormalizedDate(task.dueDate)
                if (!dueDate) return

                // Determine start date: use startDate if available, otherwise use today
                const startDate = task.startDate
                    ? getUTCNormalizedDate(task.startDate)
                    : getUTCNormalizedDate(today)

                if (!startDate) return

                // If startDate is after dueDate, just show on dueDate (single day)
                const effectiveStart = startDate.getTime() > dueDate.getTime() ? dueDate : startDate

                // Add task to all dates from effectiveStart to dueDate
                const currentDate = new Date(effectiveStart)
                while (currentDate.getTime() <= dueDate.getTime()) {
                    const dateKey = formatISODate(currentDate)
                    if (!grouped.has(dateKey)) {
                        grouped.set(dateKey, [])
                    }
                    grouped.get(dateKey)!.push(task)

                    // Move to next day
                    currentDate.setDate(currentDate.getDate() + 1)
                }
            }
        })

        return grouped
    }, [tasks, filters])

    const getTasksForDate = (date: Date): GeneratedTask[] => {
        const dateKey = format(date, 'yyyy-MM-dd')
        return tasksByDate.get(dateKey) || []
    }

    // ============================================================================
    // Handlers
    // ============================================================================

    const handleOpenQuickAdd = (date: Date) => {
        setQuickAddOpenDay(date)
        openQuickAdd(date)
    }

    const handleCloseQuickAdd = () => {
        setQuickAddOpenDay(null)
        closeQuickAdd()
    }

    // ============================================================================
    // Render
    // ============================================================================

    return (
        <div
            className="bg-card border rounded-lg shadow-sm overflow-hidden"
            data-testid="week-view"
        >
            {/* ================================================================== */}
            {/* Day Columns Grid */}
            {/* ================================================================== */}
            <div
                className="grid divide-x divide-border/50"
                style={{ gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }}
            >
                {calendarDays.map((date) => {
                    const dateKey = formatISODate(date)
                    const dayTasks = getTasksForDate(date)
                    const isDateToday = isToday(date)
                    const isQuickAddOpen = quickAddOpenDay ? isSameDay(date, quickAddOpenDay) : false
                    const visibleTasks = dayTasks
                    const hiddenCount = 0

                    return (
                        <div
                            key={dateKey}
                            className={cn(
                                'flex flex-col min-h-[500px] overflow-hidden',
                                isDateToday && 'bg-primary/5'
                            )}
                        >
                            {/* Day Header */}
                            <div className={cn(
                                'sticky top-0 z-10 px-2 py-3 border-b bg-muted/30',
                                isDateToday && 'bg-primary/10'
                            )}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className={cn(
                                            'text-sm font-medium',
                                            isDateToday && 'text-primary font-bold'
                                        )}>
                                            {format(date, 'EEE')}
                                        </span>
                                        <span className={cn(
                                            'text-lg font-semibold',
                                            isDateToday
                                                ? 'bg-primary text-primary-foreground w-7 h-7 rounded-full flex items-center justify-center text-sm'
                                                : 'text-foreground'
                                        )}>
                                            {format(date, 'd')}
                                        </span>
                                    </div>

                                    {/* Add button */}
                                    <button
                                        onClick={() => handleOpenQuickAdd(date)}
                                        className={cn(
                                            'w-6 h-6 flex items-center justify-center rounded',
                                            'text-muted-foreground hover:text-foreground hover:bg-accent',
                                            'opacity-0 group-hover:opacity-100 transition-opacity',
                                            'focus:opacity-100'
                                        )}
                                        title="Add task"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Tasks Area - Click anywhere to add */}
                            <div
                                className="flex-1 p-2 space-y-1 group cursor-pointer overflow-y-auto scrollbar-thin"
                                onClick={(e) => {
                                    // Only trigger if clicking on the container itself, not on a task
                                    if (e.target === e.currentTarget && !isQuickAddOpen) {
                                        handleOpenQuickAdd(date)
                                    }
                                }}
                            >
                                {/* Quick Add Form */}
                                {isQuickAddOpen && (
                                    <div className="mb-2" onClick={(e) => e.stopPropagation()}>
                                        <QuickAddForm
                                            date={date}
                                            projectId={projectId}
                                            onSubmit={async (title, dueDate) => {
                                                await onQuickAddSubmit(title, dueDate)
                                                handleCloseQuickAdd()
                                            }}
                                            onCancel={handleCloseQuickAdd}
                                        />
                                    </div>
                                )}

                                {/* Task List */}
                                {visibleTasks.map((task) => (
                                    <div key={task.id} onClick={(e) => e.stopPropagation()}>
                                        <CalendarTaskItem
                                            task={task}
                                            onClick={onTaskClick}
                                            compact={false}
                                        />
                                    </div>
                                ))}

                                {/* More tasks indicator */}
                                {hiddenCount > 0 && (
                                    <div onClick={(e) => e.stopPropagation()}>
                                        <MoreTasksIndicator
                                            count={hiddenCount}
                                            onClick={() => console.log('Show all tasks for', dateKey)}
                                        />
                                    </div>
                                )}

                                {/* Add task hint - visible when column has tasks */}
                                {dayTasks.length > 0 && !isQuickAddOpen && (
                                    <div
                                        className={cn(
                                            'flex items-center justify-center py-2 mt-2',
                                            'text-muted-foreground/40 hover:text-muted-foreground',
                                            'hover:bg-muted/30 rounded transition-colors text-xs'
                                        )}
                                    >
                                        <Plus className="h-3 w-3 mr-1" />
                                        <span>Add task</span>
                                    </div>
                                )}

                                {/* Empty state - large add button */}
                                {dayTasks.length === 0 && !isQuickAddOpen && (
                                    <div
                                        className={cn(
                                            'w-full py-8 flex items-center justify-center',
                                            'text-muted-foreground/50 hover:text-muted-foreground',
                                            'hover:bg-muted/30 rounded transition-colors'
                                        )}
                                    >
                                        <Plus className="h-5 w-5 mr-1" />
                                        <span className="text-sm">Add task</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
