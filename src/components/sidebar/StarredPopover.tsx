'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Star, Search, X, Rocket } from 'lucide-react'
import { useStarredItems } from '@/hooks/useStarredItems'
import type { EnhancedProject } from '@/types/project-schema'
import type { Workspace } from '@/types/workspace-schema'
import { Button } from '@/components/ui/button'

interface StarredPopoverProps {
    starredProjects: EnhancedProject[]
    starredWorkspaces: Workspace[]
    workspaces: Workspace[]
    getProjectColor: (project: EnhancedProject) => string
    children: React.ReactNode
}

export function StarredPopover({
    starredProjects,
    starredWorkspaces,
    workspaces,
    getProjectColor,
    children
}: StarredPopoverProps) {
    const [open, setOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const pathname = usePathname()

    const filteredProjects = useMemo(() => {
        if (!searchTerm) return starredProjects
        const term = searchTerm.toLowerCase()
        return starredProjects.filter(p => p.name.toLowerCase().includes(term))
    }, [starredProjects, searchTerm])

    const filteredWorkspaces = useMemo(() => {
        if (!searchTerm) return starredWorkspaces
        const term = searchTerm.toLowerCase()
        return starredWorkspaces.filter(w => w.name.toLowerCase().includes(term))
    }, [starredWorkspaces, searchTerm])

    const hasResults = filteredProjects.length > 0 || filteredWorkspaces.length > 0

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                {children}
            </PopoverTrigger>
            <PopoverContent 
                className="w-80 p-0" 
                align="start"
                side="right"
                sideOffset={8}
            >
                <div className="flex flex-col max-h-[600px]">
                    {/* Header */}
                    <div className="px-4 pt-4 pb-2 border-b">
                        <div className="text-sm font-semibold text-foreground mb-3">Spaces</div>
                        
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search starred items"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-8 h-9"
                            />
                            {searchTerm && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                                    onClick={() => setSearchTerm('')}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-2">
                        {!hasResults ? (
                            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                                {searchTerm ? 'No starred items found' : 'No starred items'}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Starred Workspaces */}
                                {filteredWorkspaces.length > 0 && (
                                    <div>
                                        {filteredWorkspaces.map((workspace) => {
                                            const isActive = pathname?.startsWith(`/workspaces/${workspace.id}`)
                                            return (
                                                <Link
                                                    key={workspace.id}
                                                    href={`/workspaces/${workspace.id}`}
                                                    onClick={() => setOpen(false)}
                                                    className={cn(
                                                        "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors group min-w-0",
                                                        isActive
                                                            ? "bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100"
                                                            : "hover:bg-accent text-foreground"
                                                    )}
                                                >
                                                    <div
                                                        className="w-4 h-4 rounded-sm flex-shrink-0 bg-primary/20 border border-primary/40"
                                                        style={workspace.color ? { backgroundColor: `${workspace.color}20`, borderColor: `${workspace.color}40` } : {}}
                                                    />
                                                    <span className="flex-1 truncate min-w-0">{workspace.name}</span>
                                                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0 ml-2" />
                                                </Link>
                                            )
                                        })}
                                    </div>
                                )}

                                {/* Starred Projects */}
                                {filteredProjects.length > 0 && (
                                    <div>
                                        {filteredProjects.map((project) => {
                                            const isActive = pathname === `/projects/${project.id}`
                                            const projectColor = getProjectColor(project)
                                            const workspaceName = workspaces.find(w => w.id === project.workspaceId)?.name

                                            return (
                                                <Link
                                                    key={project.id}
                                                    href={`/projects/${project.id}`}
                                                    onClick={() => setOpen(false)}
                                                    className={cn(
                                                        "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors group min-w-0",
                                                        isActive
                                                            ? "bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100"
                                                            : "hover:bg-accent text-foreground"
                                                    )}
                                                >
                                                    <div
                                                        className="w-4 h-4 rounded-sm flex-shrink-0"
                                                        style={{ backgroundColor: projectColor }}
                                                    />
                                                    <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                                                        <span className="truncate leading-tight">{project.name}</span>
                                                        {workspaceName && (
                                                            <span className="text-[10px] opacity-60 truncate leading-none">
                                                                {workspaceName}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0 ml-2" />
                                                </Link>
                                            )
                                        })}
                                    </div>
                                )}

                                {/* Recent Starred Section */}
                                {(filteredProjects.length > 3 || filteredWorkspaces.length > 3) && (
                                    <div className="pt-2 border-t">
                                        <div className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                            Recent
                                        </div>
                                        <div className="space-y-1">
                                            {/* Show first 3 of each */}
                                            {filteredWorkspaces.slice(0, 3).map((workspace) => {
                                                const isActive = pathname?.startsWith(`/workspaces/${workspace.id}`)
                                                return (
                                                    <Link
                                                        key={workspace.id}
                                                        href={`/workspaces/${workspace.id}`}
                                                        onClick={() => setOpen(false)}
                                                        className={cn(
                                                            "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors min-w-0",
                                                            isActive
                                                                ? "bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100"
                                                                : "hover:bg-accent text-muted-foreground hover:text-foreground"
                                                        )}
                                                    >
                                                        <div
                                                            className="w-3 h-3 rounded-sm flex-shrink-0"
                                                            style={workspace.color ? { backgroundColor: `${workspace.color}20`, borderColor: `${workspace.color}40` } : {}}
                                                        />
                                                        <span className="flex-1 truncate text-xs min-w-0">{workspace.name}</span>
                                                    </Link>
                                                )
                                            })}
                                            {filteredProjects.slice(0, 3).map((project) => {
                                                const isActive = pathname === `/projects/${project.id}`
                                                const projectColor = getProjectColor(project)
                                                return (
                                                    <Link
                                                        key={project.id}
                                                        href={`/projects/${project.id}`}
                                                        onClick={() => setOpen(false)}
                                                        className={cn(
                                                            "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors min-w-0",
                                                            isActive
                                                                ? "bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100"
                                                                : "hover:bg-accent text-muted-foreground hover:text-foreground"
                                                        )}
                                                    >
                                                        <div
                                                            className="w-3 h-3 rounded-sm flex-shrink-0"
                                                            style={{ backgroundColor: projectColor }}
                                                        />
                                                        <span className="flex-1 truncate text-xs min-w-0">{project.name}</span>
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {(starredProjects.length > 0 || starredWorkspaces.length > 0) && (
                        <div className="px-4 py-3 border-t">
                            <Link
                                href="/favorites"
                                onClick={() => setOpen(false)}
                                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                                View all starred items
                            </Link>
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}
