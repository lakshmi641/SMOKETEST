'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import {
    Command,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
} from '@/components/ui/command'
import * as VisuallyHidden from "@radix-ui/react-visually-hidden"
import { TaskSearchService } from '@/lib/services/tasks/task-search-service'
import { TaskLinkService } from '@/lib/services/tasks/task-link-service'
import { RecentlyViewedService } from '@/lib/services/tasks/recently-viewed-service'
import { GeneratedTask } from '@/types/task-template-schema'
import { TaskLinkType, RecentlyViewedTask } from '@/types/task-links'
import { Search, History, Check, Loader2, AlertCircle, Building2, Link2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface LinkWorkItemDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    sourceTaskId: string
    sourceProjectId: string
    companyId: string
    companyDomain?: string | null
    userId: string
    isGlobalAdmin: boolean
    groupId?: string | null
    onLinkCreated: () => void
}

const LINK_TYPES: { value: TaskLinkType; label: string }[] = [
    { value: 'relates_to', label: 'relates to' },
    { value: 'blocks', label: 'blocks' },
    { value: 'is_blocked_by', label: 'is blocked by' },
    { value: 'clones', label: 'clones' },
    { value: 'is_cloned_by', label: 'is cloned by' },
    { value: 'duplicates', label: 'duplicates' },
    { value: 'is_duplicated_by', label: 'is duplicated by' },
]

export function LinkWorkItemDialog({
    open,
    onOpenChange,
    sourceTaskId,
    sourceProjectId,
    companyId,
    companyDomain,
    userId,
    isGlobalAdmin,
    groupId,
    onLinkCreated
}: LinkWorkItemDialogProps) {
    const hideTaskId = (companyId != null && companyId.toLowerCase().includes('autocracy')) ||
        (companyDomain != null && companyDomain.toLowerCase().includes('autocracy'))
    const [linkType, setLinkType] = useState<TaskLinkType>('relates_to')
    const [searchTerm, setSearchTerm] = useState('')
    const [searchResults, setSearchResults] = useState<GeneratedTask[]>([])
    const [recentTasks, setRecentTasks] = useState<RecentlyViewedTask[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [isLoadingRecent, setIsLoadingRecent] = useState(false)
    const [isCreating, setIsCreating] = useState(false)

    // Load recent tasks
    useEffect(() => {
        if (open && companyId && userId) {
            const loadRecent = async () => {
                setIsLoadingRecent(true)
                try {
                    const tasks = await RecentlyViewedService.getRecentlyViewed(companyId, userId, isGlobalAdmin, 10, groupId ?? undefined)
                    // Filter out current task
                    setRecentTasks(tasks.filter(t => t.taskId !== sourceTaskId))
                } catch (error) {
                    console.error('Error loading recent tasks:', error)
                } finally {
                    setIsLoadingRecent(false)
                }
            }
            loadRecent()
        }
    }, [open, companyId, userId, sourceTaskId])

    const [hasSearched, setHasSearched] = useState(false)
    const searchRef = useRef<number>(0)
    const debounceTimer = useRef<NodeJS.Timeout | null>(null)

    // Search tasks with debouncing and race condition protection
    const performSearch = useCallback(async (val: string) => {
        const queryId = ++searchRef.current

        // Allow single character for ID searches (e.g., "M" for MP-1)
        const isIdPattern = val.includes('-') || val.includes(' ') || /^[A-Za-z]{1,4}$/.test(val.trim())
        const minLength = isIdPattern ? 1 : 2

        if (val.trim().length >= minLength) {
            setIsSearching(true)
            setHasSearched(false)
            try {
                const results = await TaskSearchService.searchAccessibleTasks(
                    companyId,
                    userId,
                    val,
                    isGlobalAdmin,
                    sourceProjectId,
                    groupId ?? undefined
                )

                // Only update state if this is still the most recent query
                if (queryId === searchRef.current) {
                    setSearchResults(results.filter(t => t.id !== sourceTaskId))
                    setHasSearched(true)
                }
            } catch (error) {
                console.error('Search error:', error)
            } finally {
                if (queryId === searchRef.current) {
                    setIsSearching(false)
                }
            }
        } else {
            setSearchResults([])
            setIsSearching(false)
            setHasSearched(false)
        }
    }, [companyId, userId, isGlobalAdmin, sourceProjectId, sourceTaskId])

    const handleSearch = useCallback((val: string) => {
        setSearchTerm(val)

        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current)
        }

        if (val.trim()) {
            debounceTimer.current = setTimeout(() => {
                performSearch(val)
            }, 300) // 300ms debounce
        } else {
            setSearchResults([])
            setIsSearching(false)
            setHasSearched(false)
        }
    }, [performSearch])

    const handleCreateLink = async (targetTask: GeneratedTask | RecentlyViewedTask) => {
        setIsCreating(true)
        try {
            const targetTaskId = 'taskId' in targetTask ? targetTask.taskId : targetTask.id

            await TaskLinkService.createLink(
                companyId,
                sourceTaskId,
                targetTaskId,
                sourceProjectId,
                targetTask.projectId,
                linkType,
                userId,
                groupId ?? undefined
            )
            toast.success('Tasks linked successfully')
            onLinkCreated()
            onOpenChange(false)
        } catch (error) {
            console.error('Error creating link:', error)
            toast.error('Failed to link tasks')
        } finally {
            setIsCreating(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="overflow-hidden p-0 shadow-2xl max-w-xl border-none gap-0">
                <VisuallyHidden.Root>
                    <DialogTitle>Link Work Item</DialogTitle>
                    <DialogDescription>Search and link tasks to create relationships.</DialogDescription>
                </VisuallyHidden.Root>
                <div className="flex flex-col h-[480px] bg-white">
                    <div className="p-4 border-b flex items-center justify-between pr-12">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
                                <Link2 className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-bold text-slate-900 tracking-tight text-base">Link Work Item</h3>
                                <p className="text-[11px] text-slate-500 font-medium">Create relationships between tasks</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-md border border-slate-200 shrink-0">
                            <Select value={linkType} onValueChange={(val: any) => setLinkType(val)} disabled={isCreating}>
                                <SelectTrigger className="w-[120px] h-6 text-[10px] font-bold border-none shadow-none focus:ring-0 bg-transparent hover:bg-slate-200/50 transition-colors px-2 uppercase tracking-tight">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {LINK_TYPES.map(type => (
                                        <SelectItem key={type.value} value={type.value} className="text-xs">
                                            {type.label.toUpperCase()}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <Command className="flex-1 rounded-none border-none" shouldFilter={false}>
                        <CommandInput
                            placeholder="Enter task ID (e.g. PA-50) or type to search..."
                            value={searchTerm}
                            onValueChange={handleSearch}
                            className="h-14"
                        />

                        <CommandList className="flex-1 max-h-none scrollbar-hide">
                            {isSearching && (
                                <div className="p-8 text-center">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600 mb-2" />
                                    <p className="text-sm text-muted-foreground">Searching tasks...</p>
                                </div>
                            )}

                            {!isSearching && hasSearched && searchResults.length === 0 && (
                                <CommandEmpty className="py-12">
                                    <div className="flex flex-col items-center gap-2">
                                        <AlertCircle className="h-8 w-8 text-gray-300" />
                                        <p className="text-sm font-medium text-gray-500">No matching tasks found</p>
                                        <p className="text-xs text-gray-400">Try searching with a different ID or keyword</p>
                                    </div>
                                </CommandEmpty>
                            )}

                            {/* Recent Tasks */}
                            {searchTerm.length === 0 && (
                                <CommandGroup heading="Recently Viewed" className="p-2">
                                    {isLoadingRecent ? (
                                        <div className="py-4 text-center">
                                            <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-300" />
                                        </div>
                                    ) : recentTasks.length > 0 ? (
                                        recentTasks.map(task => (
                                            <CommandItem
                                                key={task.id}
                                                onSelect={() => handleCreateLink(task)}
                                                className="flex items-center gap-3 p-3 cursor-pointer rounded-lg hover:bg-gray-50 aria-selected:bg-gray-50 group"
                                            >
                                                {!hideTaskId && (
                                                    <div className="min-w-[48px] px-2 h-8 rounded bg-gray-100 flex items-center justify-center text-[10px] font-mono font-bold text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                                                        {task.projectCode ? `${task.projectCode}-${task.taskNumber}` : task.taskNumber}
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-sm text-gray-900 truncate">
                                                        {task.title}
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground">
                                                        Last viewed {new Date(task.viewedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700 border-blue-100">Click to link</Badge>
                                                </div>
                                            </CommandItem>
                                        ))
                                    ) : (
                                        <div className="p-6 text-center text-xs text-muted-foreground italic">
                                            No recently viewed tasks
                                        </div>
                                    )}
                                </CommandGroup>
                            )}

                            {/* Search Results */}
                            {searchResults.length > 0 && (
                                <CommandGroup heading="Matching Tasks" className="p-2">
                                    {searchResults.map(task => (
                                        <CommandItem
                                            key={task.id}
                                            onSelect={() => handleCreateLink(task)}
                                            className="flex items-center gap-3 p-3 cursor-pointer rounded-lg hover:bg-gray-50 aria-selected:bg-gray-50 group"
                                        >
                                            {!hideTaskId && (
                                                <div className="min-w-[48px] px-2 h-8 rounded bg-gray-100 flex items-center justify-center text-[10px] font-mono font-bold text-gray-500 group-hover:bg-green-100 group-hover:text-green-700 transition-colors">
                                                    {task.projectCode ? `${task.projectCode}-${task.taskNumber}` : task.taskNumber}
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-sm text-gray-900 truncate">
                                                    {task.title}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground capitalize">
                                                    {task.status.replace('_', ' ')}
                                                </div>
                                            </div>
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Badge variant="secondary" className="text-[10px] bg-green-50 text-green-700 border-green-100 uppercase tracking-wider font-bold">Select</Badge>
                                            </div>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}
                        </CommandList>

                    </Command>
                </div>
            </DialogContent>
        </Dialog>
    )
}
