'use client'

import { useState, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useCalendarState } from './useCalendarState'
import { CalendarHeader } from './CalendarHeader'
import { CalendarGrid } from './CalendarGrid'
import { CalendarWeekView } from './CalendarWeekView'
import { TaskDetailDialog } from '@/components/issue/TaskDetailDialog'
import { TaskTemplateService } from '@/lib/services'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import type { GeneratedTask } from '@/types/task-template-schema'

// ============================================================================
// Types
// ============================================================================

interface CalendarViewProps {
    projectId: string
    workspaceId: string
    tasks: GeneratedTask[]
    onTasksChange?: () => void
}

// ============================================================================
// Component
// ============================================================================

export function CalendarView({
    projectId,
    workspaceId,
    tasks,
    onTasksChange,
}: CalendarViewProps) {
    // ============================================================================
    // Hooks
    // ============================================================================

    const calendarState = useCalendarState()
    const { companyId, groupId } = useCompany()
    const { user } = useAuthStore()

    // ============================================================================
    // State
    // ============================================================================

    const [selectedTask, setSelectedTask] = useState<GeneratedTask | null>(null)
    const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
    const [optimisticTasks, setOptimisticTasks] = useState<GeneratedTask[]>(tasks)

    // Use useEffect to sync props to state
    // This ensures we always start with fresh data from server but can override locally
    useEffect(() => {
        setOptimisticTasks(tasks)
    }, [tasks])

    // ============================================================================
    // Filtered Tasks (Based on Calendar Filters)
    // ============================================================================

    const filteredTasks = optimisticTasks.filter((task) => {
        const { filters } = calendarState

        if (filters.assignedToMe && task.assignedUserId !== user?.id) {
            return false
        }

        // Due this week filter
        if (filters.dueThisWeek && task.dueDate) {
            const taskDate = new Date(task.dueDate)
            const today = new Date()
            const weekFromNow = new Date()
            weekFromNow.setDate(today.getDate() + 7)
            if (taskDate < today || taskDate > weekFromNow) {
                return false
            }
        }

        // Date range filter
        if (task.dueDate) {
            const taskDate = new Date(task.dueDate)

            // Filter by start date
            if (filters.dateRangeStart) {
                const startDate = new Date(filters.dateRangeStart)
                if (taskDate < startDate) {
                    return false
                }
            }

            // Filter by end date
            if (filters.dateRangeEnd) {
                const endDate = new Date(filters.dateRangeEnd)
                endDate.setHours(23, 59, 59, 999) // Include the full end date
                if (taskDate > endDate) {
                    return false
                }
            }
        } else {
            // If task has no due date and date range is set, exclude it
            if (filters.dateRangeStart || filters.dateRangeEnd) {
                return false
            }
        }

        return true
    })

    // ============================================================================
    // Handlers
    // ============================================================================

    const handleTaskClick = useCallback((task: GeneratedTask) => {
        setSelectedTask(task)
        setIsTaskDialogOpen(true)
    }, [])

    const handleTaskDialogClose = useCallback(() => {
        setIsTaskDialogOpen(false)
        setSelectedTask(null)
    }, [])

    const handleQuickAddSubmit = useCallback(async (title: string, dueDate: string) => {
        if (!companyId || !projectId || !user?.id) {
            toast.error('Missing required context')
            return
        }

        try {
            // Create minimal task via service using createManualTask
            await TaskTemplateService.createManualTask(companyId, user.id, {
                title,
                description: '',
                priority: 'medium' as const,
                estimatedHours: 0,
                dueDate,
                projectId,
            }, groupId ?? undefined)

            toast.success('Task created successfully!')
            onTasksChange?.() // Refresh tasks list
        } catch (error) {
            console.error('Failed to create task:', error)
            toast.error('Failed to create task')
            throw error // Re-throw to handle in QuickAddForm
        }
    }, [companyId, projectId, user, onTasksChange, groupId])

    const handleTaskUpdate = useCallback(async (updatedTask: GeneratedTask) => {
        if (!companyId) {
            toast.error('Missing company context')
            return
        }

        try {
            // Update task status (the dialog handles full updates internally)
            if (updatedTask.status) {
                await TaskTemplateService.updateTaskStatus(
                    companyId,
                    updatedTask.id,
                    updatedTask.status,
                    undefined,
                    undefined,
                    false,
                    groupId ?? undefined
                )
            }
            toast.success('Task updated!')
            onTasksChange?.()
        } catch (error) {
            console.error('Failed to update task:', error)
            toast.error('Failed to update task')
        }
    }, [companyId, onTasksChange])

    const handleTaskDrop = useCallback(async (taskId: string, newDueDate: string) => {
        if (!companyId) {
            toast.error('Missing company context')
            return
        }

        // 1. Optimistic Update
        const originalTasks = [...optimisticTasks]
        setOptimisticTasks(prev => prev.map(task =>
            task.id === taskId
                ? { ...task, dueDate: newDueDate }
                : task
        ))

        try {
            // 2. API Call
            const { doc, updateDoc } = await import('firebase/firestore')
            const { db } = await import('@/lib/firebase')

            const { companySubcollectionPathSegments } = await import('@/lib/firestore-paths')
            const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
            const taskRef = doc(db, segments[0], ...segments.slice(1), taskId)
            await updateDoc(taskRef, {
                dueDate: newDueDate,
                updatedAt: new Date().toISOString(),
            })

            toast.success('Task rescheduled!')
            onTasksChange?.()
        } catch (error) {
            // 3. Revert on Error
            console.error('Failed to reschedule task:', error)
            toast.error('Failed to reschedule task')
            setOptimisticTasks(originalTasks)
        }
    }, [companyId, onTasksChange, optimisticTasks])

    // ============================================================================
    // Render
    // ============================================================================

    return (
        <div
            className="flex-1 flex flex-col min-h-0 gap-2"
            data-testid="calendar-view"
        >
            {/* Calendar Header */}
            <CalendarHeader calendarState={calendarState} />

            {/* Main Content Area */}
            <div className="flex-1 min-h-0 relative">
                {/* Month View */}
                {calendarState.viewMode === 'month' && (
                    <CalendarGrid
                        calendarState={calendarState}
                        tasks={filteredTasks}
                        projectId={projectId}
                        onTaskClick={handleTaskClick}
                        onQuickAddSubmit={handleQuickAddSubmit}
                        onTaskDrop={handleTaskDrop}
                    />
                )}

                {/* Week View */}
                {calendarState.viewMode === 'week' && (
                    <CalendarWeekView
                        calendarState={calendarState}
                        tasks={filteredTasks}
                        projectId={projectId}
                        onTaskClick={handleTaskClick}
                        onQuickAddSubmit={handleQuickAddSubmit}
                    />
                )}
            </div>

            {/* Task Detail Dialog */}
            {selectedTask && (
                <TaskDetailDialog
                    task={selectedTask}
                    groupId={groupId ?? undefined}
                    open={isTaskDialogOpen}
                    onOpenChange={(open) => !open && handleTaskDialogClose()}
                    onUpdate={handleTaskUpdate}
                />
            )}
        </div>
    )
}
