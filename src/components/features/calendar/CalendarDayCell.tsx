'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { format, isToday, isSameDay } from 'date-fns'
import { Plus } from 'lucide-react'
import { CalendarTaskItem, MoreTasksIndicator } from './CalendarTaskItem'
import { QuickAddForm } from './QuickAddForm'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { GeneratedTask } from '@/types/task-template-schema'
import type { ViewMode } from './useCalendarState'

// ============================================================================
// Types
// ============================================================================

interface CalendarDayCellProps {
    date: Date
    isCurrentMonth: boolean
    isSelected: boolean
    tasks: GeneratedTask[]
    projectId: string
    isQuickAddOpen: boolean
    onCellClick: (date: Date) => void
    onTaskClick: (task: GeneratedTask) => void
    onQuickAddSubmit: (title: string, dueDate: string) => Promise<void>
    onQuickAddCancel: () => void
    viewMode: ViewMode
    lanesCount: number
}

// ============================================================================
// Component
// ============================================================================

export function CalendarDayCell({
    date,
    isCurrentMonth,
    isSelected,
    tasks,
    projectId,
    isQuickAddOpen,
    onCellClick,
    onTaskClick,
    onQuickAddSubmit,
    onQuickAddCancel,
    viewMode,
    lanesCount,
}: CalendarDayCellProps) {
    const dayNumber = format(date, 'd')
    const isDateToday = isToday(date)
    const isWeekend = date.getDay() === 0 || date.getDay() === 6

    // Calculate max visible tasks based on view mode
    const maxVisibleTasks = useMemo(() => {
        // Reserve space for spanning bars
        const capacity = viewMode === 'week' ? 6 : 4
        return Math.max(1, capacity - lanesCount)
    }, [viewMode, lanesCount])

    const visibleTasks = useMemo(() => tasks.slice(0, maxVisibleTasks), [tasks, maxVisibleTasks])
    const hiddenCount = tasks.length > maxVisibleTasks ? tasks.length - maxVisibleTasks : 0

    // Calculate min height based on view mode
    const cellHeight = useMemo(() => {
        switch (viewMode) {
            case 'week':
                return 'min-h-[180px]'
            default:
                return 'min-h-[80px]' // Compact but enough for date + 1-2 tasks
        }
    }, [viewMode])

    const handleCellClick = (e: React.MouseEvent) => {
        // Only trigger quick add if clicking on empty space (not on a task)
        const target = e.target as HTMLElement
        if (!target.closest('button') && !target.closest('.quick-add-form')) {
            onCellClick(date)
        }
    }

    return (
        <div
            className={cn(
                'flex flex-col border-r border-b border-border/50 transition-all relative group',
                cellHeight,
                // Background colors
                isCurrentMonth ? 'bg-card' : 'bg-muted/30',
                isWeekend && isCurrentMonth && 'bg-muted/20',
                // Hover state
                !isQuickAddOpen && 'hover:bg-accent/20',
                // Selected state
                isSelected && 'ring-2 ring-inset ring-primary/40 bg-primary/5'
            )}
            onClick={handleCellClick}
            data-testid={isDateToday ? 'today-cell' : 'day-cell'}
        >
            {/* ================================================================== */}
            {/* Date Header */}
            {/* ================================================================== */}
            <div className="flex items-center justify-between px-1.5 py-1">
                <span
                    className={cn(
                        'text-sm font-medium flex items-center justify-center transition-all',
                        'w-7 h-7 rounded-full',
                        // Today highlight
                        isDateToday && 'bg-primary text-primary-foreground font-bold shadow-sm',
                        // Out of month
                        !isCurrentMonth && !isDateToday && 'text-muted-foreground/50',
                        // Current month (not today)
                        isCurrentMonth && !isDateToday && 'text-foreground'
                    )}
                >
                    {dayNumber}
                </span>

                {/* Plus button (shows on hover) */}
                {!isQuickAddOpen && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onCellClick(date)
                        }}
                        className={cn(
                            'w-6 h-6 flex items-center justify-center rounded-md',
                            'text-muted-foreground hover:text-foreground',
                            'hover:bg-accent transition-all',
                            'opacity-0 group-hover:opacity-100',
                            'focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary/30'
                        )}
                        title="Add task"
                        data-testid="add-task-button"
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* ================================================================== */}
            {/* Tasks Container - NO LONGER SCROLLABLE */}
            {/* ================================================================== */}
            <div className={cn(
                "flex-1 px-1 py-0.5 space-y-0.5",
                "min-h-0"
            )}>
                {/* Reserved space for multi-day spanning bars */}
                {lanesCount > 0 && (
                    <div
                        style={{ height: `${lanesCount * 28}px` }}
                        className="w-full shrink-0 pointer-events-none"
                    />
                )}
                {/* Quick Add Form */}
                {isQuickAddOpen && (
                    <QuickAddForm
                        date={date}
                        projectId={projectId}
                        onSubmit={onQuickAddSubmit}
                        onCancel={onQuickAddCancel}
                    />
                )}

                {/* Task Items */}
                {visibleTasks.map((task) => (
                    <CalendarTaskItem
                        key={task.id}
                        task={task}
                        onClick={onTaskClick}
                        compact={viewMode === 'month'}
                    />
                ))}

                {/* More tasks indicator with Popover */}
                {hiddenCount > 0 && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <div>
                                <MoreTasksIndicator
                                    count={hiddenCount}
                                />
                            </div>
                        </PopoverTrigger>
                        <PopoverContent
                            className="w-80 p-0 shadow-2xl border-primary/10"
                            align="start"
                            side="right"
                        >
                            <div className="p-3 border-b bg-muted/30">
                                <h4 className="font-semibold text-sm flex items-center justify-between">
                                    <span>{format(date, 'EEEE, d MMM')}</span>
                                    <span className="text-xs text-muted-foreground font-normal">
                                        {tasks.length} tasks
                                    </span>
                                </h4>
                            </div>
                            <div className="p-1 space-y-1 max-h-[300px] overflow-y-auto scrollbar-thin">
                                {tasks.map((task) => (
                                    <CalendarTaskItem
                                        key={task.id}
                                        task={task}
                                        onClick={onTaskClick}
                                        compact={false}
                                        showDate={true}
                                    />
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>
                )}
            </div>
        </div>
    )
}
