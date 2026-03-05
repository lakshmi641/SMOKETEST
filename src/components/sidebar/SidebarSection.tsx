'use client'

import React from 'react'
import { ChevronDown, ChevronRight, Plus, FolderPlus, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface SidebarSectionProps {
    title: string;
    isExpanded: boolean;
    onToggle: () => void;
    /** Section icon (e.g. FolderKanban, Workflow, Shield). When set, row matches nav item UX: icon + label, chevron + create on hover. */
    icon?: LucideIcon;
    onCreateClick?: () => void;
    createTooltip?: string;
    onCreateProjectClick?: () => void;
    createProjectTooltip?: string;
    children: React.ReactNode;
    className?: string;
}

export function SidebarSection({
    title,
    isExpanded,
    onToggle,
    icon: SectionIcon,
    onCreateClick,
    createTooltip,
    onCreateProjectClick,
    createProjectTooltip,
    children,
    className
}: SidebarSectionProps) {
    const hasCreateActions = Boolean(onCreateClick || onCreateProjectClick)
    const showHoverActions = SectionIcon != null || hasCreateActions
    const ChevronIcon = isExpanded ? ChevronDown : ChevronRight

    return (
        <div className={cn("mb-0.5 w-full min-w-0 overflow-hidden", className)}>
            <div className="flex items-center justify-between gap-1 group min-w-0 rounded-md hover:bg-accent/50 transition-colors">
                <button
                    onClick={onToggle}
                    className={cn(
                        "flex items-center gap-2 h-9 min-h-9 flex-1 py-0 px-3 rounded-md transition-colors min-w-0 overflow-hidden text-left",
                        SectionIcon
                            ? "text-muted-foreground hover:text-foreground text-sm font-medium"
                            : "text-foreground font-medium text-sm hover:text-foreground"
                    )}
                >
                    {SectionIcon ? (
                        <span className="relative w-4 h-4 flex-shrink-0 flex items-center justify-center">
                            <SectionIcon className="w-4 h-4 transition-opacity group-hover:opacity-0" />
                            <ChevronIcon className="absolute w-4 h-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </span>
                    ) : (
                        <>
                            {isExpanded ? (
                                <ChevronDown className="w-4 h-4 flex-shrink-0" />
                            ) : (
                                <ChevronRight className="w-4 h-4 flex-shrink-0" />
                            )}
                        </>
                    )}
                    <span className="truncate flex-1 min-w-0">{title}</span>
                </button>
                {hasCreateActions && (
                    <div className="flex items-center gap-0.5 flex-shrink-0 ml-0.5 pr-1">
                        {onCreateProjectClick && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onCreateProjectClick()
                                        }}
                                    >
                                        <FolderPlus className="w-4 h-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>{createProjectTooltip ?? 'New project'}</TooltipContent>
                            </Tooltip>
                        )}
                        {onCreateClick && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onCreateClick()
                                        }}
                                    >
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>{createTooltip || `Create ${title}`}</TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                )}
            </div>

            {isExpanded && (
                <div className="mt-1 ml-4 space-y-0.5 min-w-0 overflow-hidden">
                    {children}
                </div>
            )}
        </div>
    )
}
