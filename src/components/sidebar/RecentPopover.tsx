'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Search, X, Clock } from 'lucide-react'
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed'
import type { EnhancedProject } from '@/types/project-schema'
import type { Workspace } from '@/types/workspace-schema'
import { Button } from '@/components/ui/button'

interface RecentPopoverProps {
    projects: EnhancedProject[]
    workspaces: Workspace[]
    getProjectColor: (project: EnhancedProject) => string
    children: React.ReactNode
}

export function RecentPopover({
    projects,
    workspaces,
    getProjectColor,
    children
}: RecentPopoverProps) {
    const [open, setOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const pathname = usePathname()
    const { recentProjects, recentWorkspaces, loading } = useRecentlyViewed()

    // Map recent items to full project/workspace objects
    const recentProjectsFull = useMemo(() => {
        return recentProjects
            .map(rp => projects.find(p => p.id === rp.projectId))
            .filter((p): p is EnhancedProject => p !== undefined)
    }, [recentProjects, projects])

    const recentWorkspacesFull = useMemo(() => {
        return recentWorkspaces
            .map(rw => workspaces.find(w => w.id === rw.workspaceId))
            .filter((w): w is Workspace => w !== undefined)
    }, [recentWorkspaces, workspaces])

    const filteredProjects = useMemo(() => {
        if (!searchTerm) return recentProjectsFull
        const term = searchTerm.toLowerCase()
        return recentProjectsFull.filter(p => p.name.toLowerCase().includes(term))
    }, [recentProjectsFull, searchTerm])

    const filteredWorkspaces = useMemo(() => {
        if (!searchTerm) return recentWorkspacesFull
        const term = searchTerm.toLowerCase()
        return recentWorkspacesFull.filter(w => w.name.toLowerCase().includes(term))
    }, [recentWorkspacesFull, searchTerm])

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
                        <div className="text-sm font-semibold text-foreground mb-3">Recent</div>

                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search recent items"
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
                        {loading ? (
                            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                                Loading...
                            </div>
                        ) : !hasResults ? (
                            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                                {searchTerm ? 'No recent items found' : 'No recent items'}
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {/* Recent Workspaces */}
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
                                            <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-2" />
                                        </Link>
                                    )
                                })}

                                {/* Recent Projects */}
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
                                            <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-2" />
                                        </Link>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
