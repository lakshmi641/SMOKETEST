'use client'

/**
 * Main Recurring Task Sidebar (Drawer)
 * A single-page form for creating or editing recurring task configurations.
 */

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Drawer,
    DrawerContent,
    DrawerFooter,
} from '@/components/ui/drawer'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Loader2, Plus, Calendar, User as UserIcon, Settings, Target, CheckSquare, Shield, FileCheck, Trash2, X } from 'lucide-react'
import { ScheduleStep } from './ScheduleStep'
import { AssignmentStep } from './AssignmentStep'
import { MemberSelect } from '@/components/common/MemberSelect'
import type {
    WorkspaceRecurringConfig,
    TaskDefinition,
    RecurrenceSchedule,
    TaskAssignment,
} from '@/types/recurring-task-schema'
import type { EnhancedProject } from '@/types/project-schema'

interface RecurringTaskDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSave: (config: Partial<WorkspaceRecurringConfig>) => Promise<void>
    initialData?: Partial<WorkspaceRecurringConfig>
    workspaceId: string
    companyId: string
    users?: any[] // Support full User objects
    positions?: any[] // Full Position objects including reporting info
    projects?: EnhancedProject[]
    departments?: { id: string; name: string }[]
    title?: string
    onDraftChange?: (config: Partial<WorkspaceRecurringConfig>) => void
    isLoading?: boolean
}

const OPTIONAL_SELECT_NONE = '__none__' as const

export function RecurringTaskDialog({
    open,
    onOpenChange,
    onSave,
    initialData,
    workspaceId,
    companyId,
    users = [],
    positions = [],
    projects = [],
    departments = [],
    title = 'Create Recurring Task',
    onDraftChange,
    isLoading,
}: RecurringTaskDialogProps) {
    const [isSaving, setIsSaving] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})



    // Form State
    const [taskDefinition, setTaskDefinition] = useState<TaskDefinition>({
        title: initialData?.taskDefinition?.title || '',
        description: initialData?.taskDefinition?.description || '',
        priority: initialData?.taskDefinition?.priority || 'medium',
        estimatedHours: initialData?.taskDefinition?.estimatedHours || 0,
        taskType: initialData?.taskDefinition?.taskType || '',
        requirementType: initialData?.taskDefinition?.requirementType || '',
        reporter: initialData?.taskDefinition?.reporter || '',
        reporterName: initialData?.taskDefinition?.reporterName || '',
    })

    const [projectId, setProjectId] = useState<string>(initialData?.projectId || '')

    const [schedule, setSchedule] = useState<RecurrenceSchedule>({
        frequency: initialData?.schedule?.frequency || 'daily',
        interval: initialData?.schedule?.interval || 1,
        timeOfDay: initialData?.schedule?.timeOfDay || '09:00',
        timezone: initialData?.schedule?.timezone || 'Asia/Kolkata',
        startDate: (initialData?.schedule?.startDate || new Date().toISOString()).split('T')[0] || '',
        dueDays: initialData?.schedule?.dueDays || 0,
        endCondition: initialData?.schedule?.endCondition || { type: 'never' },
        weekDays: initialData?.schedule?.weekDays,
        monthDay: initialData?.schedule?.monthDay,
        monthPosition: initialData?.schedule?.monthPosition,
        isLastDayOfMonth: initialData?.schedule?.isLastDayOfMonth || false,
        yearlyMonth: initialData?.schedule?.yearlyMonth || 0,
    })

    const [assignment, setAssignment] = useState<TaskAssignment>({
        type: initialData?.assignment?.type || 'specific_user',
        value: initialData?.assignment?.value || '',
        rotationEnabled: initialData?.assignment?.rotationEnabled || false,
        autoAssigned: initialData?.assignment?.autoAssigned || false,
    })

    const teamOptions = React.useMemo(() => {
        const teams = new Set<string>()
        if (users) {
            users.forEach(user => {
                if (Array.isArray(user.spocTeams)) {
                    user.spocTeams
                        .filter((team: string): team is string => typeof team === 'string' && team.trim().length > 0)
                        .forEach((team: string) => teams.add(team))
                }
            })
        }
        return Array.from(teams).sort((a, b) => a.localeCompare(b))
    }, [users])

    // Default project selection if empty
    useEffect(() => {
        if (!projectId && projects && projects.length > 0 && !initialData?.id) {
            const firstId = projects[0]?.id;
            if (firstId) setProjectId(firstId);
        }
    }, [projects, projectId, initialData?.id])

    // Reset when initialData changes (for Edit mode)
    useEffect(() => {
        if (initialData) {
            setTaskDefinition({
                title: initialData.taskDefinition?.title || '',
                description: initialData.taskDefinition?.description || '',
                priority: initialData.taskDefinition?.priority || 'medium',
                estimatedHours: initialData.taskDefinition?.estimatedHours || 0,
                taskType: initialData.taskDefinition?.taskType || '',
                requirementType: initialData.taskDefinition?.requirementType || '',
                reporter: initialData.taskDefinition?.reporter || '',
                reporterName: initialData.taskDefinition?.reporterName || '',
            })
            setProjectId(initialData.projectId || '')
            setSchedule({
                frequency: initialData.schedule?.frequency || 'daily',
                interval: initialData.schedule?.interval || 1,
                timeOfDay: initialData.schedule?.timeOfDay || '09:00',
                timezone: (initialData.schedule?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC') as string,
                startDate: (initialData.schedule?.startDate || new Date().toISOString()).split('T')[0] || '',
                dueDays: initialData.schedule?.dueDays || 0,
                endCondition: initialData.schedule?.endCondition || { type: 'never' },
                weekDays: initialData.schedule?.weekDays,
                monthDay: initialData.schedule?.monthDay,
                monthPosition: initialData.schedule?.monthPosition,
            })
            setAssignment({
                type: initialData.assignment?.type || 'specific_user',
                value: initialData.assignment?.value || '',
                rotationEnabled: initialData.assignment?.rotationEnabled || false,
                autoAssigned: initialData.assignment?.autoAssigned || false,
            })
        }
    }, [initialData])

    // Sync draft updates to parent
    useEffect(() => {
        if (open && !initialData?.id && taskDefinition.title) {
            onDraftChange?.({
                taskDefinition,
                schedule,
                assignment,
                projectId,
                workspaceId,
            })
        }
    }, [taskDefinition, schedule, assignment, projectId, open, initialData?.id])

    const validate = () => {
        const newErrors: Record<string, string> = {}
        if (!taskDefinition.title) newErrors.title = 'Title is required'
        if (!projectId) newErrors.projectId = 'Project is required'
        if (!taskDefinition.taskType) newErrors.taskType = 'Task type is required'
        if (!taskDefinition.requirementType) newErrors.requirementType = 'Requirement type is required'
        if (schedule.frequency === 'weekly' && (!schedule.weekDays || schedule.weekDays.length === 0)) {
            newErrors.frequency = 'Weekly frequency requires at least one weekday'
        }
        // Removed assignment matching - allow ghosted tasks
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSave = async () => {
        if (!validate()) return

        try {
            setIsSaving(true)
            await onSave({
                taskDefinition,
                schedule,
                assignment,
                projectId,
                workspaceId,
            })
            localStorage.removeItem(`recurring_task_draft_${workspaceId}`)
            onOpenChange(false)
        } catch (error) {
            console.error('Error saving recurring task:', error)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            title={initialData?.id ? 'Edit Recurring Task' : 'Create Recurring Task'}
            description={initialData?.id ? 'Update your recurring task configuration' : 'Configure a new automated recurring task'}
        >
            <DrawerContent className="pb-32">
                <div className="space-y-8 max-w-2xl mx-auto">
                    {/* SECTION 1: TASK DETAILS */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 text-primary">
                            <Target className="w-5 h-5" />
                            <h3 className="font-semibold text-lg">Task Details</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Task Title *</Label>
                                <Input
                                    id="title"
                                    placeholder="e.g. Weekly Status Report"
                                    value={taskDefinition.title}
                                    onChange={(e) => setTaskDefinition(prev => ({ ...prev, title: e.target.value }))}
                                    className={errors.title ? 'border-red-500 ring-red-500' : ''}
                                />
                                {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    placeholder="What needs to be done every time this task runs?"
                                    value={taskDefinition.description || ''}
                                    onChange={(e) => setTaskDefinition(prev => ({ ...prev, description: e.target.value }))}
                                    rows={3}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="projectId">Target Project *</Label>
                                <Select
                                    value={projectId}
                                    onValueChange={setProjectId}
                                >
                                    <SelectTrigger className={errors.projectId ? 'border-red-500 ring-red-500' : ''}>
                                        <SelectValue placeholder="Select Project" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {projects.map(p => (
                                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.projectId && <p className="text-xs text-red-500 mt-1">{errors.projectId}</p>}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="reporter">Reporter</Label>
                                <MemberSelect
                                    value={taskDefinition.reporter ? {
                                        type: (users.find(u => u.id === taskDefinition.reporter) || taskDefinition.reporter === 'current_user') ? 'user' : 'position',
                                        id: taskDefinition.reporter,
                                        label: taskDefinition.reporterName || (users.find(u => u.id === taskDefinition.reporter)?.name || (taskDefinition.reporter === 'current_user' ? 'Myself (Current User)' : 'Unknown')),
                                    } : undefined}
                                    onValueChange={(val) => {
                                        if (val) {
                                            setTaskDefinition(prev => ({
                                                ...prev,
                                                reporter: val.id,
                                                reporterName: val.label // Store the name for display
                                            }))
                                        } else {
                                            setTaskDefinition(prev => ({ ...prev, reporter: '', reporterName: '' }))
                                        }
                                    }}
                                    workspaceId={workspaceId}
                                    placeholder="Select Reporter..."
                                    className="w-full"
                                />
                                <p className="text-[10px] text-muted-foreground">defaults to the creator</p>
                            </div>

                        </div>


                        {/* Task Type & Requirement Type */}
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="taskType">Task Type <span className="text-destructive">*</span></Label>
                                <Select
                                    value={taskDefinition.taskType || ''}
                                    onValueChange={(val) => setTaskDefinition(prev => ({ ...prev, taskType: val }))}
                                >
                                    <SelectTrigger className={errors.taskType ? 'border-red-500 ring-red-500' : ''}>
                                        <SelectValue placeholder="Select task type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Feature">Feature</SelectItem>
                                        <SelectItem value="Bug">Bug</SelectItem>
                                        <SelectItem value="Improvement">Improvement</SelectItem>
                                        <SelectItem value="Maintenance">Maintenance</SelectItem>
                                        <SelectItem value="Research">Research</SelectItem>
                                    </SelectContent>
                                </Select>
                                {errors.taskType && <p className="text-xs text-red-500 mt-1">{errors.taskType}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="requirementType">Requirement Type <span className="text-destructive">*</span></Label>
                                <Select
                                    value={taskDefinition.requirementType || ''}
                                    onValueChange={(val) => setTaskDefinition(prev => ({ ...prev, requirementType: val }))}
                                >
                                    <SelectTrigger className={errors.requirementType ? 'border-red-500 ring-red-500' : ''}>
                                        <SelectValue placeholder="Select requirement type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Functional">Functional</SelectItem>
                                        <SelectItem value="Non-Functional">Non-Functional</SelectItem>
                                        <SelectItem value="Compliance">Compliance</SelectItem>
                                        <SelectItem value="Security">Security</SelectItem>
                                        <SelectItem value="Performance">Performance</SelectItem>
                                    </SelectContent>
                                </Select>
                                {errors.requirementType && <p className="text-xs text-red-500 mt-1">{errors.requirementType}</p>}
                            </div>
                        </div>

                        <Separator className="my-2" />

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="priority">Priority</Label>
                                <Select
                                    value={taskDefinition.priority}
                                    onValueChange={(val) => setTaskDefinition(prev => ({ ...prev, priority: val as any }))}
                                >
                                    <SelectTrigger id="priority">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="urgent">Urgent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="estimatedHours">Est. Hours</Label>
                                <Input
                                    id="estimatedHours"
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={taskDefinition.estimatedHours || 0}
                                    onChange={(e) => setTaskDefinition(prev => ({ ...prev, estimatedHours: parseFloat(e.target.value) || 0 }))}
                                />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* SECTION 2: SCHEDULE */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 text-primary">
                            <Calendar className="w-5 h-5" />
                            <h3 className="font-semibold text-lg">Frequency & Timing</h3>
                        </div>
                        <div className="bg-muted/30 p-4 rounded-xl border border-dashed">
                            <ScheduleStep
                                schedule={schedule}
                                onChange={setSchedule}
                                errors={errors}
                            />
                        </div>
                    </div>

                    <Separator />

                    {/* SECTION 3: ASSIGNMENT */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 text-primary">
                            <UserIcon className="w-5 h-5" />
                            <h3 className="font-semibold text-lg">Assignment Strategy</h3>
                        </div>
                        <div className="bg-muted/30 p-4 rounded-xl border border-dashed">
                            <AssignmentStep
                                assignment={assignment}
                                onChange={setAssignment}
                                users={users}
                                positions={positions}
                                loading={isLoading}
                                errors={errors}
                            />
                        </div>
                    </div>
                </div>

                <DrawerFooter className="bg-background/80 backdrop-blur-md border-t fixed bottom-0 left-0 right-0 z-50">
                    <div className="max-w-2xl mx-auto w-full flex justify-end gap-2 p-4">
                        <Button
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            disabled={isSaving}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="min-w-[120px] bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                initialData?.id ? 'Update Config' : 'Create Task Config'
                            )}
                        </Button>
                    </div>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    )
}
