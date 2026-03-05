'use client'

import { useMemo, useState } from 'react'
import { format, isToday } from 'date-fns'
import { formatISODate } from '@/lib/utils/date-utils'
import { cn } from '@/lib/utils'
import { CalendarTaskItem } from './CalendarTaskItem'
import { QuickAddForm } from './QuickAddForm'
import { Plus, Clock, Calendar, CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { GeneratedTask } from '@/types/task-template-schema'
import type { UseCalendarStateReturn } from './useCalendarState'

// ============================================================================
// Types
// ============================================================================

interface CalendarDayViewProps {
    calendarState: UseCalendarStateReturn
    tasks: GeneratedTask[]
    projectId: string
    onTaskClick: (task: GeneratedTask) => void
    onQuickAddSubmit: (title: string, dueDate: string) => Promise<void>
}

// ============================================================================
// Component
// ============================================================================

export function CalendarDayView({
    calendarState,
    tasks,
    projectId,
    onTaskClick,
    onQuickAddSubmit,
}: CalendarDayViewProps) {
    const {
        currentDate,
        filters,
    } = calendarState

    const [showQuickAdd, setShowQuickAdd] = useState(false)
    const isDateToday = isToday(currentDate)

    // ============================================================================
    // Filter Tasks for Current Day
    // ============================================================================

    const dayTasks = useMemo(() => {
        const currentDateKey = formatISODate(currentDate)

        return tasks.filter((task) => {
            // Must be for this day
            if (!task.dueDate) return false
            const taskDateKey = formatISODate(task.dueDate)
            if (taskDateKey !== currentDateKey) return false

            // Apply filters
            if (filters.search) {
                const searchLower = filters.search.toLowerCase()
                const matchesSearch =
                    task.title?.toLowerCase().includes(searchLower) ||
                    task.description?.toLowerCase().includes(searchLower)
                if (!matchesSearch) return false
            }
            if (!filters.showCompleted && task.status === 'completed') {
                return false
            }
            return true
        })
    }, [tasks, currentDate, filters])

    // Group tasks by status for better organization
    const tasksByStatus = useMemo(() => {
        const grouped = {
            assigned: [] as GeneratedTask[],
            in_progress: [] as GeneratedTask[],
            completed: [] as GeneratedTask[],
            other: [] as GeneratedTask[],
        }

        dayTasks.forEach(task => {
            if (task.status === 'assigned') grouped.assigned.push(task)
            else if (task.status === 'in_progress') grouped.in_progress.push(task)
            else if (task.status === 'completed') grouped.completed.push(task)
            else grouped.other.push(task)
        })

        return grouped
    }, [dayTasks])

    // ============================================================================
    // Render
    // ============================================================================

    return (
        <div
            className="bg-card border rounded-lg shadow-sm overflow-hidden"
            data-testid="day-view"
        >
            {/* ================================================================== */}
            {/* Day Header */}
            {/* ================================================================== */}
            <div className={cn(
                'p-6 border-b',
                isDateToday ? 'bg-primary/5' : 'bg-muted/30'
            )}>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-muted-foreground" />
                            <h2 className="text-2xl font-bold">
                                {format(currentDate, 'EEEE')}
                            </h2>
                            {isDateToday && (
                                <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                                    Today
                                </span>
                            )}
                        </div>
                        <p className="text-muted-foreground mt-1">
                            {format(currentDate, 'MMMM d, yyyy')}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Task count */}
                        <div className="text-right">
                            <div className="text-2xl font-bold text-foreground">
                                {dayTasks.length}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {dayTasks.length === 1 ? 'task' : 'tasks'} scheduled
                            </div>
                        </div>

                        {/* Quick add button */}
                        <Button
                            onClick={() => setShowQuickAdd(true)}
                            size="sm"
                            className="gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            Add Task
                        </Button>
                    </div>
                </div>

                {/* Quick Add Form */}
                {showQuickAdd && (
                    <div className="mt-4 max-w-md">
                        <QuickAddForm
                            date={currentDate}
                            projectId={projectId}
                            onSubmit={async (title, dueDate) => {
                                await onQuickAddSubmit(title, dueDate)
                                setShowQuickAdd(false)
                            }}
                            onCancel={() => setShowQuickAdd(false)}
                        />
                    </div>
                )}
            </div>

            {/* ================================================================== */}
            {/* Tasks Overview by Status */}
            {/* ================================================================== */}
            <div className="border-b">
                <div className="grid grid-cols-3 divide-x">
                    {/* To Do */}
                    <div className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <Circle className="h-4 w-4 text-blue-500" />
                            <span className="text-2xl font-bold text-blue-600">
                                {tasksByStatus.assigned.length}
                            </span>
                        </div>
                        <div className="text-xs text-muted-foreground font-medium">To Do</div>
                    </div>

                    {/* In Progress */}
                    <div className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <Loader2 className="h-4 w-4 text-amber-500" />
                            <span className="text-2xl font-bold text-amber-600">
                                {tasksByStatus.in_progress.length}
                            </span>
                        </div>
                        <div className="text-xs text-muted-foreground font-medium">In Progress</div>
                    </div>

                    {/* Completed */}
                    <div className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="text-2xl font-bold text-green-600">
                                {tasksByStatus.completed.length}
                            </span>
                        </div>
                        <div className="text-xs text-muted-foreground font-medium">Completed</div>
                    </div>
                </div>
            </div>

            {/* ================================================================== */}
            {/* Task List */}
            {/* ================================================================== */}
            <ScrollArea className="h-[400px]">
                <div className="p-4 space-y-4">
                    {/* Empty state */}
                    {dayTasks.length === 0 && (
                        <div className="text-center py-12">
                            <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                            <h3 className="text-lg font-medium text-muted-foreground">
                                No tasks for this day
                            </h3>
                            <p className="text-sm text-muted-foreground/70 mt-1">
                                Click "Add Task" to schedule something
                            </p>
                        </div>
                    )}

                    {/* To Do Tasks */}
                    {tasksByStatus.assigned.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-blue-600 mb-2 flex items-center gap-2">
                                <Circle className="h-3 w-3" />
                                To Do ({tasksByStatus.assigned.length})
                            </h3>
                            <div className="space-y-2">
                                {tasksByStatus.assigned.map((task) => (
                                    <CalendarTaskItem
                                        key={task.id}
                                        task={task}
                                        onClick={onTaskClick}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* In Progress Tasks */}
                    {tasksByStatus.in_progress.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-amber-600 mb-2 flex items-center gap-2">
                                <Loader2 className="h-3 w-3" />
                                In Progress ({tasksByStatus.in_progress.length})
                            </h3>
                            <div className="space-y-2">
                                {tasksByStatus.in_progress.map((task) => (
                                    <CalendarTaskItem
                                        key={task.id}
                                        task={task}
                                        onClick={onTaskClick}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Completed Tasks */}
                    {tasksByStatus.completed.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-green-600 mb-2 flex items-center gap-2">
                                <CheckCircle2 className="h-3 w-3" />
                                Completed ({tasksByStatus.completed.length})
                            </h3>
                            <div className="space-y-2">
                                {tasksByStatus.completed.map((task) => (
                                    <CalendarTaskItem
                                        key={task.id}
                                        task={task}
                                        onClick={onTaskClick}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Other Tasks */}
                    {tasksByStatus.other.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                                <Clock className="h-3 w-3" />
                                Other ({tasksByStatus.other.length})
                            </h3>
                            <div className="space-y-2">
                                {tasksByStatus.other.map((task) => (
                                    <CalendarTaskItem
                                        key={task.id}
                                        task={task}
                                        onClick={onTaskClick}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}
