'use client'

// High-fidelity Recurring Task Detail view with interactive sidebar and multi-tabbed content.

import React, { useState, useEffect, useMemo } from 'react'
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
    Calendar,
    Clock,
    User,
    FileText,
    ArrowLeft,
    X,
    Pencil,
    History as HistoryIcon,
    Network,
    Loader2,
    AlertCircle,
    Save
} from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { format, parseISO } from 'date-fns'
import type { WorkspaceRecurringConfig, RecurringConfigVersion } from '@/types/recurring-task-schema'
import * as RecurringTaskService from '@/lib/services/recurring-tasks/recurring-task-service'
import { useAuthStore } from '@/store/authStore'
import { useCompany } from '@/contexts/CompanyContext'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface RecurringTaskDetailDialogProps {
    config: WorkspaceRecurringConfig | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onEdit?: (config: WorkspaceRecurringConfig) => void
    users?: any[]
    projects?: { id: string; name: string; projectCode?: string }[]
}

export function RecurringTaskDetailDialog({
    config,
    open,
    onOpenChange,
    onEdit,
    users = [],
    projects = [],
}: RecurringTaskDetailDialogProps) {
    const { groupId, companyId } = useCompany()
    const { user } = useAuthStore()
    const [activeTab, setActiveTab] = useState('details')
    const [versions, setVersions] = useState<RecurringConfigVersion[]>([])
    const [loadingVersions, setLoadingVersions] = useState(false)

    // Editing State
    const [isEditingDescription, setIsEditingDescription] = useState(false)
    const [editingDescription, setEditingDescription] = useState('')
    const [isUpdating, setIsUpdating] = useState(false)
    const [isSavingDescription, setIsSavingDescription] = useState(false)

    // Sync editing description when config changes
    useEffect(() => {
        if (config?.taskDefinition.description) {
            setEditingDescription(config.taskDefinition.description)
        }
    }, [config])

    // Derived: Candidates for position-based assignment
    const candidates = useMemo(() => {
        if (!config || config.assignment.type !== 'position') return []
        const posId = config.assignment.value
        const posName = (config.assignment.positionName || '').trim().toLowerCase()

        return users.filter(u => {
            if (posId && u.positionId === posId) return true
            if (!posName) return false
            const uPos = (u.positionName || u.position || '').trim().toLowerCase()
            return uPos === posName
        })
    }, [config, users])

    // Load version history (Real-time) when tab changes to history
    useEffect(() => {
        if (open && config && activeTab === 'history' && companyId) {
            setLoadingVersions(true)
            const unsubscribe = RecurringTaskService.subscribeConfigVersions(
                config.id,
                companyId,
                (history) => {
                    setVersions(history)
                    setLoadingVersions(false)
                },
                (error) => {
                    console.error('Failed to subscribe to version history:', error)
                    setLoadingVersions(false)
                },
                groupId || undefined
            )
            return () => unsubscribe()
        }
    }, [open, config?.id, activeTab, companyId, groupId])

    const handleUpdateStatus = async (isActive: boolean) => {
        if (!config || !companyId || !user) return
        setIsUpdating(true)
        try {
            await RecurringTaskService.toggleConfigActive(config.id, companyId, user.id, groupId || undefined)
            toast.success(`Schedule ${isActive ? 'resumed' : 'paused'}`)
        } catch (error) {
            toast.error('Failed to update status')
        } finally {
            setIsUpdating(false)
        }
    }

    const handleUpdatePriority = async (priority: string) => {
        if (!config || !companyId || !user) return
        setIsUpdating(true)
        try {
            await RecurringTaskService.updateRecurringConfig({
                configId: config.id,
                companyId,
                userId: user.id,
                updates: {
                    taskDefinition: {
                        ...config.taskDefinition,
                        priority: priority as any
                    }
                },
                changeReason: `Priority updated to ${priority}`,
                groupId: groupId || undefined
            })
            toast.success('Priority updated')
        } catch (error) {
            toast.error('Failed to update priority')
        } finally {
            setIsUpdating(false)
        }
    }

    const handleSaveDescription = async () => {
        if (!config || !companyId || !user) return
        setIsSavingDescription(true)
        try {
            await RecurringTaskService.updateRecurringConfig({
                configId: config.id,
                companyId,
                userId: user.id,
                updates: {
                    taskDefinition: {
                        ...config.taskDefinition,
                        description: editingDescription
                    }
                },
                changeReason: 'Description updated',
                groupId: groupId || undefined
            })
            toast.success('Description updated')
            setIsEditingDescription(false)
        } catch (error) {
            toast.error('Failed to update description')
        } finally {
            setIsSavingDescription(false)
        }
    }

    if (!config) return null

    const project = projects.find(p => p.id === config.projectId)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] h-[95vh] p-0 flex flex-col gap-0 overflow-hidden [&>button]:hidden shadow-2xl border-none">
                <DialogTitle className="sr-only">{config.taskDefinition.title}</DialogTitle>

                {/* Header Section */}
                <div className="bg-white border-b sticky top-0 z-20">
                    <div className="flex items-center justify-between px-6 py-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onOpenChange(false)}
                                className="h-8 w-8 text-gray-400 hover:text-gray-900"
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <Badge variant="secondary" className="font-bold text-[11px] h-6 bg-slate-100 text-slate-700 border-none px-2 rounded-md">
                                    {project?.projectCode || 'PROJ'}-{config.id.slice(0, 4).toUpperCase()}
                                </Badge>
                                <span className="text-gray-300">/</span>
                                <Badge variant="secondary" className="font-bold text-[11px] h-6 bg-slate-100 text-slate-700 border-none px-2 rounded-md">
                                    CONFIG-{config.id.slice(0, 4).toUpperCase()}
                                </Badge>
                            </div>
                            <h2 className="text-lg font-bold text-gray-900 ml-2">
                                {config.taskDefinition.title}
                            </h2>
                        </div>
                        <div className="flex items-center gap-2">

                            {onEdit && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 gap-2 font-medium text-blue-600 hover:text-blue-700"
                                    onClick={() => onEdit(config)}
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                    Edit
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onOpenChange(false)}
                                className="h-8 w-8 text-gray-400 hover:text-gray-900 ml-2"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Side - Main Content */}
                    <div className="flex-1 overflow-y-auto p-8 bg-[#f9fafb]">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="mb-6 bg-slate-200/50 p-1 rounded-lg h-auto gap-1 inline-flex w-auto border-none">
                                <TabsTrigger value="details" className="px-4 py-1.5 rounded-md text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all border-none bg-transparent">
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4" />
                                        Details
                                    </div>
                                </TabsTrigger>
                                <TabsTrigger value="schedule" className="px-4 py-1.5 rounded-md text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all border-none bg-transparent text-slate-500 hover:text-slate-700">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        Scheduling
                                    </div>
                                </TabsTrigger>
                                <TabsTrigger value="history" className="px-4 py-1.5 rounded-md text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all border-none bg-transparent text-slate-500 hover:text-slate-700">
                                    <div className="flex items-center gap-2">
                                        <HistoryIcon className="h-4 w-4" />
                                        History
                                    </div>
                                </TabsTrigger>
                            </TabsList>

                            <div className="mt-0">
                                <TabsContent value="details" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-bold text-gray-900">Description</h3>
                                            {!isEditingDescription && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 text-xs text-slate-500 hover:text-slate-900 font-medium"
                                                    onClick={() => {
                                                        setEditingDescription(config.taskDefinition.description || '')
                                                        setIsEditingDescription(true)
                                                    }}
                                                >
                                                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                                                    Edit
                                                </Button>
                                            )}
                                        </div>

                                        {isEditingDescription ? (
                                            <div className="space-y-2">
                                                <Textarea
                                                    value={editingDescription}
                                                    onChange={(e) => setEditingDescription(e.target.value)}
                                                    className="min-h-[150px] bg-white border-slate-200 focus:ring-primary/20 text-sm"
                                                    placeholder="Add task description..."
                                                />
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        size="sm"
                                                        onClick={handleSaveDescription}
                                                        className="h-8 bg-primary text-white hover:bg-primary/90"
                                                        disabled={isSavingDescription}
                                                    >
                                                        {isSavingDescription ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                                                        Save
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8"
                                                        onClick={() => setIsEditingDescription(false)}
                                                        disabled={isSavingDescription}
                                                    >
                                                        Cancel
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div
                                                className="bg-white rounded-lg border border-slate-200 p-4 text-sm text-slate-600 min-h-[120px] cursor-pointer hover:border-slate-300 transition-all leading-relaxed"
                                                onClick={() => setIsEditingDescription(true)}
                                            >
                                                {config.taskDefinition.description || 'No description provided for this recurring task configuration.'}
                                            </div>
                                        )}
                                    </div>

                                    <div className="border-t pt-6 space-y-4">
                                        <h3 className="text-sm font-bold text-gray-900">Details</h3>
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-medium text-slate-500">Estimated Hours:</label>
                                                <Input
                                                    type="number"
                                                    value={config.taskDefinition.estimatedHours || 0}
                                                    readOnly
                                                    className="h-9 bg-white border-slate-200 rounded-md"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="schedule" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="bg-white rounded-xl border p-6 shadow-sm space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-primary" />
                                                Recurrence Engine
                                            </h3>
                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 font-mono">
                                                {config.schedule.frequency.toUpperCase()}
                                            </Badge>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                                                <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Frequency</div>
                                                <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                                    {config.schedule.frequency.charAt(0).toUpperCase() + config.schedule.frequency.slice(1)}
                                                    {config.schedule.interval > 1 && ` (Every ${config.schedule.interval} units)`}
                                                </div>
                                            </div>
                                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                                                <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Next Generation</div>
                                                <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                                    <Clock className="h-3.5 w-3.5 text-primary" />
                                                    {config.nextRunAt ? format(parseISO(config.nextRunAt), 'MMM d, h:mm a') : 'Not scheduled'}
                                                </div>
                                            </div>
                                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                                                <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Execution Time</div>
                                                <div className="text-sm font-bold text-slate-800">
                                                    {config.schedule.timeOfDay || '00:00'} ({config.schedule.timezone})
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Recurrence Configuration</h4>
                                            <div className="bg-slate-50 p-4 rounded-lg border text-sm text-slate-600">
                                                {config.schedule.frequency === 'weekly' && config.schedule.weekDays && (
                                                    <div className="flex flex-wrap gap-2">
                                                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                                                            <div key={day} className={cn(
                                                                "px-3 py-1 rounded-full text-xs font-bold transition-all border",
                                                                config.schedule.weekDays?.includes(i)
                                                                    ? "bg-primary text-white border-primary shadow-sm"
                                                                    : "bg-white text-slate-300 border-slate-200"
                                                            )}>
                                                                {day}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {config.schedule.frequency === 'monthly' && (
                                                    <p>Triggered on <span className="font-bold text-slate-900">{config.schedule.monthDay || config.schedule.monthPosition?.week + ' ' + config.schedule.monthPosition?.weekday}</span> of every month.</p>
                                                )}
                                                {config.schedule.frequency === 'daily' && (
                                                    <p>Generates a new instance <span className="font-bold text-slate-900">every day</span> at {config.schedule.timeOfDay}.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="history" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="bg-white rounded-xl border p-6 shadow-sm">
                                        {loadingVersions ? (
                                            <div className="flex flex-col items-center py-12 gap-3">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
                                                <p className="text-sm text-slate-400">Retrieving audit logs...</p>
                                            </div>
                                        ) : versions.length === 0 ? (
                                            <div className="text-center py-12 text-muted-foreground">
                                                <HistoryIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                                <p>No modification records found.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                {versions.map((v, idx) => {
                                                    const prev = versions[idx + 1]
                                                    return (
                                                        <div key={v.id} className="flex gap-4">
                                                            <div className="flex flex-col items-center gap-2">
                                                                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold">
                                                                    v{(v.version || 1) - 1}
                                                                </div>
                                                                {idx !== versions.length - 1 && <div className="w-px flex-1 bg-slate-100" />}
                                                            </div>
                                                            <div className="flex-1 pb-6">
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <span className="text-sm font-bold text-gray-900">{v.changeReason || 'Config Updated'}</span>
                                                                    <span className="text-xs text-slate-400">{v.createdAt ? format(parseISO(v.createdAt), 'MMM d, h:mm a') : 'Unknown'}</span>
                                                                </div>
                                                                <div className="text-xs text-slate-500 mb-3">
                                                                    By {users.find(u => u.id === v.createdBy)?.name || v.createdBy}
                                                                </div>

                                                                {/* Changes Diff Log */}
                                                                {v.changedFields && v.changedFields.length > 0 && (
                                                                    <div className="bg-slate-50/80 rounded-lg p-3 space-y-2 border border-slate-100/60">
                                                                        {v.changedFields.map(field => {
                                                                            const getVal = (obj: any, path: string) => path.split('.').reduce((o, i) => o?.[i], obj)

                                                                            // Corrected logic:
                                                                            // v.snapshot is the state BEFORE this version's update
                                                                            // The state AFTER this update is either the current config (if this is the latest version)
                                                                            // or the snapshot of the NEXT newer version (versions[idx-1])
                                                                            const oldVal = getVal(v.snapshot, field)
                                                                            const newVal = idx === 0
                                                                                ? getVal(config, field)
                                                                                : getVal(versions[idx - 1]?.snapshot || v.snapshot, field)

                                                                            const formatVal = (val: any) => {
                                                                                if (val === null || val === undefined) return <span className="text-slate-300 italic">Empty</span>
                                                                                if (typeof val === 'boolean') return val ? 'True' : 'False'
                                                                                if (typeof val === 'object') return '{...}'
                                                                                return String(val)
                                                                            }

                                                                            // Clean up field names (remove technical prefixes)
                                                                            const prettyName = field
                                                                                .replace(/^taskDefinition\./, '')
                                                                                .replace(/^schedule\./, '')
                                                                                .replace(/^assignment\./, '')
                                                                                .replace(/([A-Z])/g, ' $1')
                                                                                .trim()
                                                                                .replace(/^\w/, (c) => c.toUpperCase())

                                                                            return (
                                                                                <div key={field} className="text-xs grid grid-cols-[120px_1fr] items-start gap-2">
                                                                                    <span className="font-semibold text-slate-500">{prettyName}:</span>
                                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                                        <span className="text-slate-400 line-through decoration-slate-300 decoration-2">{formatVal(oldVal)}</span>
                                                                                        <span className="text-slate-300">→</span>
                                                                                        <span className="text-slate-700 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-100 shadow-sm inline-block">
                                                                                            {formatVal(newVal)}
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>
                            </div>
                        </Tabs>
                    </div>

                    {/* Right Side - Attributes Sidebar */}
                    <div className="w-80 border-l bg-white p-6 overflow-y-auto space-y-8 flex-shrink-0 hidden lg:block shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">
                        {/* Status */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Status</label>
                            <Select
                                value={config.isActive ? 'active' : 'paused'}
                                onValueChange={(val) => handleUpdateStatus(val === 'active')}
                                disabled={isUpdating}
                            >
                                <SelectTrigger className={cn("w-full h-9 font-medium border text-slate-700 bg-slate-50/50 hover:bg-slate-50 transition-all", config.isActive ? "border-slate-200" : "border-yellow-200 bg-yellow-50/20")}>
                                    <SelectValue />
                                    {isUpdating && <Loader2 className="h-3 w-3 ml-2 animate-spin" />}
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active" className="text-sm font-medium">Assigned</SelectItem>
                                    <SelectItem value="paused" className="text-sm font-medium">Paused</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Priority */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Priority</label>
                            <Select
                                value={config.taskDefinition.priority}
                                onValueChange={handleUpdatePriority}
                                disabled={isUpdating}
                            >
                                <SelectTrigger className="w-full h-9 font-medium border border-slate-200 text-slate-700 bg-slate-50/50 hover:bg-slate-50 transition-all capitalize">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                    <SelectItem value="critical">Urgent</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Assignee */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assignee</label>
                            {config.assignment.type === 'position' ? (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 px-1">
                                        <Network className="h-3.5 w-3.5 text-purple-500" />
                                        {config.assignment.positionName}
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                        {candidates.length > 0 ? (
                                            <>
                                                {candidates.length > 1 ? (
                                                    <div className="flex items-center gap-3 p-2 bg-blue-50/30 rounded-md border border-blue-100/50">
                                                        <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-[10px]">
                                                            {candidates.length}
                                                        </div>
                                                        <div className="text-xs font-semibold text-blue-700">
                                                            {candidates.length} Users Assigned
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-3 p-2 bg-slate-50/50 rounded-md border border-slate-100">
                                                        <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-[10px]">
                                                            {candidates[0].name?.charAt(0) || 'U'}
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <div className="text-xs font-semibold text-slate-700 truncate">
                                                                {candidates[0].name}
                                                            </div>
                                                            {(candidates[0].position || candidates[0].positionName) && (
                                                                <div className="text-[9px] text-purple-500 font-medium uppercase tracking-wider truncate">
                                                                    {candidates[0].position || candidates[0].positionName}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Optional: Compact list of names if multiple */}
                                                {candidates.length > 1 && (
                                                    <div className="px-1 space-y-1">
                                                        {candidates.map(u => (
                                                            <div key={u.id} className="text-[10px] text-slate-500 flex items-center gap-2">
                                                                <div className="w-1 h-1 rounded-full bg-slate-300" />
                                                                {u.name}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="text-[10px] text-slate-400 italic px-1">No users in this position</div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 p-2 bg-slate-50/50 rounded-md border border-slate-100">
                                    <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-[10px]">
                                        {users.find(u => u.id === config.assignment.value)?.name?.charAt(0) || 'U'}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <div className="text-xs font-semibold text-slate-700">
                                            {users.find(u => u.id === config.assignment.value)?.name || 'Specified User'}
                                        </div>
                                        {users.find(u => u.id === config.assignment.value)?.position && (
                                            <div className="text-[9px] text-purple-500 font-medium uppercase tracking-wider">
                                                {users.find(u => u.id === config.assignment.value)?.position}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Dates */}
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block flex items-center">
                                    Start Date <span className="text-[9px] font-normal text-slate-300 ml-1">(Optional)</span>
                                </label>
                                <div className="h-9 px-3 py-2 text-xs border rounded-md flex items-center bg-slate-50/50 border-slate-200 text-slate-700 w-full">
                                    {config.schedule.startDate ? format(parseISO(config.schedule.startDate), 'MMM d, yyyy') : 'No start date'}
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Next Run</label>
                                <div className="relative">
                                    <div className={cn(
                                        "h-9 px-3 py-2 text-xs border rounded-md flex items-center bg-slate-50/50 border-slate-200 text-slate-700 w-full",
                                        config.nextRunAt && new Date(config.nextRunAt) < new Date() && "border-red-200 bg-red-50/30 text-red-900"
                                    )}>
                                        {config.nextRunAt ? format(parseISO(config.nextRunAt), 'MMM d, yyyy') : 'Not scheduled'}
                                    </div>
                                    {config.nextRunAt && new Date(config.nextRunAt) < new Date() && (
                                        <div className="flex items-center gap-1.5 text-[10px] text-red-500 mt-1.5 font-medium ml-1">
                                            <AlertCircle className="h-3 w-3" />
                                            Overdue
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Time Tracking */}
                        <div className="space-y-4">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Time Tracking</label>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500 font-medium">Estimated:</span>
                                    <span className="text-slate-900 font-bold">{config.taskDefinition.estimatedHours || 0}h</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500 font-medium">Logged:</span>
                                    <span className="text-slate-900 font-bold">0h</span>
                                </div>
                                <Button variant="outline" size="sm" className="w-full h-8 text-slate-600 font-semibold mt-1">
                                    <Clock className="h-3.5 w-3.5 mr-2" />
                                    Log Time
                                </Button>
                            </div>
                        </div>

                        {/* Metadata Info */}
                        <div className="pt-6 border-t border-slate-100 space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Created</label>
                            <div className="text-xs font-bold text-slate-800">
                                {format(parseISO(config.createdAt), 'MMM d, yyyy')}
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
