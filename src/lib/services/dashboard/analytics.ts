import { differenceInDays, isBefore, parseISO, startOfToday } from 'date-fns'
import type { GeneratedTask } from '@/types/task-template-schema'
import { calculateCriticalPath } from '@/lib/gantt-utils'

/**
 * Dashboard Analytics Engine
 * Pure functions to transform raw task data into strategic insights.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface MilestoneHealth {
  id: string
  title: string
  date: string
  status: 'completed' | 'on_track' | 'at_risk' | 'late'
  isCritical: boolean
}

export interface BlockerInfo {
  taskId: string
  taskTitle: string
  taskNumber?: number
  projectCode?: string
  reason: 'explicit_status' | 'dependency_failure'
  blockerDetails: string
  ageInDays: number
}

export interface VarianceMetric {
  taskId: string
  title: string
  taskNumber?: number
  projectCode?: string
  projectId: string
  baselineDate: string
  projectedDate: string
  varianceDays: number // Positive = Late, Negative = Early
}

// ============================================================================
// LOGIC FUNCTIONS
// ============================================================================

/**
 * Analyze Milestones Health
 * Determines if milestones are on track based on due dates and critical path.
 */
export function analyzeMilestones(tasks: GeneratedTask[]): MilestoneHealth[] {
  const milestones = tasks.filter(t => t.isMilestone)

  // Reuse existing CPM logic to find critical tasks
  // Map GeneratedTask to GanttItem expected by utils
  const ganttItems = tasks.map(t => ({
    id: t.id,
    title: t.title,
    type: 'task' as const,
    dependencies: t.dependencies,
    estimatedHours: t.estimatedHours,
    startDate: t.startDate,
    endDate: t.endDate
  }))

  const criticalPathIds = calculateCriticalPath(ganttItems)
  const today = startOfToday()

  return milestones.map(m => {
    const dueDate = parseISO(m.targetDate || m.dueDate)
    let status: MilestoneHealth['status'] = 'on_track'

    if (m.status === 'completed') {
      status = 'completed'
    } else if (isBefore(dueDate, today)) {
      status = 'late'
    } else if (criticalPathIds.has(m.id)) {
      // If it's critical and not done, it's inherently risky
      status = 'at_risk'
    } else {
      status = 'on_track'
    }

    return {
      id: m.id,
      title: m.title,
      date: m.targetDate || m.dueDate,
      status,
      isCritical: criticalPathIds.has(m.id)
    }
  })
}

/**
 * Analyze Blockers
 * Identifies tasks that are stopped either explicitly (status) or implicitly (dependencies).
 */
export function analyzeBlockers(tasks: GeneratedTask[]): BlockerInfo[] {
  const blockers: BlockerInfo[] = []
  const taskMap = new Map(tasks.map(t => [t.id, t]))
  const today = startOfToday()

  tasks.forEach(task => {
    // 1. Explicit Blockers (Status)
    if (task.status === 'escalated' || task.status === 'on_hold') {
      blockers.push({
        taskId: task.id,
        taskTitle: task.title,
        taskNumber: task.taskNumber,
        projectCode: task.projectCode,
        reason: 'explicit_status',
        blockerDetails: `Task is ${task.status.replace('_', ' ')}`,
        ageInDays: differenceInDays(today, parseISO(task.updatedAt))
      })
      return // Don't double count
    }

    // 2. Implicit Blockers (Dependency Failure)
    if (task.dependencies && task.dependencies.length > 0 && task.status !== 'completed') {
      let failureReason = ''
      const failedDep = task.dependencies.find(dep => {
        const pred = taskMap.get(dep.targetTaskId)
        if (!pred) return false

        // A. Status Failures
        if (pred.status === 'escalated' || pred.status === 'cancelled') {
          failureReason = `Waiting on: ${pred.title} (Status: ${pred.status})`
          return true
        }

        // B. Overdue Failures (including Summary Task date derivation)
        const effectiveDueDateStr = getEffectiveDueDate(pred, tasks)
        if (effectiveDueDateStr) {
          const predDue = parseISO(effectiveDueDateStr)
          if (isBefore(predDue, today) && pred.status !== 'completed') {
            failureReason = `Waiting on: ${pred.title} (Overdue)`
            return true
          }
        }

        // C. Chain Blockers (Successor of a blocked task)
        if (blockers.some(b => b.taskId === pred.id)) {
          failureReason = `Waiting on: ${pred.title} (Blocked)`
          return true
        }

        return false
      })

      if (failedDep) {
        blockers.push({
          taskId: task.id,
          taskTitle: task.title,
          taskNumber: task.taskNumber,
          projectCode: task.projectCode,
          reason: 'dependency_failure',
          blockerDetails: failureReason,
          ageInDays: 0 // Dynamic
        })
      }
    }
  })

  return blockers
}

/**
 * Helper to get the effective due date for a task.
 * For summary tasks (tasks with children), it derives the date from the latest child.
 * Also checks targetDate, dueDate, and endDate fields.
 */
function getEffectiveDueDate(task: GeneratedTask, allTasks: GeneratedTask[]): string | undefined {
  // Check if it's a summary task by searching for children
  const children = allTasks.filter(t => t.parentTaskId === task.id)

  if (children.length > 0) {
    // Recursively find the latest due date among children
    const childDates = children
      .map(c => getEffectiveDueDate(c, allTasks))
      .filter((d): d is string => !!d)
      .map(d => parseISO(d))

    if (childDates.length > 0) {
      const latestDate = new Date(Math.max(...childDates.map(d => d.getTime())))
      return latestDate.toISOString()
    }
  }

  // Fallback to the task's own dates (in order of priority)
  return task.targetDate || task.dueDate || task.endDate || undefined
}

/**
 * Analyze Schedule Variance
 * Compares Baseline (Due Date) vs Projected (based on start date + duration)
 * Note: This is a simplified projection. Real EVM would need baseline snapshots.
 */
export function analyzeVariance(tasks: GeneratedTask[]): VarianceMetric[] {
  const today = startOfToday()

  return tasks
    .filter(t => t.status !== 'cancelled')
    .map(t => {
      const baseline = parseISO(t.dueDate)

      // Use actualEndDate if completed, otherwise use today for projection
      let comparisonDate: Date
      if (t.status === 'completed' && t.actualEndDate) {
        comparisonDate = parseISO(t.actualEndDate)
      } else {
        comparisonDate = today
      }

      // Variance is only counted if the comparison date is AFTER the baseline
      // If completed before due date, or today is before due date, variance is 0
      const variance = Math.max(0, differenceInDays(comparisonDate, baseline))

      return {
        taskId: t.id,
        title: t.title,
        taskNumber: t.taskNumber,
        projectCode: t.projectCode,
        projectId: t.projectId,
        baselineDate: t.dueDate,
        projectedDate: comparisonDate.toISOString(),
        varianceDays: variance
      } as VarianceMetric
    })
    .filter((v): v is VarianceMetric => v !== null && v.varianceDays > 0) // Only return items with a delay
    .sort((a, b) => b.varianceDays - a.varianceDays) // Sort by biggest delay
}

