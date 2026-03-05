'use client'

import { memo, useState, useMemo, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  MoreHorizontal,
  Star,
  Clock,
  ChevronDown,
  ChevronRight,
  Settings,
  Network,
  FolderKanban,
  History,
  TrendingUp,
  Workflow,
  Shield,
  ShieldCheck,
  Search,
  List,
  LayoutGrid,
  Bot,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { StarredPopover } from '@/components/sidebar/StarredPopover'
import { RecentPopover } from '@/components/sidebar/RecentPopover'
import { useSidebarLogic } from '@/hooks/useSidebarLogic'
import { SidebarHeader } from '@/components/sidebar/SidebarHeader'
import { SidebarCompanySwitcher } from '@/components/sidebar/SidebarCompanySwitcher'
import { SidebarSection } from '@/components/sidebar/SidebarSection'
import { SidebarNavItem } from '@/components/sidebar/SidebarNavItem'
import { SidebarCollapsibleItem } from '@/components/sidebar/SidebarCollapsibleItem'
import type { NavigationItem } from '@/config/navigation'
import type { EnhancedProject } from '@/types/project-schema'
import type { Workspace } from '@/types/workspace-schema'

interface SidebarClientProps {
  className?: string
  initialProjects?: EnhancedProject[]
  initialWorkspaces?: Workspace[]
  initialFilteredMainNav?: NavigationItem[]
  initialFilteredInsightsNav?: NavigationItem[]
  initialFilteredWorkflowNav?: NavigationItem[]
  initialFilteredAdminNav?: NavigationItem[]
  initialFilteredSettingsNav?: NavigationItem[]
  initialFilteredOrganizationNav?: NavigationItem[]
}

type AdminFilteredNav = {
  admin: NavigationItem[]
  governance: NavigationItem[]
  organization: NavigationItem[]
  workspaceConfig: NavigationItem[]
  settings: NavigationItem[]
}

const HOVER_CLOSE_DELAY = 150

function AdminCollapsedFirstLevel({ filteredNav, pathname }: { filteredNav: AdminFilteredNav; pathname: string }) {
  const [hoverKey, setHoverKey] = useState<'org' | 'workspace' | 'governance' | 'settings' | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleClose = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    closeTimerRef.current = setTimeout(() => setHoverKey(null), HOVER_CLOSE_DELAY)
  }, [])
  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const linkClass = (href: string, isActive: boolean) =>
    cn(
      'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
      isActive ? 'bg-accent text-foreground font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
    )

  const adminSettings = filteredNav.settings

  return (
    <div className="flex flex-col gap-0.5 border-t border-border pt-2 mt-1">
      {/* Organization (first-level icon + hover submenu) */}
      {filteredNav.organization.length > 0 && (
        <div className="flex justify-center w-full">
          <Popover open={hoverKey === 'org'} onOpenChange={open => !open && setHoverKey(null)}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-9 w-9 flex-shrink-0 justify-center text-muted-foreground hover:text-foreground hover:bg-accent',
                      filteredNav.organization.some(item => pathname === item.href || pathname?.startsWith(item.href + '/')) && 'text-foreground bg-accent'
                    )}
                    onMouseEnter={() => {
                      cancelClose()
                      setHoverKey('org')
                    }}
                    onMouseLeave={scheduleClose}
                  >
                    <Network className="w-5 h-5" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">Organization</TooltipContent>
            </Tooltip>
            <PopoverContent
              side="right"
              align="start"
              className="w-56 p-1"
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
            >
              <nav className="flex flex-col gap-0.5">
                {filteredNav.organization.map(item => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={linkClass(item.href, pathname === item.href || pathname?.startsWith(item.href + '/'))}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </Link>
                ))}
              </nav>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Workspace (first-level icon + hover submenu: Config) */}
      {filteredNav.workspaceConfig.length > 0 && (
        <div className="flex justify-center w-full">
          <Popover open={hoverKey === 'workspace'} onOpenChange={open => !open && setHoverKey(null)}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-9 w-9 flex-shrink-0 justify-center text-muted-foreground hover:text-foreground hover:bg-accent',
                      filteredNav.workspaceConfig.some(item => pathname === item.href || pathname?.startsWith(item.href + '/')) && 'text-foreground bg-accent'
                    )}
                    onMouseEnter={() => {
                      cancelClose()
                      setHoverKey('workspace')
                    }}
                    onMouseLeave={scheduleClose}
                  >
                    <LayoutGrid className="w-5 h-5" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">Workspace</TooltipContent>
            </Tooltip>
            <PopoverContent
              side="right"
              align="start"
              className="w-56 p-1"
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
            >
              <nav className="flex flex-col gap-0.5">
                {filteredNav.workspaceConfig.map(item => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={linkClass(item.href, pathname === item.href || pathname?.startsWith(item.href + '/'))}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </Link>
                ))}
              </nav>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Flat admin links (first-level icons only) */}
      {filteredNav.admin.map(item => (
        <SidebarNavItem
          key={item.id}
          href={item.href}
          name={item.name}
          icon={item.icon}
          isActive={pathname === item.href || pathname?.startsWith(item.href + '/')}
          isCollapsed={true}
          showChevron={false}
        />
      ))}

      {/* Governance (first-level icon + hover submenu) */}
      {filteredNav.governance.length > 0 && (
        <div className="flex justify-center w-full">
          <Popover open={hoverKey === 'governance'} onOpenChange={open => !open && setHoverKey(null)}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-9 w-9 flex-shrink-0 justify-center text-muted-foreground hover:text-foreground hover:bg-accent',
                      filteredNav.governance.some(item => pathname === item.href || pathname?.startsWith(item.href + '/')) && 'text-foreground bg-accent'
                    )}
                    onMouseEnter={() => {
                      cancelClose()
                      setHoverKey('governance')
                    }}
                    onMouseLeave={scheduleClose}
                  >
                    <ShieldCheck className="w-5 h-5" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">Governance</TooltipContent>
            </Tooltip>
            <PopoverContent
              side="right"
              align="start"
              className="w-56 p-1"
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
            >
              <nav className="flex flex-col gap-0.5">
                {filteredNav.governance.map(item => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={linkClass(item.href, pathname === item.href || pathname?.startsWith(item.href + '/'))}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </Link>
                ))}
              </nav>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Settings (first-level icon + hover submenu) */}
      {adminSettings.length > 0 && (
        <div className="flex justify-center w-full">
          <Popover open={hoverKey === 'settings'} onOpenChange={open => !open && setHoverKey(null)}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-9 w-9 flex-shrink-0 justify-center text-muted-foreground hover:text-foreground hover:bg-accent',
                      pathname?.startsWith('/settings') && 'text-foreground bg-accent'
                    )}
                    onMouseEnter={() => {
                      cancelClose()
                      setHoverKey('settings')
                    }}
                    onMouseLeave={scheduleClose}
                  >
                    <Settings className="w-5 h-5" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>
            <PopoverContent
              side="right"
              align="start"
              className="w-56 p-1"
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
            >
              <nav className="flex flex-col gap-0.5">
                {adminSettings.map(item => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={linkClass(item.href, pathname === item.href || pathname?.startsWith(item.href + '/'))}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </Link>
                ))}
              </nav>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  )
}

const MAX_VISIBLE_WORKSPACES = 5

function MoreWorkspacesPopover({ workspaces, pathname, router }: { workspaces: Workspace[]; pathname: string; router: any }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return workspaces
    const term = search.toLowerCase()
    return workspaces.filter(w => w.name.toLowerCase().includes(term))
  }, [workspaces, search])

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch('') }}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-2 h-9 min-h-9 px-3 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors w-full min-w-0 overflow-hidden text-left"
        >
          <List className="w-4 h-4 flex-shrink-0" />
          <span className="truncate flex-1 min-w-0">More workspaces</span>
          <ChevronRight className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-64 p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search all workspaces"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-sm"
              autoFocus
            />
          </div>
        </div>
        <div className="py-1">
          <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {search ? 'Results' : 'All workspaces'}
          </div>
          <ScrollArea className="max-h-64">
            <div className="flex flex-col gap-0.5 px-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-sm text-center text-muted-foreground">No workspaces found</div>
              ) : (
                filtered.map((workspace) => (
                  <Link
                    key={workspace.id}
                    href={`/workspaces/${workspace.id}`}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors min-w-0",
                      pathname?.startsWith(`/workspaces/${workspace.id}`)
                        ? "bg-accent text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    )}
                  >
                    <div
                      className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ backgroundColor: workspace.color || 'hsl(var(--primary))' }}
                    >
                      {workspace.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate min-w-0">{workspace.name}</span>
                  </Link>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
        <div className="border-t border-border p-1">
          <Link
            href="/workspaces"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-2.5 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            <List className="w-4 h-4 flex-shrink-0" />
            <span>View all workspaces</span>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function SidebarClientComponent(props: SidebarClientProps) {
  const {
    isCollapsed, setIsCollapsed,
    pathname, router,
    activeProjects, projectsLoading,
    workspaces,
    projectsByWorkspace,
    selectedWorkspace,
    starredProjects, starredWorkspaces,
    filteredNav,
    approvalCount, activeInstanceCount,
    projectsExpanded, setProjectsExpanded,
    workspacesExpanded, setWorkspacesExpanded,
    setWorkspaceExpanded,
    isWorkspaceExpanded,
    insightsExpanded, setInsightsExpanded,
    workflowsExpanded, setWorkflowsExpanded,
    governanceExpanded, setGovernanceExpanded,
    workflowSettingsExpanded, setWorkflowSettingsExpanded,
    settingsExpanded, setSettingsExpanded,
    adminExpanded, setAdminExpanded,
    organizationExpanded, setOrganizationExpanded,
    workspaceConfigExpanded, setWorkspaceConfigExpanded,
    getProjectColor,
    currentPathname
  } = useSidebarLogic(props)

  return (
    <TooltipProvider>
      <div className={cn(
        "flex flex-col h-screen border-r bg-card relative transition-all duration-300 ease-in-out group/sidebar overflow-visible flex-shrink-0",
        isCollapsed ? "w-16 min-w-[4rem]" : "w-64 min-w-[16rem]",
        props.className
      )}>
        <SidebarHeader
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
        >
          <SidebarCompanySwitcher isCollapsed={isCollapsed} inHeader />
        </SidebarHeader>

        <ScrollArea className="flex-1 overflow-x-hidden overflow-y-auto min-h-0 min-w-0">
          <nav className="flex flex-col gap-1 py-2 px-2 w-full min-w-0 max-w-full overflow-hidden">
            {/* Main nav + Recent + Favorites — same order expanded/collapsed */}
            <div className="flex flex-col gap-0.5">
              {filteredNav.main.map(item => (
                <SidebarNavItem
                  key={item.id}
                  href={item.href}
                  name={item.name}
                  icon={item.icon}
                  isActive={pathname === item.href}
                  isCollapsed={isCollapsed}
                />
              ))}

              <SidebarNavItem
                href="/ceo-agent"
                name="CEO Agent"
                icon={Bot}
                isActive={pathname === '/ceo-agent'}
                isCollapsed={isCollapsed}
                iconColor="text-purple-600"
              />

              {isCollapsed ? (
                <>
                  <div className="flex justify-center w-full">
                    <RecentPopover
                      projects={activeProjects}
                      workspaces={workspaces}
                      getProjectColor={getProjectColor}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-9 w-9 flex-shrink-0 justify-center text-muted-foreground hover:text-foreground hover:bg-accent",
                              (pathname?.startsWith('/projects') || pathname?.startsWith('/workspaces')) && "text-foreground bg-accent"
                            )}
                          >
                            <Clock className="w-5 h-5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">Recent</TooltipContent>
                      </Tooltip>
                    </RecentPopover>
                  </div>
                  <div className="flex justify-center w-full">
                    <StarredPopover
                      starredProjects={starredProjects}
                      starredWorkspaces={starredWorkspaces}
                      workspaces={workspaces}
                      getProjectColor={getProjectColor}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-9 w-9 flex-shrink-0 justify-center text-muted-foreground hover:text-foreground hover:bg-accent",
                              pathname === '/favorites' && "text-foreground bg-accent"
                            )}
                          >
                            <Star className="w-5 h-5 fill-warning text-warning" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">Favorites</TooltipContent>
                      </Tooltip>
                    </StarredPopover>
                  </div>
                  <SidebarNavItem
                    href="/workspaces"
                    name="Workspaces"
                    icon={FolderKanban}
                    isActive={pathname?.startsWith('/workspaces')}
                    isCollapsed={true}
                  />
                </>
              ) : (
                <>
                  <RecentPopover
                    projects={activeProjects}
                    workspaces={workspaces}
                    getProjectColor={getProjectColor}
                  >
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full justify-start gap-2 h-9 min-h-9 px-3 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent group overflow-hidden font-medium",
                        (pathname?.startsWith('/projects') || pathname?.startsWith('/workspaces')) && "text-foreground bg-accent/50"
                      )}
                    >
                      <Clock className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 text-left truncate">Recent</span>
                      <MoreHorizontal className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Button>
                  </RecentPopover>
                  <StarredPopover
                    starredProjects={starredProjects}
                    starredWorkspaces={starredWorkspaces}
                    workspaces={workspaces}
                    getProjectColor={getProjectColor}
                  >
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full justify-start gap-2 h-9 min-h-9 px-3 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent group overflow-hidden font-medium",
                        pathname === '/favorites' && "text-foreground bg-accent"
                      )}
                    >
                      <Star className="w-4 h-4 flex-shrink-0 fill-warning text-warning" />
                      <span className="flex-1 text-left truncate">Favorites</span>
                      <MoreHorizontal className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Button>
                  </StarredPopover>
                </>
              )}
            </div>

            {/* Workspaces & Projects (Jira-style: workspaces with nested projects) */}
            {!isCollapsed && (
              <SidebarSection
                title="Workspaces"
                icon={FolderKanban}
                isExpanded={workspacesExpanded}
                onToggle={() => setWorkspacesExpanded(!workspacesExpanded)}
                onCreateClick={() => router.push('/workspaces/create')}
                onCreateProjectClick={() => router.push(`/projects/create${selectedWorkspace ? `?workspaceId=${selectedWorkspace.id}` : ''}`)}
                createProjectTooltip="New project"
              >
                {workspaces.slice(0, 5).map((workspace) => {
                  const expanded = isWorkspaceExpanded(workspace.id)
                  const workspaceProjects = projectsByWorkspace[workspace.id] ?? []
                  return (
                    <div key={workspace.id} className="space-y-0.5 min-w-0">
                      <div className="group flex items-center min-w-0 rounded-md overflow-hidden h-9">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            setWorkspaceExpanded(workspace.id, !expanded)
                          }}
                          className="flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-md hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={expanded ? 'Collapse' : 'Expand'}
                        >
                          <span className="relative w-4 h-4 flex items-center justify-center">
                            <div
                              className={cn("w-3 h-3 rounded-sm flex-shrink-0 bg-primary/20 border border-primary/40 transition-opacity group-hover:opacity-0")}
                              style={workspace.color ? { backgroundColor: `${workspace.color}20`, borderColor: `${workspace.color}40` } : {}}
                            />
                            {expanded ? (
                              <ChevronDown className="absolute w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                            ) : (
                              <ChevronRight className="absolute w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                          </span>
                        </button>
                        <Link
                          href={`/workspaces/${workspace.id}`}
                          className={cn(
                            "flex items-center gap-2 flex-1 min-w-0 h-9 px-2 rounded-md text-sm font-medium transition-colors overflow-hidden",
                            pathname?.startsWith(`/workspaces/${workspace.id}`)
                              ? "bg-accent text-foreground"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                          )}
                        >
                          <span className="truncate min-w-0" title={workspace.name}>{workspace.name}</span>
                          {!(workspace as any).isMember && (
                            <span className="ml-2 px-1.5 py-0.5 rounded-full bg-muted text-[9px] font-bold text-muted-foreground uppercase tracking-wider flex-shrink-0">
                              Guest
                            </span>
                          )}
                          {(workspaceProjects.length > 0 && (workspace as any).isMember) && (
                            <span className="text-xs text-muted-foreground flex-shrink-0 ml-auto">
                              {workspaceProjects.length}
                            </span>
                          )}
                        </Link>
                      </div>
                      {expanded && (
                        <div className="ml-9 mt-0.5 space-y-0.5">
                          {workspaceProjects.length > 0 && (
                            workspaceProjects.map((project) => (
                              <SidebarNavItem
                                key={project.id}
                                href={`/projects/${project.id}`}
                                name={project.name}
                                icon={({ className }: any) => (
                                  <div
                                    className={cn("w-3 h-3 rounded-sm", className)}
                                    style={{ backgroundColor: getProjectColor(project) }}
                                  />
                                )}
                                isActive={currentPathname === `/projects/${project.id}`}
                              />
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                {/* "More workspaces" — shown when >5 workspaces */}
                {workspaces.length > 5 && (
                  <MoreWorkspacesPopover workspaces={workspaces} pathname={pathname} router={router} />
                )}
                {/* Orphaned projects (workspace no longer in list) */}
                {(() => {
                  const workspaceIds = new Set(workspaces.map(w => w.id))
                  const orphaned = activeProjects.filter(p => p.workspaceId && !workspaceIds.has(p.workspaceId))
                  if (orphaned.length === 0) return null
                  const otherExpanded = isWorkspaceExpanded('__other__')
                  return (
                    <div className="space-y-0.5 mt-1 pt-1 border-t border-border/50">
                      <div className="group flex items-center min-w-0 rounded-md overflow-hidden h-9">
                        <button
                          type="button"
                          onClick={() => setWorkspaceExpanded('__other__', !otherExpanded)}
                          className="flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-md hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={otherExpanded ? 'Collapse' : 'Expand'}
                        >
                          <span className="relative w-4 h-4 flex items-center justify-center">
                            <div className="w-3 h-3 rounded-sm flex-shrink-0 bg-muted-foreground/30 border border-border transition-opacity group-hover:opacity-0" />
                            {otherExpanded ? (
                              <ChevronDown className="absolute w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                            ) : (
                              <ChevronRight className="absolute w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                          </span>
                        </button>
                        <span className="flex-1 h-9 px-2 flex items-center text-sm font-medium text-muted-foreground truncate">
                          Other projects
                        </span>
                        <span className="text-xs text-muted-foreground flex-shrink-0 pr-2">{orphaned.length}</span>
                      </div>
                      {otherExpanded && (
                        <div className="ml-9 mt-0.5 space-y-0.5">
                          {orphaned.map((project) => (
                            <SidebarNavItem
                              key={project.id}
                              href={`/projects/${project.id}`}
                              name={project.name}
                              icon={({ className }: any) => (
                                <div
                                  className={cn("w-3 h-3 rounded-sm", className)}
                                  style={{ backgroundColor: getProjectColor(project) }}
                                />
                              )}
                              isActive={currentPathname === `/projects/${project.id}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}
                {workspaces.length === 0 && !projectsLoading && activeProjects.length === 0 && (
                  <div className="px-3 py-1 text-xs text-muted-foreground">No workspaces</div>
                )}
                {workspaces.length === 0 && (projectsLoading || activeProjects.length > 0) && (
                  <div className="px-3 py-1 text-xs text-muted-foreground">No workspaces — create one to organize projects</div>
                )}
              </SidebarSection>
            )}

            {/* Workflows — section when expanded, parent icon + submenu popover when collapsed */}
            {filteredNav.workflows.length > 0 && (
              <>
                {isCollapsed ? (
                  <div className="flex justify-center w-full border-t border-border pt-2 mt-1">
                    <Popover>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-9 w-9 flex-shrink-0 justify-center text-muted-foreground hover:text-foreground hover:bg-accent",
                                filteredNav.workflows.some(item => pathname === item.href || pathname?.startsWith(item.href + '/')) && "text-foreground bg-accent"
                              )}
                            >
                              <History className="w-5 h-5" />
                            </Button>
                          </PopoverTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="right">Workflows</TooltipContent>
                      </Tooltip>
                      <PopoverContent side="right" align="start" className="w-56 p-1">
                        <nav className="flex flex-col gap-0.5">
                          {filteredNav.workflows.map(item => (
                            <Link
                              key={item.id}
                              href={item.href}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                                pathname === item.href || pathname?.startsWith(item.href + '/')
                                  ? "bg-accent text-foreground font-medium"
                                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                              )}
                            >
                              <item.icon className="w-4 h-4 flex-shrink-0" />
                              <span className="truncate">{item.name}</span>
                              {(item.id === 'workflow-instances' ? activeInstanceCount : item.id === 'approval-inbox' ? approvalCount : 0) > 0 && (
                                <span className={cn(
                                  "ml-auto min-w-[20px] h-5 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5",
                                  item.id === 'approval-inbox' ? "bg-red-500" : "bg-blue-500"
                                )}>
                                  {item.id === 'workflow-instances' ? (activeInstanceCount > 99 ? '99+' : activeInstanceCount) : (approvalCount > 99 ? '99+' : approvalCount)}
                                </span>
                              )}
                            </Link>
                          ))}
                        </nav>
                      </PopoverContent>
                    </Popover>
                  </div>
                ) : (
                  <SidebarSection
                    title="Workflows"
                    icon={Workflow}
                    isExpanded={workflowsExpanded}
                    onToggle={() => setWorkflowsExpanded(!workflowsExpanded)}
                  >
                    {filteredNav.workflows.map(item => (
                      <SidebarNavItem
                        key={item.id}
                        href={item.href}
                        name={item.name}
                        icon={item.icon}
                        isActive={pathname === item.href || pathname?.startsWith(item.href + '/')}
                        badgeCount={item.id === 'workflow-instances' ? activeInstanceCount : item.id === 'approval-inbox' ? approvalCount : undefined}
                        badgeVariant={item.id === 'approval-inbox' ? 'danger' : 'default'}
                      />
                    ))}
                  </SidebarSection>
                )}
              </>
            )}

            {/* Insights — section when expanded, parent icon + submenu popover when collapsed */}
            {filteredNav.insights.length > 0 && (
              <>
                {isCollapsed ? (
                  <div className="flex justify-center w-full border-t border-border pt-2 mt-1">
                    <Popover>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-9 w-9 flex-shrink-0 justify-center text-muted-foreground hover:text-foreground hover:bg-accent",
                                filteredNav.insights.some(item => pathname === item.href || pathname?.startsWith(item.href + '/')) && "text-foreground bg-accent"
                              )}
                            >
                              <TrendingUp className="w-5 h-5" />
                            </Button>
                          </PopoverTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="right">Insights</TooltipContent>
                      </Tooltip>
                      <PopoverContent side="right" align="start" className="w-56 p-1">
                        <nav className="flex flex-col gap-0.5">
                          {filteredNav.insights.map(item => (
                            <Link
                              key={item.id}
                              href={item.href}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                                pathname === item.href || pathname?.startsWith(item.href + '/')
                                  ? "bg-accent text-foreground font-medium"
                                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                              )}
                            >
                              <item.icon className="w-4 h-4 flex-shrink-0" />
                              <span className="truncate">{item.name}</span>
                            </Link>
                          ))}
                        </nav>
                      </PopoverContent>
                    </Popover>
                  </div>
                ) : (
                  <SidebarSection
                    title="Insights"
                    icon={TrendingUp}
                    isExpanded={insightsExpanded}
                    onToggle={() => setInsightsExpanded(!insightsExpanded)}
                  >
                    {filteredNav.insights.map(item => (
                      <SidebarNavItem
                        key={item.id}
                        href={item.href}
                        name={item.name}
                        icon={item.icon}
                        isActive={pathname === item.href || pathname?.startsWith(item.href + '/')}
                      />
                    ))}
                  </SidebarSection>
                )}
              </>
            )}

            {/* Admin Section */}
            {!isCollapsed && (filteredNav.admin.length > 0 || filteredNav.organization.length > 0 || filteredNav.workspaceConfig.length > 0 || filteredNav.governance.length > 0) && (
              <SidebarSection
                title="Admin"
                icon={Shield}
                isExpanded={adminExpanded}
                onToggle={() => setAdminExpanded(!adminExpanded)}
              >
                {/* Organization Submenu */}
                {filteredNav.organization.length > 0 && (
                  <SidebarCollapsibleItem
                    name="Organization"
                    icon={Network}
                    isExpanded={organizationExpanded}
                    onToggle={() => setOrganizationExpanded(!organizationExpanded)}
                    isActive={filteredNav.organization.some(item => pathname === item.href || pathname?.startsWith(item.href + '/'))}
                  >
                    {filteredNav.organization.map(item => (
                      <SidebarNavItem
                        key={item.id}
                        href={item.href}
                        name={item.name}
                        icon={item.icon}
                        isActive={pathname === item.href || pathname?.startsWith(item.href + '/')}
                      />
                    ))}
                  </SidebarCollapsibleItem>
                )}

                {/* Workspace Submenu (Config) */}
                {filteredNav.workspaceConfig.length > 0 && (
                  <SidebarCollapsibleItem
                    name="Workspace"
                    icon={LayoutGrid}
                    isExpanded={workspaceConfigExpanded}
                    onToggle={() => setWorkspaceConfigExpanded(!workspaceConfigExpanded)}
                    isActive={filteredNav.workspaceConfig.some(item => pathname === item.href || pathname?.startsWith(item.href + '/'))}
                  >
                    {filteredNav.workspaceConfig.map(item => (
                      <SidebarNavItem
                        key={item.id}
                        href={item.href}
                        name={item.name}
                        icon={item.icon}
                        isActive={pathname === item.href || pathname?.startsWith(item.href + '/')}
                      />
                    ))}
                  </SidebarCollapsibleItem>
                )}

                {/* Governance Submenu */}
                {filteredNav.governance.length > 0 && (
                  <SidebarCollapsibleItem
                    name="Governance"
                    icon={ShieldCheck}
                    isExpanded={governanceExpanded}
                    onToggle={() => setGovernanceExpanded(!governanceExpanded)}
                    isActive={filteredNav.governance.some(item => pathname === item.href || pathname?.startsWith(item.href + '/'))}
                  >
                    {filteredNav.governance.map(item => (
                      <SidebarNavItem
                        key={item.id}
                        href={item.href}
                        name={item.name}
                        icon={item.icon}
                        isActive={pathname === item.href || pathname?.startsWith(item.href + '/')}
                      />
                    ))}
                  </SidebarCollapsibleItem>
                )}

                {/* Flat Admin links */}
                {filteredNav.admin.map(item => (
                  <SidebarNavItem
                    key={item.id}
                    href={item.href}
                    name={item.name}
                    icon={item.icon}
                    isActive={pathname === item.href || pathname?.startsWith(item.href + '/')}
                  />
                ))}

                {/* Settings Submenu (General, Appearance, Notifications, etc.) */}
                {filteredNav.settings.length > 0 && (
                  <SidebarCollapsibleItem
                    name="Settings"
                    icon={Settings}
                    isExpanded={settingsExpanded}
                    onToggle={() => setSettingsExpanded(!settingsExpanded)}
                    isActive={filteredNav.settings.some(item => pathname === item.href || pathname?.startsWith(item.href + '/'))}
                  >
                    {filteredNav.settings.map(item => (
                      <SidebarNavItem
                        key={item.id}
                        href={item.href}
                        name={item.name}
                        icon={item.icon}
                        isActive={pathname === item.href || pathname?.startsWith(item.href + '/')}
                      />
                    ))}
                  </SidebarCollapsibleItem>
                )}
              </SidebarSection>
            )}

            {/* Admin in Collapsed Mode — first-level items as icons; children on hover */}
            {isCollapsed && (filteredNav.admin.length > 0 || filteredNav.organization.length > 0 || filteredNav.workspaceConfig.length > 0 || filteredNav.governance.length > 0 || filteredNav.settings.length > 0) && (
              <AdminCollapsedFirstLevel
                filteredNav={filteredNav}
                pathname={pathname}
              />
            )}
          </nav>
        </ScrollArea>

        {/* Footer */}
        {!isCollapsed && (
          <div className="px-3 py-2 mt-auto border-t border-border/50">
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">Powered by</span>
              <Image
                src="/julley-logo.webp"
                alt="Julley"
                width={32}
                height={12}
                className="object-contain opacity-50 hover:opacity-70 transition-opacity"
                priority={false}
              />
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

export const SidebarClient = memo(SidebarClientComponent)
