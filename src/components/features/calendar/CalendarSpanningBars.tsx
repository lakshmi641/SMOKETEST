'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { GeneratedTask } from '@/types/task-template-schema'
import { getStatusColors } from '@/lib/utils/task-status-colors'
import { calculateWeekBars } from './calendar-utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarTaskItem } from './CalendarTaskItem'
import { format } from 'date-fns'

// ============================================================================
// Types
// ============================================================================

interface CalendarSpanningBarsProps {
    tasks: GeneratedTask[]
    weekDays: Date[]  // Array of 7 dates for this week
    gridColumns: number
    onTaskClick: (task: GeneratedTask) => void
}

// ============================================================================
// Component
// ============================================================================

export function CalendarSpanningBars({
    tasks,
    weekDays,
    gridColumns,
    onTaskClick,
}: CalendarSpanningBarsProps) {

    // Calculate multi-day task positions for this week using shared utility
    const { multiDayTasks, totalLanes, MAX_LANES } = useMemo(() => {
        const { bars, lanesCount } = calculateWeekBars(tasks, weekDays, gridColumns)
        const MAX = 3
        return {
            multiDayTasks: bars,
            totalLanes: lanesCount,
            MAX_LANES: MAX
        }
    }, [tasks, weekDays, gridColumns])

    if (multiDayTasks.length === 0) return null

    const showSummaryBar = totalLanes > MAX_LANES
    const visibleBars = showSummaryBar
        ? multiDayTasks.filter(bar => bar.row < MAX_LANES - 1)
        : multiDayTasks

    const hiddenTasksCount = totalLanes - (MAX_LANES - 1) // Approx, based on lanes
    // Better hidden count calculation: count tasks that are not in visibleBars
    const hiddenTasks = multiDayTasks.filter(item => item.row >= (showSummaryBar ? MAX_LANES - 1 : MAX_LANES))

    return (
        <div className="relative w-full">
            {visibleBars.map((item, idx) => {
                const statusColors = getStatusColors(item.task.status)
                const colors = `${statusColors.barBg} ${statusColors.barBorder} ${statusColors.barText}`
                const rowOffset = item.row * 28 // 24px height + 4px gap

                return (
                    <div
                        key={`${item.task.id}-${idx}`}
                        className={cn(
                            'absolute h-6 px-2 text-xs font-medium truncate cursor-pointer',
                            'border flex items-center gap-1',
                            'hover:opacity-80 transition-opacity',
                            colors,
                            // Rounded corners based on position
                            item.isStart ? 'rounded-l-md' : 'border-l-0',
                            item.isEnd ? 'rounded-r-md' : 'border-r-0'
                        )}
                        style={{
                            top: `${rowOffset}px`,
                            left: `calc(${(item.startCol / gridColumns) * 100}%)`,
                            width: `calc(${(item.span / gridColumns) * 100}%)`,
                        }}
                        onClick={(e) => {
                            e.stopPropagation()
                            onTaskClick(item.task)
                        }}
                        title={item.task.title}
                    >
                        <span className="truncate">{item.task.title}</span>
                        {!item.isEnd && (
                            <span className="ml-auto text-xs opacity-60">→</span>
                        )}
                    </div>
                )
            })}

            {/* Summary Bar for Hidden Multi-day Tasks */}
            {showSummaryBar && (
                <Popover>
                    <PopoverTrigger asChild>
                        <div
                            className={cn(
                                'absolute h-6 px-2 text-xs font-medium cursor-pointer',
                                'bg-muted/50 border border-muted-foreground/20 text-muted-foreground',
                                'hover:bg-muted hover:text-foreground transition-all rounded-md shadow-sm',
                                'flex items-center justify-center z-20'
                            )}
                            style={{
                                top: `${(MAX_LANES - 1) * 28}px`,
                                left: '4px',
                                right: '4px'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            +{hiddenTasks.length} more multi-day tasks this week
                        </div>
                    </PopoverTrigger>
                    <PopoverContent
                        className="w-80 p-0 shadow-2xl border-primary/10"
                        align="center"
                        side="bottom"
                    >
                        <div className="p-3 border-b bg-muted/30">
                            <h4 className="font-semibold text-sm flex items-center justify-between">
                                <span>Multi-day Tasks</span>
                                <span className="text-xs text-muted-foreground font-normal">
                                    Week of {format(weekDays[0]!, 'MMM d')}
                                </span>
                            </h4>
                        </div>
                        <div className="p-1 space-y-1 max-h-[300px] overflow-y-auto scrollbar-thin">
                            {hiddenTasks.map((item, idx) => (
                                <CalendarTaskItem
                                    key={`${item.task.id}-hidden-${idx}`}
                                    task={item.task}
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
    )
}
