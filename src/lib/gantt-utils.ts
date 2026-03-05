import { GanttItem } from '@/types'
import { addHours, differenceInHours, parseISO, isAfter, isBefore } from 'date-fns'

/**
 * Detects if there are any circular dependencies in the task graph.
 * Returns true if a cycle is detected.
 */
export function detectCycles(items: GanttItem[]): boolean {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    const itemMap = new Map(items.map(t => [t.id, t]))

    function dfs(itemId: string): boolean {
        visited.add(itemId)
        recursionStack.add(itemId)

        const item = itemMap.get(itemId)
        if (item?.dependencies) {
            for (const dep of item.dependencies) {
                if (!visited.has(dep.targetTaskId)) {
                    if (dfs(dep.targetTaskId)) return true
                } else if (recursionStack.has(dep.targetTaskId)) {
                    return true
                }
            }
        }

        recursionStack.delete(itemId)
        return false
    }

    for (const item of items) {
        if (!visited.has(item.id)) {
            if (dfs(item.id)) return true
        }
    }

    return false
}

/**
 * Calculates the Critical Path for a given set of items.
 * Returns a Set of item IDs that are on the critical path.
 * 
 * Note: This is a simplified CPM implementation assuming Finish-to-Start dependencies
 * and using estimatedHours for duration.
 */
export function calculateCriticalPath(items: GanttItem[]): Set<string> {
    if (detectCycles(items)) {
        console.warn('Circular dependency detected. Cannot calculate critical path.')
        return new Set()
    }

    const itemMap = new Map(items.map(t => [t.id, t]))
    const earlyStart = new Map<string, number>()
    const earlyFinish = new Map<string, number>()
    const lateStart = new Map<string, number>()
    const lateFinish = new Map<string, number>()

    // Topological sort (simplified for this context)
    // We'll just iterate multiple times to propagate values, which works for DAGs
    // In a real large-scale system, a proper topo sort is better.

    // 1. Forward Pass (Calculate Early Start & Early Finish)
    let changed = true
    while (changed) {
        changed = false
        for (const item of items) {
            let maxPrevFinish = 0

            // Find predecessors (items that point to this item)
            // Note: Our schema stores dependencies on the *successor* (Item A depends on B)
            // So if A depends on B, B must finish before A starts.
            // Wait, the schema says: dependencies: TaskDependency[]
            // Usually "dependencies" means "I depend on X".
            // So if Item A has dependency { targetTaskId: B }, then B -> A.

            if (item.dependencies) {
                for (const dep of item.dependencies) {
                    const predecessor = itemMap.get(dep.targetTaskId)
                    if (predecessor) {
                        const predEF = earlyFinish.get(predecessor.id) || 0
                        // Add lag if needed (assuming hours)
                        const finishWithLag = predEF + (dep.lag || 0)
                        if (finishWithLag > maxPrevFinish) {
                            maxPrevFinish = finishWithLag
                        }
                    }
                }
            }

            const duration = typeof item.estimatedHours === 'number' ? item.estimatedHours : 24
            const es = maxPrevFinish
            const ef = es + duration

            if (es !== earlyStart.get(item.id) || ef !== earlyFinish.get(item.id)) {
                earlyStart.set(item.id, es)
                earlyFinish.set(item.id, ef)
                changed = true
            }
        }
    }

    // Project Duration
    let projectDuration = 0
    for (const ef of earlyFinish.values()) {
        if (ef > projectDuration) projectDuration = ef
    }

    // 2. Backward Pass (Calculate Late Start & Late Finish)
    // Initialize all late finishes to project duration
    for (const item of items) {
        lateFinish.set(item.id, projectDuration)
        lateStart.set(item.id, projectDuration - (item.estimatedHours || 1))
    }

    changed = true
    while (changed) {
        changed = false
        for (const item of items) {
            const duration = typeof item.estimatedHours === 'number' ? item.estimatedHours : 24
            let minNextStart = projectDuration

            // Find successors (items that depend on this item)
            // If Item S depends on Item T (current), then S has T in its dependencies list
            for (const potentialSuccessor of items) {
                if (potentialSuccessor.dependencies?.some(d => d.targetTaskId === item.id)) {
                    const successorLS = lateStart.get(potentialSuccessor.id) || 0
                    // Adjust for lag: LS_successor - lag
                    const dep = potentialSuccessor.dependencies.find(d => d.targetTaskId === item.id)
                    const lag = dep?.lag || 0
                    const finishConstraint = successorLS - lag

                    if (finishConstraint < minNextStart) {
                        minNextStart = finishConstraint
                    }
                }
            }

            const lf = minNextStart
            const ls = lf - duration

            if (lf !== lateFinish.get(item.id) || ls !== lateStart.get(item.id)) {
                lateFinish.set(item.id, lf)
                lateStart.set(item.id, ls)
                changed = true
            }
        }
    }

    // 3. Identify Critical Path (Float = 0)
    const criticalPath = new Set<string>()
    for (const item of items) {
        const es = earlyStart.get(item.id) || 0
        const ls = lateStart.get(item.id) || 0
        // Float = LS - ES
        const float = ls - es

        // Use a small epsilon for float comparison due to potential floating point issues
        if (Math.abs(float) < 0.01) {
            criticalPath.add(item.id)
        }
    }

    return criticalPath
}

/**
 * Auto-schedules items based on dependencies.
 * Updates startDate and endDate for all items.
 * Assumes project starts at 'projectStartDate'.
 */
export function scheduleTasks(items: GanttItem[], projectStartDate: Date): GanttItem[] {
    if (detectCycles(items)) {
        console.warn('Circular dependency detected. Skipping auto-schedule.')
        return items
    }

    const scheduledItems = [...items]
    const itemMap = new Map(scheduledItems.map(t => [t.id, t]))
    const processed = new Set<string>()

    // Helper to get item duration in hours
    const getDuration = (t: GanttItem) => t.estimatedHours || 24 // Default to 24h if missing

    let changed = true
    while (changed) {
        changed = false
        for (const item of scheduledItems) {
            let maxPrevEndDate = projectStartDate

            if (item.dependencies && item.dependencies.length > 0) {
                for (const dep of item.dependencies) {
                    const predecessor = itemMap.get(dep.targetTaskId)
                    if (predecessor && predecessor.endDate) {
                        const predEnd = parseISO(predecessor.endDate)
                        const lagHours = dep.lag || 0
                        const startWithLag = addHours(predEnd, lagHours)

                        if (isAfter(startWithLag, maxPrevEndDate)) {
                            maxPrevEndDate = startWithLag
                        }
                    }
                }
            }

            const newStartDate = maxPrevEndDate.toISOString()
            const newEndDate = addHours(maxPrevEndDate, getDuration(item)).toISOString()

            if (item.startDate !== newStartDate || item.endDate !== newEndDate) {
                item.startDate = newStartDate
                item.endDate = newEndDate
                changed = true
            }
        }
    }

    return scheduledItems
}
