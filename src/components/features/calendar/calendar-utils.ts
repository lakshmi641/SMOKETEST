import { GeneratedTask } from '@/types/task-template-schema'
import { getUTCNormalizedDate } from '@/lib/utils/date-utils'

/**
 * Normalizes a date to the start of the day in a timezone-neutral way.
 */
export const normalizeDate = (date: Date | string | number): Date => {
    return getUTCNormalizedDate(date) || new Date()
}

export interface MultiDayBar {
    task: GeneratedTask
    startCol: number
    span: number
    isStart: boolean
    isEnd: boolean
    row: number
}

/**
 * Calculates the lanes needed for multi-day tasks in a specific week.
 * This logic ensures tasks are stacked to prevent overlap and determines the total height needed.
 */
export function calculateWeekBars(
    tasks: GeneratedTask[],
    weekDays: Date[],
    gridColumns: number
): { bars: MultiDayBar[]; lanesCount: number } {
    if (weekDays.length === 0) return { bars: [], lanesCount: 0 }

    const weekStart = normalizeDate(weekDays[0]!)
    const weekEnd = normalizeDate(weekDays[weekDays.length - 1]!)
    const bars: MultiDayBar[] = []

    // Filter and prepare tasks that overlap with the week
    const tasksWithRange = tasks.filter((task) => {
        if (!task.dueDate) return false

        const today = normalizeDate(new Date())
        const taskStart = task.startDate ? normalizeDate(task.startDate) : today
        const taskEnd = normalizeDate(task.dueDate)

        // Only include if it's a multi-day task (start < end)
        if (taskStart.getTime() >= taskEnd.getTime()) return false

        // Overlap check
        return taskStart <= weekEnd && taskEnd >= weekStart
    })

    // Calculate grid positions
    tasksWithRange.forEach((task) => {
        const today = normalizeDate(new Date())
        const taskStart = task.startDate ? normalizeDate(task.startDate) : today
        const taskEnd = normalizeDate(task.dueDate)

        const visibleStart = taskStart < weekStart ? weekStart : taskStart
        const visibleEnd = taskEnd > weekEnd ? weekEnd : taskEnd

        const startCol = weekDays.findIndex((d) => normalizeDate(d).getTime() === visibleStart.getTime())
        const endCol = weekDays.findIndex((d) => normalizeDate(d).getTime() === visibleEnd.getTime())

        const actualStartCol = startCol >= 0 ? startCol : 0
        const actualEndCol = endCol >= 0 ? endCol : gridColumns - 1
        const span = actualEndCol - actualStartCol + 1

        bars.push({
            task,
            startCol: actualStartCol,
            span,
            isStart: taskStart >= weekStart && taskStart <= weekEnd,
            isEnd: taskEnd >= weekStart && taskEnd <= weekEnd,
            row: 0,
        })
    })

    // Sort: Start column first, then longer span first
    bars.sort((a, b) => {
        if (a.startCol !== b.startCol) return a.startCol - b.startCol
        return b.span - a.span
    })

    // Allocation
    const lanes: Array<Set<number>> = []
    bars.forEach((bar) => {
        let assignedLane = -1
        for (let laneIdx = 0; laneIdx < lanes.length; laneIdx++) {
            const lane = lanes[laneIdx]
            const hasOverlap = Array.from({ length: bar.span }, (_, i) => bar.startCol + i)
                .some((col) => lane!.has(col))

            if (!hasOverlap) {
                assignedLane = laneIdx
                break
            }
        }

        if (assignedLane === -1) {
            assignedLane = lanes.length
            lanes.push(new Set())
        }

        for (let i = 0; i < bar.span; i++) {
            lanes[assignedLane]!.add(bar.startCol + i)
        }
        bar.row = assignedLane
    })

    return { bars, lanesCount: lanes.length }
}
