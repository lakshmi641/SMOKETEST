'use client'

import { useState, useEffect } from 'react'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
    Clock,
    Calendar,
    MessageSquare,
    Trash2,
    Loader2,
    History
} from 'lucide-react'
import { TaskTimeService } from '@/lib/services/tasks/task-time-service'
import { logTimeLogged } from '@/lib/services/task-activity-service'
import { useAuthStore } from '@/store/authStore'
import { useCompany } from '@/contexts/CompanyContext'
import type { GeneratedTask } from '@/types/task-template-schema'
import type { TaskTimeEntry } from '@/types/task-time-schema'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface LogTimeDrawerProps {
    task: GeneratedTask
    isOpen: boolean
    onClose: () => void
    onSaveSuccess: () => Promise<void>
}

export function LogTimeDrawer({ task, isOpen, onClose, onSaveSuccess }: LogTimeDrawerProps) {
    const { user } = useAuthStore()
    const { companyId } = useCompany()

    const [date, setDate] = useState<string>(() => {
        const today = new Date().toISOString().split('T')[0]
        return today || new Date().toISOString().substring(0, 10)
    })
    const [durationStr, setDurationStr] = useState("")
    const [notes, setNotes] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    const [history, setHistory] = useState<TaskTimeEntry[]>([])
    const [isLoadingHistory, setIsLoadingHistory] = useState(false)

    useEffect(() => {
        if (isOpen && companyId && task.id) {
            loadHistory()
        }
    }, [isOpen, companyId, task.id])

    const loadHistory = async () => {
        if (!companyId || !task.id) return
        try {
            setIsLoadingHistory(true)
            const entries = await TaskTimeService.getTimeEntries(companyId!, task.id)
            setHistory(entries)
        } catch (error) {
            console.error('Error loading time history:', error)
        } finally {
            setIsLoadingHistory(false)
        }
    }

    const parseDuration = (str: string): number => {
        // Supports: "1.5", "1h 30m", "90m", "1h", "2 hours"
        const s = str.toLowerCase().trim()

        // Check for decimal hours first
        if (/^\d*\.?\d+$/.test(s)) {
            return parseFloat(s)
        }

        let totalMinutes = 0

        // Extract hours
        const hMatch = s.match(/(\d+)\s*(h|hour)/)
        if (hMatch && hMatch[1]) totalMinutes += parseInt(hMatch[1], 10) * 60

        // Extract minutes
        const mMatch = s.match(/(\d+)\s*(m|min)/)
        if (mMatch && mMatch[1]) totalMinutes += parseInt(mMatch[1], 10)

        if (totalMinutes === 0 && !s.includes('h') && !s.includes('m')) {
            return 0
        }

        return totalMinutes / 60
    }

    const formatDuration = (decimalHours: number): string => {
        const hours = Math.floor(decimalHours)
        const minutes = Math.round((decimalHours - hours) * 60)

        const parts = []
        if (hours > 0) parts.push(`${hours}h`)
        if (minutes > 0) parts.push(`${minutes}m`)

        return parts.join(' ') || '0m'
    }

    const handleSave = async () => {
        if (!companyId || !task.id || !user) return

        const duration = parseDuration(durationStr)
        if (duration <= 0) {
            toast.error("Please enter a valid duration (e.g., 1.5, 1h 30m)")
            return
        }

        try {
            setIsSaving(true)

            const entryData = {
                taskId: task.id,
                projectId: task.projectId,
                companyId: companyId!,
                date,
                duration,
                notes: notes.trim() || undefined,
                loggedBy: user!.id,
                loggedByName: user!.name || 'Anonymous'
            }

            await TaskTimeService.logTime(companyId!, entryData)
            await logTimeLogged(companyId!, task.id, task.projectId, duration, user!.id, user!.name || 'User', notes.trim())

            toast.success("Time logged")
            setDurationStr("")
            setNotes("")
            await loadHistory()
            await onSaveSuccess()
        } catch (error) {
            console.error('Error logging time:', error)
            toast.error("Failed to log time")
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (entryId: string) => {
        if (!companyId || !task.id) return
        if (!confirm("Are you sure you want to delete this time entry?")) return

        try {
            await TaskTimeService.deleteTimeEntry(companyId!, task.id, entryId)
            toast.success("Entry deleted")
            await loadHistory()
            await onSaveSuccess()
        } catch (error) {
            console.error('Error deleting entry:', error)
            toast.error("Failed to delete entry")
        }
    }

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="w-full sm:w-[450px] p-0 flex flex-col">
                <div className="p-6 border-b bg-slate-50/50">
                    <SheetHeader>
                        <SheetTitle className="text-xl flex items-center gap-2">
                            <Clock className="h-5 w-5 text-blue-600" />
                            Log time
                        </SheetTitle>
                        <SheetDescription>
                            Record time spent on this task
                        </SheetDescription>
                    </SheetHeader>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-ultrathin">
                    {/* Form */}
                    <div className="space-y-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="date" className="text-xs font-semibold uppercase text-slate-500">Date</Label>
                                <div className="relative">
                                    <Input
                                        id="date"
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="pl-9 h-10 border-slate-200 focus:ring-blue-500"
                                    />
                                    <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="duration" className="text-xs font-semibold uppercase text-slate-500">Time spent</Label>
                                <div className="relative">
                                    <Input
                                        id="duration"
                                        placeholder="1h 30m or 1.5"
                                        value={durationStr}
                                        onChange={(e) => setDurationStr(e.target.value)}
                                        className="pl-9 h-10 border-slate-200 focus:ring-blue-500"
                                    />
                                    <Clock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="notes" className="text-xs font-semibold uppercase text-slate-500">Notes (optional)</Label>
                            <Textarea
                                id="notes"
                                placeholder="What did you work on?"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="min-h-[100px] border-slate-200 focus:ring-blue-500 resize-none"
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-100"
                                onClick={handleSave}
                                disabled={isSaving || !durationStr}
                            >
                                {isSaving ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                    <Clock className="h-4 w-4 mr-2" />
                                )}
                                Save
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1 border-slate-200 hover:bg-slate-50"
                                onClick={onClose}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>

                    {/* History */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b pb-2">
                            <h3 className="text-sm font-bold flex items-center gap-2 text-slate-700">
                                <History className="h-4 w-4 text-slate-400" />
                                Past time entries
                            </h3>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                                {history.length} entries
                            </span>
                        </div>

                        {isLoadingHistory ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
                                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                                <p className="text-sm font-medium">Loading history...</p>
                            </div>
                        ) : history.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                                <Clock className="h-8 w-8 mb-2 opacity-20" />
                                <p className="text-sm font-medium">No time logged yet.</p>
                                <p className="text-[11px]">Time logged will appear here</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {history.map((entry) => (
                                    <div
                                        key={entry.id}
                                        className="group bg-white p-4 rounded-xl border border-slate-100 hover:border-blue-100 hover:shadow-sm transition-all relative"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                                    {formatDuration(entry.duration)}
                                                </span>
                                                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    {new Date(entry.date).toLocaleDateString('en-GB', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        year: 'numeric'
                                                    })}
                                                </span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => handleDelete(entry.id)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>

                                        {entry.notes && (
                                            <div className="text-xs text-slate-600 bg-slate-50/50 p-2 rounded-lg border border-slate-100/50 flex gap-2">
                                                <MessageSquare className="h-3 w-3 mt-0.5 text-slate-400 shrink-0" />
                                                <p className="leading-relaxed italic">{entry.notes}</p>
                                            </div>
                                        )}

                                        <div className="mt-2 text-[10px] text-slate-400 text-right font-medium">
                                            Logged by {entry.loggedByName}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
