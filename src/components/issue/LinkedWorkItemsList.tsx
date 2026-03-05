'use client'

import { useState, useEffect, useCallback } from 'react'
import { TaskLinkService } from '@/lib/services/tasks/task-link-service'
import { TaskLinkWithDetails } from '@/types/task-links'
import { Button } from '@/components/ui/button'
import { Plus, X, Link as LinkIcon, AlertCircle, HelpCircle, Loader2 } from 'lucide-react'
import { LinkWorkItemDialog } from '@/components/issue/LinkWorkItemDialog'
import { Badge } from '@/components/ui/badge'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from '@/lib/utils'

interface LinkedWorkItemsListProps {
    taskId: string
    sourceProjectId: string
    companyId: string
    companyDomain?: string | null
    userId: string
    isGlobalAdmin?: boolean
    groupId?: string | null
    onTaskClick?: (taskId: string, projectId: string) => void
}

export function LinkedWorkItemsList({
    taskId,
    sourceProjectId,
    companyId,
    companyDomain,
    userId,
    isGlobalAdmin = false,
    groupId,
    onTaskClick
}: LinkedWorkItemsListProps) {
    const hideTaskId = (companyId != null && companyId.toLowerCase().includes('autocracy')) ||
        (companyDomain != null && companyDomain.toLowerCase().includes('autocracy'))
    const [links, setLinks] = useState<{
        blocking: TaskLinkWithDetails[]
        blockedBy: TaskLinkWithDetails[]
        clones: TaskLinkWithDetails[]
        clonedBy: TaskLinkWithDetails[]
        duplicates: TaskLinkWithDetails[]
        duplicatedBy: TaskLinkWithDetails[]
        related: TaskLinkWithDetails[]
    }>({
        blocking: [],
        blockedBy: [],
        clones: [],
        clonedBy: [],
        duplicates: [],
        duplicatedBy: [],
        related: []
    })
    const [loading, setLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    const fetchLinks = useCallback(async () => {
        try {
            setLoading(true)
            const groupedLinks = await TaskLinkService.getTaskLinksGrouped(companyId, taskId, groupId ?? undefined)
            setLinks(groupedLinks)
        } catch (error: any) {
            // SILENT: Permission errors are expected and handled by the service returning empty/filtered results
            if (error.code !== 'permission-denied') {
                console.error('[TaskLinks] Unexpected fetch error:', error)
            }
        } finally {
            setLoading(false)
        }
    }, [companyId, taskId, groupId])

    useEffect(() => {
        if (companyId && taskId) {
            fetchLinks()
        }
    }, [companyId, taskId, fetchLinks])

    const handleDeleteLink = async (linkId: string) => {
        try {
            await TaskLinkService.deleteLink(companyId, linkId, groupId ?? undefined)
            fetchLinks()
        } catch (error: any) {
            if (error.code !== 'permission-denied') {
                console.error('[TaskLinks] Delete failed:', error)
            }
        }
    }


    const renderLinkItem = (link: TaskLinkWithDetails) => (
        <div
            key={link.id}
            className={cn(
                "flex items-center justify-between py-1 px-2 bg-white border border-slate-100 rounded-lg group transition-all hover:border-blue-200 hover:shadow-sm",
                onTaskClick && "cursor-pointer"
            )}
            onClick={() => onTaskClick?.(link.relatedTaskId, link.relatedProjectId)}
        >
            <div className="flex items-center gap-2 min-w-0 flex-1">
                {/* Slim ID Badge (hidden for autocracy tenant) */}
                {!hideTaskId && (
                    <div className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 shrink-0">
                        <span className="font-mono text-[9px] font-bold text-slate-500 uppercase leading-none">
                            {link.targetTask.projectCode}-{link.targetTask.taskNumber}
                        </span>
                    </div>
                )}

                {/* Horizontal Metadata Row */}
                <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                    <span className="truncate text-[11px] text-slate-700 font-bold tracking-tight">
                        {link.targetTask.title}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                        <Badge variant="secondary" className="text-[8px] px-1 h-4 bg-slate-50 text-slate-400 border-none capitalize font-bold leading-none">
                            {link.targetTask.status}
                        </Badge>
                        {link.targetTask.assignedToName && (
                            <span className="text-[9px] text-slate-300 font-medium truncate max-w-[80px]">
                                {link.targetTask.assignedToName}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center shrink-0 ml-1">
                {(isGlobalAdmin || userId === link.createdBy) && (
                    <TooltipProvider>
                        <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteLink(link.id)
                                    }}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left">Remove</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>
        </div>
    )

    const hasAnyLinks =
        links.blocking.length > 0 ||
        links.blockedBy.length > 0 ||
        links.clones.length > 0 ||
        links.clonedBy.length > 0 ||
        links.duplicates.length > 0 ||
        links.duplicatedBy.length > 0 ||
        links.related.length > 0

    if (loading && !hasAnyLinks) {
        return (
            <div className="space-y-1.5 animate-pulse">
                <div className="h-3 w-20 bg-slate-100 rounded"></div>
                <div className="h-6 w-full bg-slate-50 rounded"></div>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <div>
                <div className="flex items-center justify-between mb-2 px-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        Linked Items
                        {loading && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
                    </label>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        onClick={() => setIsDialogOpen(true)}
                    >
                        <Plus className="h-3.5 w-3.5" />
                    </Button>
                </div>

                <div className="space-y-3">
                    {/* BLOCKING Section */}
                    {links.blocking.length > 0 && (
                        <div className="space-y-1 px-1">
                            <div className="flex items-center gap-1.5 mb-1">
                                <AlertCircle className="h-2.5 w-2.5 text-red-400" />
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Blocking</span>
                            </div>
                            <div className="space-y-0.5">
                                {links.blocking.map(renderLinkItem)}
                            </div>
                        </div>
                    )}

                    {/* BLOCKED BY Section */}
                    {links.blockedBy.length > 0 && (
                        <div className="space-y-1 px-1">
                            <div className="flex items-center gap-1.5 mb-1">
                                <AlertCircle className="h-2.5 w-2.5 text-amber-400" />
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Blocked By</span>
                            </div>
                            <div className="space-y-0.5">
                                {links.blockedBy.map(renderLinkItem)}
                            </div>
                        </div>
                    )}

                    {/* CLONES Section */}
                    {links.clones.length > 0 && (
                        <div className="space-y-1 px-1">
                            <div className="flex items-center gap-1.5 mb-1">
                                <LinkIcon className="h-2.5 w-2.5 text-purple-400" />
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Clones</span>
                            </div>
                            <div className="space-y-0.5">
                                {links.clones.map(renderLinkItem)}
                            </div>
                        </div>
                    )}

                    {/* CLONED BY Section */}
                    {links.clonedBy.length > 0 && (
                        <div className="space-y-1 px-1">
                            <div className="flex items-center gap-1.5 mb-1">
                                <LinkIcon className="h-2.5 w-2.5 text-purple-300" />
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Cloned By</span>
                            </div>
                            <div className="space-y-0.5">
                                {links.clonedBy.map(renderLinkItem)}
                            </div>
                        </div>
                    )}

                    {/* DUPLICATES Section */}
                    {links.duplicates.length > 0 && (
                        <div className="space-y-1 px-1">
                            <div className="flex items-center gap-1.5 mb-1">
                                <LinkIcon className="h-2.5 w-2.5 text-orange-400" />
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Duplicates</span>
                            </div>
                            <div className="space-y-0.5">
                                {links.duplicates.map(renderLinkItem)}
                            </div>
                        </div>
                    )}

                    {/* DUPLICATED BY Section */}
                    {links.duplicatedBy.length > 0 && (
                        <div className="space-y-1 px-1">
                            <div className="flex items-center gap-1.5 mb-1">
                                <LinkIcon className="h-2.5 w-2.5 text-orange-300" />
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Duplicated By</span>
                            </div>
                            <div className="space-y-0.5">
                                {links.duplicatedBy.map(renderLinkItem)}
                            </div>
                        </div>
                    )}

                    {/* RELATED Section */}
                    {links.related.length > 0 && (
                        <div className="space-y-1 px-1">
                            <div className="flex items-center gap-1.5 mb-1">
                                <HelpCircle className="h-2.5 w-2.5 text-blue-400" />
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Related</span>
                            </div>
                            <div className="space-y-0.5">
                                {links.related.map(renderLinkItem)}
                            </div>
                        </div>
                    )}

                    {!hasAnyLinks && !loading && (
                        <div className="text-[10px] text-slate-400 italic px-1 flex items-center gap-2">
                            No active dependencies
                        </div>
                    )}
                </div>

                <LinkWorkItemDialog
                    open={isDialogOpen}
                    onOpenChange={setIsDialogOpen}
                    sourceTaskId={taskId}
                    sourceProjectId={sourceProjectId}
                    companyId={companyId}
                    groupId={groupId}
                    companyDomain={companyDomain}
                    userId={userId}
                    isGlobalAdmin={isGlobalAdmin}
                    onLinkCreated={fetchLinks}
                />
            </div>
        </div>
    )
}
