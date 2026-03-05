/**
 * WBS Algorithms - Critical Path Method (CPM) Implementation
 *
 * Industry-standard CPM implementation supporting all 4 dependency types:
 * - FS (Finish-to-Start): B starts after A finishes
 * - SS (Start-to-Start): B starts after A starts
 * - FF (Finish-to-Finish): B finishes after A finishes
 * - SF (Start-to-Finish): B finishes after A starts
 *
 * Based on PMI PMBOK Guide and Microsoft Project scheduling algorithms.
 *
 * @see https://www.pmi.org/pmbok-guide-standards
 */

import { GeneratedTask } from '@/types/task-template-schema'
import { parseISO } from 'date-fns'

/* -------------------------------------------------------------------------- */
/*                              TYPE DEFINITIONS                               */
/* -------------------------------------------------------------------------- */

/** Supported dependency relationship types */
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF'

/** Dependency definition with type and lag */
export interface TaskDependency {
    targetTaskId: string  // The predecessor task ID
    type: DependencyType  // Relationship type
    lag: number           // Lag in days (positive = delay, negative = lead)
}

/* -------------------------------------------------------------------------- */
/*                                 WBS UTILITIES                              */
/* -------------------------------------------------------------------------- */

export interface WBSNode extends GeneratedTask {
    children: WBSNode[]
    level: number
    expanded: boolean
    hasChildren: boolean
    es: Date
    ef: Date
    ls: Date
    lf: Date
    float: number
    isCritical: boolean
}

/**
 * Builds a hierarchical tree from a flat list of tasks.
 */
export function buildWBSTree(tasks: GeneratedTask[], collapsedIds: Set<string> = new Set()): WBSNode[] {
    const nodeMap = new Map<string, WBSNode>()
    const rootNodes: WBSNode[] = []

    tasks.forEach(task => {
        nodeMap.set(task.id, {
            ...task,
            children: [],
            level: 0,
            expanded: !collapsedIds.has(task.id),
            hasChildren: false,
            isMilestone: task.isMilestone || false,
            es: task.startDate ? parseISO(task.startDate) : new Date(),
            ef: task.endDate ? parseISO(task.endDate) : new Date(),
            ls: new Date(8640000000000000),
            lf: new Date(8640000000000000),
            float: 0,
            isCritical: false
        })
    })

    const parseDate = (val: any) => {
        if (!val) return 0
        if (typeof val.toDate === 'function') return val.toDate().getTime()
        const d = new Date(val)
        return isNaN(d.getTime()) ? 0 : d.getTime()
    }

    tasks.forEach(task => {
        const node = nodeMap.get(task.id)!
        if (task.parentTaskId && nodeMap.has(task.parentTaskId)) {
            const parent = nodeMap.get(task.parentTaskId)!
            parent.children.push(node)
            parent.hasChildren = true
            node.level = parent.level + 1
        } else {
            rootNodes.push(node)
        }
    })

    // Explicitly sort root nodes and children by createdAt desc (newest first)
    const sortNodes = (nodes: WBSNode[]) => {
        nodes.sort((a, b) => parseDate(b.createdAt) - parseDate(a.createdAt))
        nodes.forEach(node => {
            if (node.children.length > 0) sortNodes(node.children)
        })
    }

    sortNodes(rootNodes)

    return rootNodes
}

/**
 * Flattens the tree for display.
 */
export function flattenWBSTreeForDisplay(nodes: WBSNode[]): WBSNode[] {
    const flatList: WBSNode[] = []

    function traverse(node: WBSNode) {
        flatList.push(node)
        if (node.children.length > 0 && node.expanded) {
            node.children.forEach(child => traverse(child))
        }
    }

    nodes.forEach(node => traverse(node))
    return flatList
}


/* -------------------------------------------------------------------------- */
/*                        CRITICAL PATH METHOD (CPM)                          */
/* -------------------------------------------------------------------------- */

export interface WBSScheduleResult {
    es: Date
    ef: Date
    ls: Date
    lf: Date
    float: number
    isCritical: boolean
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Industry-Standard Float Tolerance
 *
 * Using 0.001 days (~1.4 minutes) to account for floating-point precision
 * while ensuring only truly zero-float tasks are marked critical.
 *
 * Previous value of 2.1 days was too high and incorrectly marked
 * non-critical tasks as critical.
 */
const FLOAT_TOLERANCE_DAYS = 0.001

/**
 * Calculate schedule using Critical Path Method (CPM)
 *
 * Implements the industry-standard PDM (Precedence Diagramming Method)
 * with full support for all 4 dependency types:
 *
 * - FS (Finish-to-Start): Successor starts after predecessor finishes
 * - SS (Start-to-Start): Successor starts after predecessor starts
 * - FF (Finish-to-Finish): Successor finishes after predecessor finishes
 * - SF (Start-to-Finish): Successor finishes after predecessor starts
 *
 * Algorithm:
 * 1. Forward Pass - Calculate Early Start (ES) and Early Finish (EF)
 * 2. Backward Pass - Calculate Late Start (LS) and Late Finish (LF)
 * 3. Float Calculation - Total Float = LS - ES
 * 4. Critical Path - Tasks with Float ≈ 0
 *
 * @param tasks - Array of tasks with dependencies
 * @returns Map of task ID to schedule result
 */
export function calculateWBSSchedule(tasks: GeneratedTask[]): Map<string, WBSScheduleResult> {
    const resultMap = new Map<string, WBSScheduleResult>()
    if (tasks.length === 0) return resultMap

    console.log('[CPM] Starting calculation for', tasks.length, 'tasks')

    // Create lookup maps
    const taskMap = new Map<string, GeneratedTask>()
    tasks.forEach(t => taskMap.set(t.id, t))

    // Find project start date (earliest task start)
    let projectStart = new Date()
    const validStarts = tasks
        .filter(t => t.startDate)
        .map(t => parseISO(t.startDate!).getTime())
        .filter(time => !isNaN(time))

    if (validStarts.length > 0) {
        projectStart = new Date(Math.min(...validStarts))
    }
    projectStart.setHours(0, 0, 0, 0)

    // Duration cache - store task durations in ms
    const durationMap = new Map<string, number>()

    // Calculate ES/EF for all tasks (Forward Pass)
    const esMap = new Map<string, number>()  // Early Start in ms from projectStart
    const efMap = new Map<string, number>()  // Early Finish in ms from projectStart

    // Initialize with explicit dates
    tasks.forEach(t => {
        const start = t.startDate ? parseISO(t.startDate) : projectStart
        const end = t.endDate ? parseISO(t.endDate) : start

        const es = start.getTime() - projectStart.getTime()
        const isMilestone = t.isMilestone === true ||
            (t as any).milestone === 'Yes' ||
            (t as any).milestone === 'True'

        // Duration = end - start + 1 day (inclusive). Milestones have 0 duration.
        const duration = isMilestone ? 0 : (end.getTime() - start.getTime() + MS_PER_DAY)
        durationMap.set(t.id, duration)

        const ef = es + duration

        esMap.set(t.id, es)
        efMap.set(t.id, ef)
    })

    /* ========================================================================
     * FORWARD PASS - Calculate Early Start (ES) and Early Finish (EF)
     *
     * For each dependency type:
     * - FS: Successor ES = max(ES, Predecessor EF + lag)
     * - SS: Successor ES = max(ES, Predecessor ES + lag)
     * - FF: Successor EF = max(EF, Predecessor EF + lag), then ES = EF - duration
     * - SF: Successor EF = max(EF, Predecessor ES + lag), then ES = EF - duration
     * ======================================================================== */
    let changed = true
    let iterations = 0
    const maxIterations = tasks.length * 2 + 10 // Sufficient for convergence

    while (changed && iterations < maxIterations) {
        changed = false
        iterations++

        tasks.forEach(t => {
            if (!t.dependencies || t.dependencies.length === 0) return

            const duration = durationMap.get(t.id) || 0
            let currentES = esMap.get(t.id) || 0
            let currentEF = efMap.get(t.id) || 0

            t.dependencies.forEach((dep: any) => {
                const predES = esMap.get(dep.targetTaskId)
                const predEF = efMap.get(dep.targetTaskId)
                if (predES === undefined || predEF === undefined) return

                const type: DependencyType = (dep.type || 'FS').toUpperCase() as DependencyType
                const lag = (dep.lag || 0) * MS_PER_DAY

                let newES = currentES
                let newEF = currentEF

                switch (type) {
                    case 'FS': // Finish-to-Start: B starts after A finishes
                        // ES_B >= EF_A + lag
                        const requiredStartFS = predEF + lag
                        if (requiredStartFS > currentES) {
                            newES = requiredStartFS
                            newEF = newES + duration
                        }
                        break

                    case 'SS': // Start-to-Start: B starts after A starts
                        // ES_B >= ES_A + lag
                        const requiredStartSS = predES + lag
                        if (requiredStartSS > currentES) {
                            newES = requiredStartSS
                            newEF = newES + duration
                        }
                        break

                    case 'FF': // Finish-to-Finish: B finishes after A finishes
                        // EF_B >= EF_A + lag
                        const requiredFinishFF = predEF + lag
                        if (requiredFinishFF > currentEF) {
                            newEF = requiredFinishFF
                            newES = newEF - duration
                        }
                        break

                    case 'SF': // Start-to-Finish: B finishes after A starts
                        // EF_B >= ES_A + lag
                        const requiredFinishSF = predES + lag
                        if (requiredFinishSF > currentEF) {
                            newEF = requiredFinishSF
                            newES = newEF - duration
                        }
                        break

                    default:
                        // Default to FS behavior for unknown types
                        const requiredStartDefault = predEF + lag
                        if (requiredStartDefault > currentES) {
                            newES = requiredStartDefault
                            newEF = newES + duration
                        }
                }

                // Apply updates if changed
                if (newES !== currentES || newEF !== currentEF) {
                    esMap.set(t.id, newES)
                    efMap.set(t.id, newEF)
                    currentES = newES
                    currentEF = newEF
                    changed = true
                }
            })
        })
    }

    if (iterations >= maxIterations) {
        console.warn('[CPM] Forward pass did not converge - possible circular dependency')
    }

    // Find project finish (max EF across all tasks)
    let projectFinish = 0
    efMap.forEach(ef => {
        if (ef > projectFinish) projectFinish = ef
    })

    /* ========================================================================
     * BACKWARD PASS - Calculate Late Start (LS) and Late Finish (LF)
     *
     * For each dependency type (from successor's perspective):
     * - FS: Predecessor LF = min(LF, Successor LS - lag)
     * - SS: Predecessor LS = min(LS, Successor LS - lag), then LF = LS + duration
     * - FF: Predecessor LF = min(LF, Successor LF - lag)
     * - SF: Predecessor LS = min(LS, Successor LF - lag), then LF = LS + duration
     * ======================================================================== */
    const lsMap = new Map<string, number>()
    const lfMap = new Map<string, number>()

    // Build successors map with dependency info
    // Map: predecessorId -> [{successorId, type, lag}]
    const successorsMap = new Map<string, Array<{ succId: string, type: DependencyType, lag: number }>>()
    tasks.forEach(t => successorsMap.set(t.id, []))

    tasks.forEach(t => {
        if (!t.dependencies) return
        t.dependencies.forEach((dep: any) => {
            const succs = successorsMap.get(dep.targetTaskId) || []
            succs.push({
                succId: t.id,
                type: ((dep.type || 'FS').toUpperCase()) as DependencyType,
                lag: dep.lag || 0
            })
            successorsMap.set(dep.targetTaskId, succs)
        })
    })

    // Initialize all tasks with LF = projectFinish, LS = LF - duration
    tasks.forEach(t => {
        const duration = durationMap.get(t.id) || 0
        lfMap.set(t.id, projectFinish)
        lsMap.set(t.id, projectFinish - duration)
    })

    // Backward pass iterations
    changed = true
    iterations = 0

    while (changed && iterations < maxIterations) {
        changed = false
        iterations++

        tasks.forEach(t => {
            const successors = successorsMap.get(t.id) || []
            if (successors.length === 0) return

            const duration = durationMap.get(t.id) || 0
            let currentLS = lsMap.get(t.id) || 0
            let currentLF = lfMap.get(t.id) || projectFinish

            successors.forEach(({ succId, type, lag }) => {
                const succLS = lsMap.get(succId)
                const succLF = lfMap.get(succId)
                if (succLS === undefined || succLF === undefined) return

                const lagMs = lag * MS_PER_DAY
                let newLS = currentLS
                let newLF = currentLF

                switch (type) {
                    case 'FS': // Finish-to-Start: Predecessor must finish before successor starts
                        // LF_A <= LS_B - lag
                        const constraintLF_FS = succLS - lagMs
                        if (constraintLF_FS < currentLF) {
                            newLF = constraintLF_FS
                            newLS = newLF - duration
                        }
                        break

                    case 'SS': // Start-to-Start: Predecessor must start before successor starts
                        // LS_A <= LS_B - lag
                        const constraintLS_SS = succLS - lagMs
                        if (constraintLS_SS < currentLS) {
                            newLS = constraintLS_SS
                            newLF = newLS + duration
                        }
                        break

                    case 'FF': // Finish-to-Finish: Predecessor must finish before successor finishes
                        // LF_A <= LF_B - lag
                        const constraintLF_FF = succLF - lagMs
                        if (constraintLF_FF < currentLF) {
                            newLF = constraintLF_FF
                            newLS = newLF - duration
                        }
                        break

                    case 'SF': // Start-to-Finish: Predecessor must start before successor finishes
                        // LS_A <= LF_B - lag
                        const constraintLS_SF = succLF - lagMs
                        if (constraintLS_SF < currentLS) {
                            newLS = constraintLS_SF
                            newLF = newLS + duration
                        }
                        break

                    default:
                        // Default to FS behavior
                        const constraintLF_default = succLS - lagMs
                        if (constraintLF_default < currentLF) {
                            newLF = constraintLF_default
                            newLS = newLF - duration
                        }
                }

                // Apply updates if changed
                if (newLS !== currentLS || newLF !== currentLF) {
                    lsMap.set(t.id, newLS)
                    lfMap.set(t.id, newLF)
                    currentLS = newLS
                    currentLF = newLF
                    changed = true
                }
            })
        })
    }

    if (iterations >= maxIterations) {
        console.warn('[CPM] Backward pass did not converge - possible circular dependency')
    }

    /* ========================================================================
     * FLOAT CALCULATION & CRITICAL PATH IDENTIFICATION
     *
     * Total Float = LS - ES (or equivalently LF - EF)
     * Critical Path = Tasks where Float ≈ 0
     * ======================================================================== */
    const criticalTasks: string[] = []
    const floatToleranceMs = FLOAT_TOLERANCE_DAYS * MS_PER_DAY

    tasks.forEach(t => {
        const es = esMap.get(t.id) || 0
        const ef = efMap.get(t.id) || 0
        const ls = lsMap.get(t.id) || 0
        const lf = lfMap.get(t.id) || 0

        // Total Float = LS - ES
        const floatMs = ls - es

        // A task is critical if its float is effectively zero
        const isCritical = Math.abs(floatMs) <= floatToleranceMs

        if (isCritical) {
            criticalTasks.push(t.title)
        }

        resultMap.set(t.id, {
            es: new Date(projectStart.getTime() + es),
            ef: new Date(projectStart.getTime() + ef),
            ls: new Date(projectStart.getTime() + ls),
            lf: new Date(projectStart.getTime() + lf),
            float: floatMs / MS_PER_DAY,
            isCritical
        })
    })

    console.log(`[CPM] Calculation complete:`)
    console.log(`  - Tasks processed: ${tasks.length}`)
    console.log(`  - Critical tasks: ${criticalTasks.length}`)
    console.log(`  - Project duration: ${projectFinish / MS_PER_DAY} days`)
    if (criticalTasks.length > 0) {
        console.log(`  - Critical path: ${criticalTasks.slice(0, 5).join(' → ')}${criticalTasks.length > 5 ? ' ...' : ''}`)
    }

    return resultMap
}

/**
 * Backward compatible wrapper
 */
export function calculateWBSCriticalPath(tasks: GeneratedTask[]): Set<string> {
    const schedule = calculateWBSSchedule(tasks)
    const criticalSet = new Set<string>()
    schedule.forEach((val, key) => {
        if (val.isCritical) criticalSet.add(key)
    })
    return criticalSet
}

/* -------------------------------------------------------------------------- */
/*                           CYCLE DETECTION                                  */
/* -------------------------------------------------------------------------- */

/**
 * Detects circular dependencies in a task graph using DFS.
 *
 * Circular dependencies cause infinite loops in CPM calculations and must
 * be prevented. This function uses the standard DFS-based cycle detection
 * algorithm with a recursion stack.
 *
 * @param tasks - Array of tasks with dependencies
 * @returns Object with hasCycle boolean and optional cycle path for error messages
 */
export function detectDependencyCycles(tasks: GeneratedTask[]): {
    hasCycle: boolean
    cyclePath?: string[]  // Task titles in the cycle for user-friendly error
} {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    const taskMap = new Map<string, GeneratedTask>()
    const path: string[] = []

    // Build task map
    tasks.forEach(t => taskMap.set(t.id, t))

    function dfs(taskId: string): boolean {
        visited.add(taskId)
        recursionStack.add(taskId)

        const task = taskMap.get(taskId)
        if (task) {
            path.push(task.title || task.id)
        }

        if (task?.dependencies) {
            for (const dep of task.dependencies) {
                const predId = dep.targetTaskId

                // Skip if predecessor not in our task set (external reference)
                if (!taskMap.has(predId)) continue

                if (!visited.has(predId)) {
                    if (dfs(predId)) return true
                } else if (recursionStack.has(predId)) {
                    // Found cycle - add the cycle start point to complete the cycle path
                    const predTask = taskMap.get(predId)
                    path.push(predTask?.title || predId)
                    return true
                }
            }
        }

        path.pop()
        recursionStack.delete(taskId)
        return false
    }

    for (const task of tasks) {
        if (!visited.has(task.id)) {
            if (dfs(task.id)) {
                return {
                    hasCycle: true,
                    cyclePath: [...path]
                }
            }
        }
    }

    return { hasCycle: false }
}

/**
 * Detects cycles in import data before execution.
 *
 * This version works with the import data structure where task names
 * are used as identifiers (batch-{TaskName}) before Firestore IDs exist.
 *
 * @param rows - Validated rows from import
 * @param requestIdMap - Map of batch-{name} to real IDs (if available)
 * @returns Object with hasCycle boolean and cycle details
 */
export function detectImportCycles(
    rows: Array<{
        data: Record<string, any>
        resolvedData: Record<string, any>
    }>,
    requestIdMap: Record<string, string> = {}
): {
    hasCycle: boolean
    cyclePath?: string[]
    errorMessage?: string
} {
    // Build a graph using task names as identifiers
    const taskNames = new Map<string, number>() // name -> row index
    const graph = new Map<string, string[]>()   // name -> predecessor names

    // First pass: collect all task names
    rows.forEach((row, index) => {
        const name = (
            row.data['Task Name'] ||
            row.data['taskName'] ||
            row.data['Task Title'] ||
            row.data['taskTitle'] ||
            ''
        ).trim().toLowerCase()

        if (name) {
            taskNames.set(name, index)
            graph.set(name, [])
        }
    })

    // Second pass: build dependency edges
    rows.forEach((row) => {
        const name = (
            row.data['Task Name'] ||
            row.data['taskName'] ||
            row.data['Task Title'] ||
            row.data['taskTitle'] ||
            ''
        ).trim().toLowerCase()

        if (!name) return

        // Get predecessors from resolved data or raw data
        const predecessorIds: string[] = row.resolvedData?.predecessorIds || []
        const rawPredecessors = row.data['Predecessor'] || row.data['predecessor'] || ''

        // Parse raw predecessors if no resolved ones
        let predNames: string[] = []
        if (predecessorIds.length > 0) {
            // Convert batch-{name} back to name
            predNames = predecessorIds
                .filter(id => id.startsWith('batch-'))
                .map(id => id.replace('batch-', '').toLowerCase())
        } else if (rawPredecessors) {
            predNames = String(rawPredecessors)
                .split(',')
                .map(p => p.trim().toLowerCase())
                .filter(p => p)
        }

        // Add edges only for tasks in our import batch
        const validPreds = predNames.filter(p => taskNames.has(p))
        graph.set(name, validPreds)
    })

    // DFS cycle detection
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    const path: string[] = []

    function dfs(name: string): boolean {
        visited.add(name)
        recursionStack.add(name)
        path.push(name)

        const predecessors = graph.get(name) || []
        for (const pred of predecessors) {
            if (!visited.has(pred)) {
                if (dfs(pred)) return true
            } else if (recursionStack.has(pred)) {
                // Found cycle
                path.push(pred)
                return true
            }
        }

        path.pop()
        recursionStack.delete(name)
        return false
    }

    const allTaskNames = Array.from(taskNames.keys())
    for (const name of allTaskNames) {
        if (!visited.has(name)) {
            if (dfs(name)) {
                // Find where cycle starts in path
                const cycleStart = path[path.length - 1] || ''
                const cycleStartIdx = path.indexOf(cycleStart)
                const cyclePath = path.slice(cycleStartIdx)

                const pathStr = (cyclePath || []).join(' → ')
                return {
                    hasCycle: true,
                    cyclePath,
                    errorMessage: `Circular dependency detected: ${pathStr}`
                }
            }
        }
    }

    return { hasCycle: false }
}

/**
 * Validates dependencies to detect loops.
 * @deprecated Use detectDependencyCycles instead
 */
export function validateDependencies(tasks: GeneratedTask[], newDependency: { source: string, target: string }): boolean {
    return true
}
