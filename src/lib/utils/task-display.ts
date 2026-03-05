/**
 * Task Display Utilities
 * 
 * Helper functions for formatting task IDs and display information.
 * Supports sequential IDs (PA-1, PA-2) with fallback for legacy tasks.
 */

import type { GeneratedTask } from '@/types/task-template-schema'
import type { EnhancedProject } from '@/types/project-schema'
import { generateProjectCode } from './project-utils'

export interface TaskDisplayInfo {
    displayId: string        // e.g., "PA-63"
    isSubtask: boolean
    parentDisplayId?: string // e.g., "PA-56" for subtasks
}

/**
 * Format a task ID for display.
 * 
 * Uses taskNumber if available (new format: PA-1, PA-2)
 * Falls back to truncated Firestore ID for legacy tasks (PA-ABCD)
 * 
 * @param task - The task to format
 * @param project - Optional project for project code
 * @param companyId - Optional company ID to check for tenant-specific display rules
 * @param companyDomain - Optional company domain (e.g. "autocracy.com") when company ID is Firestore auto-id
 * @returns Formatted task ID string (e.g., "PA-63") or empty string for autocracy tenant
 */
export function formatTaskId(
    task: GeneratedTask | { id: string; taskNumber?: number; projectCode?: string },
    project?: { projectCode?: string; name?: string } | null,
    companyId?: string | null,
    companyDomain?: string | null
): string {
    // Hide task IDs for autocracy tenant (check both ID and domain; ID may be Firestore auto-generated)
    if (companyId && companyId.toLowerCase().includes('autocracy')) {
        return ''
    }
    if (companyDomain && companyDomain.toLowerCase().includes('autocracy')) {
        return ''
    }

    // ✅ CRITICAL FIX: Prioritize task's own projectCode field (set during creation)
    // This ensures correct display even if project parameter is null or incorrect
    const projectCode = project?.projectCode        // 1. Dynamic context (updates on project edit)
        || task.projectCode                         // 2. Cached static data (reliable fallback)
        || generateProjectCode(project?.name || '') // 3. Smart Derived
        || 'TASK'                                   // 4. Fallback

    // Use taskNumber if available (new sequential format)
    if (task.taskNumber !== undefined && task.taskNumber !== null) {
        return `${projectCode}-${task.taskNumber}`
    }

    // Legacy fallback: use first 4 characters of Firestore ID
    const shortId = task.id.slice(0, 4).toUpperCase()
    return `${projectCode}-${shortId}`
}

/**
 * Get full display info for a task, including parent info for subtasks.
 *
 * @param task - The current task
 * @param parentTask - Parent task (if this is a subtask)
 * @param project - Project for project code
 * @param companyId - Optional company ID for tenant-specific display (e.g. hide task ID for autocracy)
 * @returns TaskDisplayInfo object with displayId, isSubtask flag, and parentDisplayId
 */
export function getTaskDisplayInfo(
    task: GeneratedTask,
    parentTask: GeneratedTask | null,
    project?: { projectCode?: string; name?: string } | null,
    companyId?: string | null,
    companyDomain?: string | null
): TaskDisplayInfo {
    const displayId = formatTaskId(task, project, companyId, companyDomain)
    const isSubtask = !!task.parentTaskId

    return {
        displayId,
        isSubtask,
        parentDisplayId: parentTask ? formatTaskId(parentTask, project, companyId, companyDomain) : undefined
    }
}

/**
 * Check if a task has subtasks in a list of tasks.
 * 
 * @param parentId - The parent task ID to check
 * @param allTasks - All tasks in the project
 * @returns True if the task has subtasks
 */
export function hasSubtasks(parentId: string, allTasks: GeneratedTask[]): boolean {
    return allTasks.some(task => task.parentTaskId === parentId)
}

/**
 * Get subtasks for a given parent task.
 * 
 * @param parentId - The parent task ID
 * @param allTasks - All tasks in the project
 * @returns Array of subtasks
 */
export function getSubtasksForParent(parentId: string, allTasks: GeneratedTask[]): GeneratedTask[] {
    return allTasks.filter(task => task.parentTaskId === parentId)
}

/**
 * Get only parent tasks (tasks without a parentTaskId).
 * 
 * @param allTasks - All tasks in the project
 * @returns Array of parent tasks only
 */
export function getParentTasks(allTasks: GeneratedTask[]): GeneratedTask[] {
    return allTasks.filter(task => !task.parentTaskId)
}
