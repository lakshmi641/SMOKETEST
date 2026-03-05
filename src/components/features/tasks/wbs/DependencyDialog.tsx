
import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { GeneratedTask } from '@/types/task-template-schema'
import { formatTaskId } from '@/lib/utils/task-display'
import { Check, ChevronsUpDown, Search, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'

const DEP_TYPE_LABELS = {
    'FS': 'Finish to Start',
    'SS': 'Start to Start',
    'FF': 'Finish to Finish',
    'SF': 'Start to Finish'
}

import { Pencil } from 'lucide-react'

interface DependencyDialogProps {
    isOpen: boolean
    onClose: () => void
    sourceTask: GeneratedTask
    project?: any
    availableTasks: GeneratedTask[]
    initialEditTaskId?: string | null
    onSave: (targetId: string, type: 'FS' | 'SS' | 'FF' | 'SF', lag: number, originalTargetId?: string | null) => void
    onDelete: (targetId: string) => void
    /** When set (e.g. autocracy), task ID is hidden in UI */
    companyId?: string | null
    /** Company domain (e.g. autocracy.com) when company ID is Firestore auto-id */
    companyDomain?: string | null
}

export function DependencyDialog({ isOpen, onClose, sourceTask, project, availableTasks, initialEditTaskId, onSave, onDelete, companyId, companyDomain }: DependencyDialogProps) {
    const [targetId, setTargetId] = useState<string>('')
    const [type, setType] = useState<'FS' | 'SS' | 'FF' | 'SF'>('FS')
    const [lag, setLag] = useState<number>(0)
    const [isIdPickerOpen, setIsIdPickerOpen] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [originalTargetId, setOriginalTargetId] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')

    // Handle initial edit mode
    React.useEffect(() => {
        if (isOpen && initialEditTaskId) {
            const dep = sourceTask.dependencies?.find(d => d.targetTaskId === initialEditTaskId)
            if (dep) {
                setTargetId(dep.targetTaskId)
                setOriginalTargetId(dep.targetTaskId)
                setType(dep.type)
                setLag(dep.lag)
                setIsEditing(true)
            }
        } else if (isOpen) {
            // Reset if opening fresh
            setTargetId('')
            setOriginalTargetId(null)
            setLag(0)
            setType('FS')
            setIsEditing(false)
        }
    }, [isOpen, initialEditTaskId, sourceTask.dependencies])

    const handleSave = () => {
        if (!targetId) return
        onSave(targetId, type, lag, isEditing ? originalTargetId : null)
        setTargetId('') // Reset form
        setOriginalTargetId(null)
        setLag(0)
        setIsEditing(false)
        onClose() // Auto-close after saving
    }

    const startEditing = (dep: any) => {
        setTargetId(dep.targetTaskId)
        setOriginalTargetId(dep.targetTaskId)
        setType(dep.type)
        setLag(dep.lag)
        setIsEditing(true)
    }

    const cancelEditing = () => {
        setTargetId('')
        setOriginalTargetId(null)
        setLag(0)
        setIsEditing(false)
    }

    const filteredTasks = availableTasks
        .filter(t => t.id !== sourceTask.id)
        .sort((a, b) => {
            if (a.taskNumber && b.taskNumber) {
                return a.taskNumber - b.taskNumber
            }
            return a.id.localeCompare(b.id)
        })

    const filteredAndSearchedTasks = filteredTasks.filter(task => {
        if (!searchQuery.trim()) return true
        const searchLower = searchQuery.toLowerCase()
        const taskId = formatTaskId(task, project, companyId ?? undefined).toLowerCase()
        const taskTitle = task.title.toLowerCase()
        return taskId.includes(searchLower) || taskTitle.includes(searchLower)
    })

    const existingDeps = sourceTask.dependencies || []

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <style>
                {`
                    .custom-scrollbar::-webkit-scrollbar {
                        width: 8px !important;
                        display: block !important;
                    }
                    .custom-scrollbar::-webkit-scrollbar-track {
                        background: #f1f5f9 !important;
                        border-radius: 4px !important;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                        background: #cbd5e1 !important;
                        border-radius: 4px !important;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                        background: #94a3b8 !important;
                    }
                    .custom-scrollbar {
                        scrollbar-width: thin !important;
                        scrollbar-color: #cbd5e1 #f1f5f9 !important;
                    }
                `}
            </style>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
                <style>
                    {`
                        .dependency-dialog-header {
                            padding: 24px 24px 16px 24px;
                        }
                        .dependency-dialog-body {
                            padding: 0 24px 24px 24px;
                        }
                        .section-title {
                            font-size: 12px;
                            font-weight: 600;
                            color: #94a3b8;
                            text-transform: uppercase;
                            letter-spacing: 0.025em;
                            margin-bottom: 12px;
                        }
                        .existing-link-card {
                            background: white;
                            border: 1px solid #e2e8f0;
                            border-radius: 12px;
                            padding: 16px;
                            margin-bottom: 12px;
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            transition: all 0.2s ease;
                        }
                        .existing-link-card:hover {
                            border-color: #cbd5e1;
                            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
                        }
                        .add-link-btn {
                            background-color: #96D6B0 !important;
                            color: white !important;
                            border-radius: 8px !important;
                            padding: 8px 24px !important;
                            height: auto !important;
                            font-weight: 600 !important;
                        }
                        .add-link-btn:hover {
                            background-color: #7fca9d !important;
                        }
                        .add-link-btn:disabled {
                            background-color: #d1d5db !important;
                            opacity: 0.7;
                        }
                    `}
                </style>
                <div className="relative">
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors z-50"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    <div className="dependency-dialog-header">
                        <DialogTitle className="text-[22px] font-bold text-[#1e293b] leading-tight pr-8">
                            Manage Dependencies for {sourceTask.title}
                        </DialogTitle>
                    </div>

                    <div className="dependency-dialog-body space-y-8">
                        {/* EXISTING LIST */}
                        <div>
                            <h4 className="section-title">Existing Links</h4>
                            <div className="max-h-[220px] overflow-y-auto pr-1">
                                {existingDeps.length > 0 ? (
                                    existingDeps.map((dep, idx) => {
                                        const tTask = availableTasks.find(t => t.id === dep.targetTaskId)
                                        return (
                                            <div key={idx} className="existing-link-card">
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    {formatTaskId(tTask || { id: dep.targetTaskId } as any, project, companyId ?? undefined) ? (
                                                        <span className="text-blue-600 font-bold text-[11px] font-mono whitespace-nowrap px-2 py-1 bg-blue-50 border border-blue-100 rounded-md">
                                                            {formatTaskId(tTask || { id: dep.targetTaskId } as any, project, companyId ?? undefined)}
                                                        </span>
                                                    ) : null}
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="font-bold text-[#1e293b] text-sm truncate">
                                                            {tTask?.title || 'Unknown Task'}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                                                            <span>{DEP_TYPE_LABELS[dep.type as keyof typeof DEP_TYPE_LABELS] || dep.type}</span>
                                                            <span className="text-slate-300">•</span>
                                                            <span>{dep.lag}d Lag</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0 ml-4">
                                                    <button
                                                        className="text-slate-400 hover:text-blue-600 transition-colors"
                                                        onClick={() => startEditing(dep)}
                                                        title="Edit Dependency"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        className="text-red-500 hover:text-red-700 text-sm font-semibold transition-colors"
                                                        onClick={() => onDelete(dep.targetTaskId)}
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })
                                ) : (
                                    <div className="text-sm text-slate-400 italic py-4 text-center bg-slate-50/50 rounded-xl border border-dashed">
                                        No existing dependencies found.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ADD / EDIT FORM */}
                        <div className={cn(
                            "space-y-6 pt-6 border-t border-slate-100",
                            isEditing && "relative"
                        )}>
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="section-title mb-0">
                                    {isEditing ? "Modify Dependency" : "Add New Dependency"}
                                </h4>
                                {isEditing && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-500 hover:text-slate-900" onClick={cancelEditing}>
                                        Cancel Edit
                                    </Button>
                                )}
                            </div>

                            <div className="space-y-5">
                                <div className="grid grid-cols-12 items-center gap-4">
                                    <Label className="col-span-4 text-sm font-bold text-[#1e293b]">Predecessor</Label>
                                    <div className="col-span-8">
                                        <Popover open={isIdPickerOpen} onOpenChange={setIsIdPickerOpen} modal={false}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={isIdPickerOpen}
                                                    className="w-full justify-between font-normal text-slate-600 bg-white border-slate-200 h-10 rounded-lg hover:bg-slate-50 transition-all text-left truncate"
                                                >
                                                    {targetId ? (
                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                            {formatTaskId(availableTasks.find(t => t.id === targetId)!, project, companyId ?? undefined, companyDomain ?? undefined) && (
                                                                <span className="text-blue-600 font-bold text-[10px] font-mono shrink-0">
                                                                    {formatTaskId(availableTasks.find(t => t.id === targetId)!, project, companyId ?? undefined, companyDomain ?? undefined)}
                                                                </span>
                                                            )}
                                                            <span className="text-gray-900 truncate">
                                                                {availableTasks.find(t => t.id === targetId)?.title}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400">Select task...</span>
                                                    )}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent
                                                className="w-[400px] p-0"
                                                align="end"
                                                style={{ zIndex: 9999 }}
                                            >
                                                <div className="w-full border shadow-xl rounded-xl bg-white overflow-hidden">
                                                    <div className="flex items-center border-b px-3 bg-slate-50/50">
                                                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-40" />
                                                        <input
                                                            autoFocus
                                                            type="text"
                                                            placeholder="Search tasks by ID or title..."
                                                            className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-slate-400"
                                                            value={searchQuery}
                                                            onChange={(e) => setSearchQuery(e.target.value)}
                                                        />
                                                    </div>

                                                    <div className="overflow-y-auto max-h-[300px]">
                                                        {filteredAndSearchedTasks.length === 0 ? (
                                                            <div className="py-8 text-center text-sm text-slate-400">No tasks found.</div>
                                                        ) : (
                                                            filteredAndSearchedTasks.map((task) => (
                                                                <div
                                                                    key={task.id}
                                                                    onClick={() => {
                                                                        setTargetId(task.id)
                                                                        setIsIdPickerOpen(false)
                                                                    }}
                                                                    className={cn(
                                                                        "flex items-center gap-2 p-3 cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0",
                                                                        targetId === task.id && "bg-blue-50/50"
                                                                    )}
                                                                >
                                                                    <div className={cn(
                                                                        "w-4 h-4 rounded-full border flex items-center justify-center shrink-0",
                                                                        targetId === task.id ? "border-blue-500 bg-blue-500" : "border-slate-300"
                                                                    )}>
                                                                        {targetId === task.id && <Check className="h-2.5 w-2.5 text-white" />}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                                        {formatTaskId(task, project, companyId ?? undefined, companyDomain ?? undefined) ? (
                                                                            <span className="text-blue-600 font-bold text-[10px] font-mono whitespace-nowrap px-1.5 py-0.5 bg-blue-50 border border-blue-100 rounded">
                                                                                {formatTaskId(task, project, companyId ?? undefined, companyDomain ?? undefined)}
                                                                            </span>
                                                                        ) : null}
                                                                        <span className="text-[13px] text-slate-700 truncate font-medium">{task.title}</span>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>

                                <div className="grid grid-cols-12 items-center gap-4">
                                    <Label className="col-span-4 text-sm font-bold text-[#1e293b]">Type</Label>
                                    <Select onValueChange={(val: any) => setType(val)} value={type}>
                                        <SelectTrigger className="col-span-8 h-10 rounded-lg border-slate-200">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="FS">Finish to Start (FS)</SelectItem>
                                            <SelectItem value="SS">Start to Start (SS)</SelectItem>
                                            <SelectItem value="FF">Finish to Finish (FF)</SelectItem>
                                            <SelectItem value="SF">Start to Finish (SF)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-12 items-center gap-4">
                                    <Label className="col-span-4 text-sm font-bold text-[#1e293b]">Lag (Days)</Label>
                                    <Input
                                        id="lag"
                                        type="number"
                                        value={lag}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLag(Number(e.target.value))}
                                        className="col-span-8 h-10 rounded-lg border-slate-200"
                                    />
                                </div>

                                <div className="flex justify-end pt-2">
                                    <Button
                                        onClick={handleSave}
                                        disabled={!targetId}
                                        className="add-link-btn shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
                                    >
                                        {isEditing ? "Update Dependency" : "Add Link"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
