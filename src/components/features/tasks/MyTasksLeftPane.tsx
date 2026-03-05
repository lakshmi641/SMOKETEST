'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed'
import { useStarredItems } from '@/hooks/useStarredItems'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { useCompany } from '@/hooks/useCompany'
import { useAuthStore } from '@/store/authStore'
import { useProjectsQuery } from '@/hooks/queries/useProjectQueries'
import type { EnhancedProject } from '@/types/project-schema'
import type { Workspace } from '@/types/workspace-schema'
import { Star, Clock, FolderKanban, Building2, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface MyTasksLeftPaneProps {
  assignedTasksCount: number
  completedTasksCount: number
}

export function MyTasksLeftPane({ assignedTasksCount, completedTasksCount }: MyTasksLeftPaneProps) {
  const pathname = usePathname()
  const { currentCompany, groupId } = useCompany()
  const { user: currentUser } = useAuthStore()
  const { recentProjects, recentWorkspaces, loading: recentLoading } = useRecentlyViewed()
  const { starredItems } = useStarredItems()
  const { workspaces: allWorkspaces } = useWorkspace()
  const { data: projects = [], isLoading: loading } = useProjectsQuery(
    currentCompany?.id,
    groupId ?? undefined,
    currentUser?.id,
    currentUser?.role === 'admin' || currentUser?.role === 'owner'
  )

  // Map recent items to full objects
  const recentProjectsFull = useMemo(() => {
    return recentProjects
      .map(rp => projects.find(p => p.id === rp.projectId))
      .filter((p): p is EnhancedProject => p !== undefined)
      .slice(0, 5)
  }, [recentProjects, projects])

  const recentWorkspacesFull = useMemo(() => {
    return recentWorkspaces
      .map(rw => allWorkspaces.find(w => w.id === rw.workspaceId))
      .filter((w): w is Workspace => w !== undefined)
      .slice(0, 5)
  }, [recentWorkspaces, allWorkspaces])

  const starredProjects = useMemo(() => {
    const starredProjectIds = Array.from(starredItems.projects || [])
    return projects.filter(p => starredProjectIds.includes(p.id)).slice(0, 3)
  }, [projects, starredItems.projects])

  const starredWorkspaces = useMemo(() => {
    const starredWorkspaceIds = Array.from(starredItems.workspaces || [])
    return allWorkspaces.filter(w => starredWorkspaceIds.includes(w.id)).slice(0, 3)
  }, [allWorkspaces, starredItems.workspaces])

  const getProjectColor = (project: EnhancedProject) => {
    // Generate a consistent color from project name
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
    const index = project.name.charCodeAt(0) % colors.length
    return colors[index] || '#3b82f6'
  }

  return (
    <div className="w-64 flex-shrink-0 border-r border-border bg-muted/30 h-full overflow-y-auto">
      <div className="p-4 space-y-6">
        {/* Recent Spaces */}
        {(recentProjectsFull.length > 0 || recentWorkspacesFull.length > 0) && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Recent spaces
            </h3>
            <div className="space-y-2">
              {recentWorkspacesFull.map((workspace) => {
                const isActive = pathname?.startsWith(`/workspaces/${workspace.id}`)
                return (
                  <Link key={workspace.id} href={`/workspaces/${workspace.id}`}>
                    <Card className={cn(
                      "cursor-pointer transition-all hover:shadow-md",
                      isActive && "ring-2 ring-primary"
                    )}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div
                              className="w-3 h-3 rounded-sm flex-shrink-0"
                              style={{ backgroundColor: workspace.color || '#3b82f6' }}
                            />
                            <span className="text-sm font-medium truncate">{workspace.name}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Workspace</span>
                          <div className="flex items-center gap-3">
                            <span>My open: {assignedTasksCount}</span>
                            <span>Done: {completedTasksCount}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
              {recentProjectsFull.map((project) => {
                const isActive = pathname === `/projects/${project.id}`
                return (
                  <Link key={project.id} href={`/projects/${project.id}`}>
                    <Card className={cn(
                      "cursor-pointer transition-all hover:shadow-md",
                      isActive && "ring-2 ring-primary"
                    )}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div
                              className="w-3 h-3 rounded-sm flex-shrink-0"
                              style={{ backgroundColor: getProjectColor(project) }}
                            />
                            <span className="text-sm font-medium truncate">{project.name}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Project</span>
                          <div className="flex items-center gap-3">
                            <span>My open: {assignedTasksCount}</span>
                            <span>Done: {completedTasksCount}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Starred */}
        {(starredProjects.length > 0 || starredWorkspaces.length > 0) && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Starred
            </h3>
            <div className="space-y-1">
              {starredWorkspaces.map((workspace) => {
                const isActive = pathname?.startsWith(`/workspaces/${workspace.id}`)
                return (
                  <Link key={workspace.id} href={`/workspaces/${workspace.id}`}>
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full justify-start text-sm h-8 px-2",
                        isActive && "bg-accent"
                      )}
                    >
                      <div
                        className="w-3 h-3 rounded-sm mr-2 flex-shrink-0"
                        style={{ backgroundColor: workspace.color || '#3b82f6' }}
                      />
                      <span className="flex-1 text-left truncate">{workspace.name}</span>
                    </Button>
                  </Link>
                )
              })}
              {starredProjects.map((project) => {
                const isActive = pathname === `/projects/${project.id}`
                return (
                  <Link key={project.id} href={`/projects/${project.id}`}>
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full justify-start text-sm h-8 px-2",
                        isActive && "bg-accent"
                      )}
                    >
                      <div
                        className="w-3 h-3 rounded-sm mr-2 flex-shrink-0"
                        style={{ backgroundColor: getProjectColor(project) }}
                      />
                      <span className="flex-1 text-left truncate">{project.name}</span>
                    </Button>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* My Projects */}
        {projects.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              My Projects
            </h3>
            <div className="space-y-1">
              {projects.slice(0, 10).map((project) => {
                const isActive = pathname === `/projects/${project.id}` || pathname?.startsWith(`/workspaces/${project.workspaceId}/projects/${project.id}`)
                return (
                  <Link key={project.id} href={project.workspaceId ? `/workspaces/${project.workspaceId}/projects/${project.id}` : `/projects/${project.id}`}>
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full justify-start text-sm h-8 px-2",
                        isActive && "bg-accent"
                      )}
                    >
                      <div
                        className="w-3 h-3 rounded-sm mr-2 flex-shrink-0"
                        style={{ backgroundColor: getProjectColor(project) }}
                      />
                      <span className="flex-1 text-left truncate">{project.name}</span>
                    </Button>
                  </Link>
                )
              })}
              {projects.length > 10 && (
                <Link href="/projects">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-sm h-8 px-2 text-muted-foreground"
                  >
                    <span className="text-xs">View all {projects.length} projects →</span>
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Quick links
          </h3>
          <div className="space-y-1">
            <Link href="/projects">
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start text-sm h-8 px-2",
                  pathname === '/projects' && "bg-accent"
                )}
              >
                <Building2 className="w-4 h-4 mr-2" />
                <span>All Projects</span>
              </Button>
            </Link>
            <Link href="/workspaces">
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start text-sm h-8 px-2",
                  pathname === '/workspaces' && "bg-accent"
                )}
              >
                <FolderKanban className="w-4 h-4 mr-2" />
                <span>All Workspaces</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
