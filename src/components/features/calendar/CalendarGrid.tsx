'use client'

import { useMemo, useState } from 'react'
import { format, isSameDay, startOfWeek, addDays } from 'date-fns'
import { formatISODate } from '@/lib/utils/date-utils'
import { cn } from '@/lib/utils'
import {
    DndContext,
    DragOverlay,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent,
    DragOverEvent,
} from '@dnd-kit/core'
import { CalendarDayCell } from './CalendarDayCell'
import { CalendarTaskItem } from './CalendarTaskItem'
import { CalendarSpanningBars } from './CalendarSpanningBars'
import type { GeneratedTask } from '@/types/task-template-schema'
import type { UseCalendarStateReturn } from './useCalendarState'
import { calculateWeekBars, normalizeDate } from './calendar-utils'

// ============================================================================
// Types
// ============================================================================

interface CalendarGridProps {
    calendarState: UseCalendarStateReturn
    tasks: GeneratedTask[]
    projectId: string
    onTaskClick: (task: GeneratedTask) => void
    onQuickAddSubmit: (title: string, dueDate: string) => Promise<void>
    onTaskDrop?: (taskId: string, newDueDate: string) => Promise<void>
}

// ============================================================================
// Constants (now dynamic from settings)
// ============================================================================

// ============================================================================
// Component
// ============================================================================

export function CalendarGrid({
    calendarState,
    tasks,
    projectId,
    onTaskClick,
    onQuickAddSubmit,
    onTaskDrop,
}: CalendarGridProps) {
    const {
        calendarDays,
        viewMode,
        quickAddDate,
        openQuickAdd,
        closeQuickAdd,
        isCurrentMonth,
        selectedDate,
        filters,
        weekdayLabels,
        gridColumns,
        settings,
    } = calendarState

    // ============================================================================
    // Drag and Drop State
    // ============================================================================

    const [activeTask, setActiveTask] = useState<GeneratedTask | null>(null)
    const [overId, setOverId] = useState<string | null>(null)

    // Sensors for better drag UX
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // 8px movement required before drag starts
            },
        })
    )

    // ============================================================================
    // Filtered Tasks
    // ============================================================================

    const filteredTasks = useMemo(() => {
        return tasks.filter((task) => {
            // Search filter
            if (filters.search) {
                const searchLower = filters.search.toLowerCase()
                const matchesSearch =
                    task.title?.toLowerCase().includes(searchLower) ||
                    task.description?.toLowerCase().includes(searchLower)
                if (!matchesSearch) return false
            }

            // Show completed filter
            if (!filters.showCompleted && task.status === 'completed') {
                return false
            }

            return true
        })
    }, [tasks, filters])

    // ============================================================================
    // Separate Multi-day and Single-day Tasks
    // ============================================================================

    const { multiDayTasks, singleDayTasks } = useMemo(() => {
        const multiDay: GeneratedTask[] = []
        const singleDay: GeneratedTask[] = []
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        filteredTasks.forEach((task) => {
            if (!task.dueDate) return

            const dueDate = normalizeDate(task.dueDate)

            // Multi-day task: has startDate and it's different from dueDate
            if (task.startDate) {
                const start = normalizeDate(task.startDate)
                if (start.getTime() !== dueDate.getTime()) {
                    multiDay.push(task)
                    return
                }
            } else {
                // If no startDate but has dueDate, use today as start date
                // Only make it multi-day if today is before dueDate
                if (today.getTime() < dueDate.getTime()) {
                    multiDay.push(task)
                    return
                }
            }

            // Single-day task
            singleDay.push(task)
        })

        return { multiDayTasks: multiDay, singleDayTasks: singleDay }
    }, [filteredTasks])

    // ============================================================================
    // Group Single-day Tasks by Date (for day cells)
    // ============================================================================

    const tasksByDate = useMemo(() => {
        const grouped = new Map<string, GeneratedTask[]>()

        singleDayTasks.forEach((task) => {
            if (task.dueDate) {
                const dateKey = formatISODate(task.dueDate)
                if (!grouped.has(dateKey)) {
                    grouped.set(dateKey, [])
                }
                grouped.get(dateKey)!.push(task)
            }
        })

        return grouped
    }, [singleDayTasks])

    // ============================================================================
    // Group Calendar Days into Weeks
    // ============================================================================

    const weeks = useMemo(() => {
        const result: Date[][] = []
        for (let i = 0; i < calendarDays.length; i += gridColumns) {
            result.push(calendarDays.slice(i, i + gridColumns))
        }
        return result
    }, [calendarDays, gridColumns])

    // ============================================================================
    // Get Tasks for a Specific Date
    // ============================================================================

    const getTasksForDate = (date: Date): GeneratedTask[] => {
        const dateKey = formatISODate(date)
        return tasksByDate.get(dateKey) || []
    }

    // ============================================================================
    // Handle Cell Click
    // ============================================================================

    const handleCellClick = (date: Date) => {
        // If quick add is open on a different date, close it
        if (quickAddDate && !isSameDay(quickAddDate, date)) {
            closeQuickAdd()
        }

        // Open quick add for this date
        openQuickAdd(date)
    }

    // ============================================================================
    // Drag and Drop Handlers
    // ============================================================================

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event
        const taskId = active.id as string
        const task = tasks.find(t => t.id === taskId)
        if (task) {
            setActiveTask(task)
        }
    }

    const handleDragOver = (event: DragOverEvent) => {
        const { over } = event
        setOverId(over?.id as string | null)
    }

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event

        setActiveTask(null)
        setOverId(null)

        if (!over || !onTaskDrop) return

        const taskId = active.id as string
        const dropDateStr = over.id as string // format: 'drop-2024-12-15'

        // Extract date from drop zone id
        if (dropDateStr.startsWith('drop-')) {
            const newDueDate = dropDateStr.replace('drop-', '')
            const task = tasks.find(t => t.id === taskId)

            // Only update if dropping on a different date
            if (task && task.dueDate) {
                const currentDate = formatISODate(task.dueDate)
                if (currentDate !== newDueDate) {
                    await onTaskDrop(taskId, newDueDate)
                }
            }
        }
    }

    const handleDragCancel = () => {
        setActiveTask(null)
        setOverId(null)
    }

    // ============================================================================
    // Render
    // ============================================================================

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
        >
            <div
                className="flex-1 flex flex-col bg-card border rounded-lg shadow-sm overflow-hidden min-h-0 h-full"
                data-testid="calendar-grid"
            >
                {/* ================================================================== */}
                {/* Weekday Headers */}
                {/* ================================================================== */}
                <div
                    className="grid bg-muted/50 border-b"
                    style={{ gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }}
                    role="row"
                >
                    {weekdayLabels.map((day, index) => (
                        <div
                            key={day}
                            className={cn(
                                'py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide',
                                'border-r border-border/50 last:border-r-0',
                                settings.showWeekends && (index === 5 || index === 6) && 'text-muted-foreground/60'
                            )}
                            role="columnheader"
                        >
                            {day}
                        </div>
                    ))}
                </div>

                {/* ================================================================== */}
                {/* Calendar Grid with Spanning Bars - COMPACT ROW HEIGHT */}
                {/* ================================================================== */}
                <div className="flex-1 overflow-y-auto min-h-0 scrollbar-ultrathin">
                    {weeks.map((weekDays, weekIndex) => {
                        // Calculate how many lanes are actually needed for this week
                        const { lanesCount } = calculateWeekBars(multiDayTasks, weekDays, gridColumns)

                        const MAX_SPANNING_LANES = 3
                        const clampedLanesCount = Math.min(lanesCount, MAX_SPANNING_LANES)

                        const laneHeight = 28 // h-6 (24px) + gap (4px)
                        const spanningBarsHeight = clampedLanesCount * laneHeight
                        const minCellHeight = 120 // Base min height for day cells

                        return (
                            <div
                                key={`week-${weekIndex}`}
                                className="relative border-b border-border/50 last:border-b-0 min-h-[40px]"
                            >
                                {/* Day Cells Row */}
                                <div
                                    className="grid"
                                    style={{ gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }}
                                    role="row"
                                >
                                    {weekDays.map((date, dayIndex) => {
                                        const isQuickAddOpen = quickAddDate ? isSameDay(date, quickAddDate) : false
                                        const dateKey = formatISODate(date)
                                        const isDropTarget = overId === `drop-${dateKey}`

                                        return (
                                            <DroppableDayCell
                                                key={`${dateKey}-${weekIndex}-${dayIndex}`}
                                                date={date}
                                                dateKey={dateKey}
                                                isCurrentMonth={isCurrentMonth(date)}
                                                isSelected={selectedDate ? isSameDay(date, selectedDate) : false}
                                                isDropTarget={isDropTarget}
                                                tasks={getTasksForDate(date)}
                                                projectId={projectId}
                                                isQuickAddOpen={isQuickAddOpen}
                                                onCellClick={handleCellClick}
                                                onTaskClick={onTaskClick}
                                                onQuickAddSubmit={onQuickAddSubmit}
                                                onQuickAddCancel={closeQuickAdd}
                                                viewMode={viewMode}
                                                lanesCount={clampedLanesCount}
                                            />
                                        )
                                    })}
                                </div>

                                {/* Multi-day Spanning Bars - positioned absolutely below date header */}
                                <div className="absolute top-8 left-0 right-0 z-10 pointer-events-none">
                                    <div className="pointer-events-auto">
                                        <CalendarSpanningBars
                                            tasks={multiDayTasks}
                                            weekDays={weekDays}
                                            gridColumns={gridColumns}
                                            onTaskClick={onTaskClick}
                                        />
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Drag Overlay - Shows task being dragged */}
            <DragOverlay>
                {activeTask && (
                    <div className="opacity-80 shadow-lg rounded-md">
                        <CalendarTaskItem
                            task={activeTask}
                            onClick={() => { }}
                            compact
                            isDragging
                        />
                    </div>
                )}
            </DragOverlay>
        </DndContext>
    )
}

// ============================================================================
// Droppable Day Cell Wrapper
// ============================================================================

import { useDroppable } from '@dnd-kit/core'
import type { ViewMode } from './useCalendarState'

interface DroppableDayCellProps {
    date: Date
    dateKey: string
    isCurrentMonth: boolean
    isSelected: boolean
    isDropTarget: boolean
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

function DroppableDayCell({
    date,
    dateKey,
    isCurrentMonth,
    isSelected,
    isDropTarget,
    tasks,
    projectId,
    isQuickAddOpen,
    onCellClick,
    onTaskClick,
    onQuickAddSubmit,
    onQuickAddCancel,
    viewMode,
    lanesCount,
}: DroppableDayCellProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: `drop-${dateKey}`,
    })

    return (
        <div
            ref={setNodeRef}
            className={cn(
                'relative',
                (isOver || isDropTarget) && 'ring-2 ring-inset ring-primary bg-primary/10'
            )}
        >
            <CalendarDayCell
                date={date}
                isCurrentMonth={isCurrentMonth}
                isSelected={isSelected}
                tasks={tasks}
                projectId={projectId}
                isQuickAddOpen={isQuickAddOpen}
                onCellClick={onCellClick}
                onTaskClick={onTaskClick}
                onQuickAddSubmit={onQuickAddSubmit}
                onQuickAddCancel={onQuickAddCancel}
                viewMode={viewMode}
                lanesCount={lanesCount}
            />
        </div>
    )
}
