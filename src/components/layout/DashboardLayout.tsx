'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { Button } from '@/components/ui/button'
import { Menu, ChevronRight, Bell, User, Settings, LogOut, Home, Search, BarChart3, Plus, UserCog, X } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useNotifications } from '@/contexts/NotificationContext'
import { CommandPalette } from '@/components/command'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TaskForm, type TaskFormData } from '@/components/features/tasks/TaskForm'
import { useUIStore } from '@/store/uiStore'
import { useSidebarStore } from '@/store/sidebarStore'
import { useCompany } from '@/contexts/CompanyContext'
import { TaskTemplateService } from '@/lib/services'
import { uploadTaskAttachments } from '@/lib/services/storage/task-attachment-service'
import { OrgChartDrawer } from '@/components/features/org/OrgChartDrawer'
import { ThemeToggle } from '@/components/providers/ThemeToggle'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface DashboardLayoutProps {
  children: React.ReactNode
  contentClassName?: string
  /** When true, the main content area does not scroll; only inner content (e.g. table) scrolls. Use for pages that manage their own scroll. */
  contentAreaOverflowHidden?: boolean
}

export function DashboardLayout({ children, contentClassName, contentAreaOverflowHidden }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [orgChartOpen, setOrgChartOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuthStore()
  const { unreadCount, notifications: recentNotifications } = useNotifications()
  const profileRef = useRef<HTMLDivElement>(null)
  const notificationsRef = useRef<HTMLDivElement>(null)
  const { companyId, groupId } = useCompany()
  const createTaskRequested = useUIStore(s => s.createTaskRequested)
  const requestedProjectId = useUIStore(s => s.createTaskProjectId)
  const clearCreateTaskRequest = useUIStore(s => s.clearCreateTaskRequest)
  const requestCreateTask = useUIStore(s => s.requestCreateTask)
  const sidebarCollapsed = useSidebarStore(s => s.collapsed)

  // Derive projectId from current path if applicable
  const deriveProjectIdFromPath = () => {
    const segments = pathname.split('/').filter(Boolean)
    if (segments[0] === 'projects' && segments[1] && segments[1] !== 'create') {
      return segments[1]
    }
    return undefined
  }
  const currentProjectId = requestedProjectId || deriveProjectIdFromPath()

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  useEffect(() => {
    if (createTaskRequested) {
      setCreateDialogOpen(true)
    }
  }, [createTaskRequested])

  const handleCreateTaskSubmit = async (data: TaskFormData) => {
    if (!companyId || !user?.id) return
    setIsCreatingTask(true)
    try {
      // Service now returns the FULL task object (including taskNumber)
      const createdTask = await TaskTemplateService.createManualTask(companyId, user.id, {
        title: data.title,
        description: data.description,
        priority: data.priority as any,
        estimatedHours: data.estimatedHours,
        dueDate: data.dueDate,
        projectId: data.projectId,
        assignee: data.assignee,
        assignedPositionId: data.assignedPositionId,
        assignedToName: data.assignedToName,
        reporter: data.reporter,
        reporterName: data.reporterName,
        reporterPositionId: data.reporterPositionId,
        taskType: data.taskType,
        requirementType: data.requirementType,
        // WBS Fields
        startDate: data.startDate,
        endDate: data.endDate || data.dueDate, // Default endDate to dueDate if not provided
        isMilestone: data.isMilestone,
        targetDate: data.targetDate,
        workflowId: data.workflowId,
        workflowDefinitionId: data.workflowDefinitionId,
        escalationPolicyId: data.escalationPolicyId,
      }, groupId ?? undefined)

      // Upload staged attachments if any
      if (data.stagedAttachments && data.stagedAttachments.length > 0 && createdTask?.id) {
        try {
          const attachments = await uploadTaskAttachments(data.stagedAttachments, {
            taskId: createdTask.id,
            companyId,
            projectId: data.projectId,
            userId: user.id,
            groupId: groupId ?? undefined,
          })
          // Merge attachments into the created task for the event
          if (attachments.length > 0) {
            createdTask.attachments = attachments
          }
          toast.success(`Task created with ${attachments.length} attachment${attachments.length > 1 ? 's' : ''}!`)
        } catch (uploadError) {
          console.error('Error uploading attachments:', uploadError)
          toast.error('Task created but some attachments failed to upload')
        }
      } else {
        toast.success('Task created successfully!')
      }

      setCreateDialogOpen(false)
      clearCreateTaskRequest()

      // Use the actual created task object which contains the correct taskNumber
      const newTask = createdTask

      // Dispatch custom event to notify components to refresh their task lists
      // This avoids full page reload and only updates task sections
      window.dispatchEvent(new CustomEvent('taskCreated', {
        detail: { projectId: data.projectId, task: newTask }
      }))
    } catch (error) {
      console.error('Error creating task:', error)
      toast.error('Failed to create task')
      // Keep dialog open on error so user can retry
    } finally {
      setIsCreatingTask(false)
    }
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false)
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Function to get page title based on route
  const getPageTitle = (path: string) => {
    const routeMap: Record<string, string> = {
      '/dashboard': 'Dashboard',


      '/profile': 'My Profile',
      '/my-tasks': 'My Tasks',
      '/task-library': 'Task Library',
      '/task-templates': 'Task Templates',
      '/position-task-assignments': 'Position Assignments',
      '/projects': 'Projects',
      '/projects/create': 'Create Project',
      '/workflow': 'Workflow Designer',
      '/organization': 'Organization',
      '/org-chart': 'Organization Chart',
      '/people': 'People',
      '/notifications': 'Notifications',
      '/preferences': 'Preferences',
      '/settings/general': 'General',
      '/settings/appearance': 'Appearance',
      '/settings/notifications': 'Notifications',
      '/governance/approval-lines': 'Approval Lines',
      '/governance/escalation-paths': 'Escalation Paths',
      '/analytics': 'Sales Performance',
      '/sales': 'Sales Report',
      '/data-management': 'Data Management',
      '/admin/imports': 'Import History',
      '/admin/workspace/config': 'Workspace Config',
      '/executive-dashboard': 'Executive Dashboard',
      '/executive-dashboard/pending-actions': 'Executive Dashboard',
      '/executive-dashboard/strategic-health/at-risk': 'Executive Dashboard',
      '/executive-dashboard/strategic-health/overdue-tasks': 'Executive Dashboard',
      '/executive-dashboard/strategic-health/resource-utilization': 'Executive Dashboard',
      '/workspaces': 'Workspaces',
      '/workspaces/create': 'Workspaces'
    }

    if (routeMap[path]) return routeMap[path]
    if (path.startsWith('/workspaces/')) return 'Workspaces'
    return ''
  }


  const handleSignOut = async () => {
    try {
      await signOut()
      setProfileDropdownOpen(false)
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  return (
    <div className="flex h-screen bg-background print:h-auto print:block overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden print:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex w-64 h-full">
            <Sidebar key="mobile-sidebar" className="relative" />
          </div>
        </div>
      )}

      {/* Desktop sidebar - fixed positioned; width follows collapsed state */}
      <div
        className={cn(
          'hidden lg:flex lg:flex-shrink-0 print:hidden fixed left-0 top-0 bottom-0 z-40 transition-[width] duration-300 ease-in-out',
          sidebarCollapsed ? 'w-16 min-w-[4rem]' : 'w-64 min-w-[16rem]'
        )}
      >
        <Sidebar key="desktop-sidebar" />
      </div>

      {/* Main content area - left margin and width follow sidebar collapsed state */}
      <div
        className={cn(
          'flex-1 flex flex-col min-h-0 bg-background print:overflow-visible print:h-auto print:block w-full transition-all duration-300 ease-in-out',
          contentAreaOverflowHidden ? 'overflow-hidden' : 'overflow-y-auto',
          sidebarCollapsed ? 'lg:ml-16 lg:w-[calc(100%-4rem)]' : 'lg:ml-64 lg:w-[calc(100%-16rem)]'
        )}
      >
        {/* Topbar - fixed when contentAreaOverflowHidden (e.g. People), otherwise sticky */}
        <div
          className={cn(
            'bg-card border-b border-border px-6 lg:px-6 py-1 print:hidden flex-shrink-0 h-16 flex items-center transition-all duration-300 ease-in-out z-50',
            contentAreaOverflowHidden
              ? cn('fixed top-0 right-0 left-0', sidebarCollapsed ? 'lg:left-16' : 'lg:left-64')
              : 'sticky top-0'
          )}
        >
          <div className="flex items-center justify-between w-full">
            {/* Left side - Mobile menu button and page title */}
            <div className="flex items-center gap-4">
              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-muted-foreground hover:text-foreground"
              >
                <Menu className="w-5 h-5" />
              </Button>

              {/* Environment Badge - Only show for development / stage (NEXT_PUBLIC_ENV_TYPE) */}
              {(() => {
                const envType = process.env.NEXT_PUBLIC_ENV_TYPE?.toLowerCase()
                const showBadge = envType === 'development' || envType === 'dev' || envType === 'stage'
                const label = envType === 'dev' ? 'DEV' : envType === 'development' ? 'DEVELOPMENT' : envType === 'stage' ? 'STAGE' : ''
                if (!showBadge || !label) return null
                return (
                  <span className="px-2 py-1 text-xs font-semibold rounded-md bg-yellow-500/20 text-yellow-700 dark:bg-yellow-500/30 dark:text-yellow-400 border border-yellow-500/30">
                    {label}
                  </span>
                )
              })()}

              {/* Page Title */}
              {getPageTitle(pathname) && (
                <h1 className="text-xl font-semibold text-foreground hidden sm:block">
                  {getPageTitle(pathname)}
                </h1>
              )}
            </div>

            {/* Right side - Search, Notifications and User Profile */}
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => requestCreateTask(currentProjectId)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                <span>Create Task</span>
              </Button>
              {/* Command Palette Trigger */}
              <Button
                variant="outline"
                onClick={() => setCommandPaletteOpen(true)}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <Search className="h-4 w-4" />
                <span className="hidden md:inline">Search</span>
                <kbd className="hidden md:inline pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 ml-2">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </Button>
              {/* Theme Toggle */}
              <ThemeToggle />
              {/* Settings */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Settings className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    onClick={() => {
                      router.push('/preferences')
                    }}
                    className="cursor-pointer"
                  >
                    <UserCog className="w-4 h-4 mr-2" />
                    <span>Preferences</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      router.push('/settings/notifications')
                    }}
                    className="cursor-pointer"
                  >
                    <Bell className="w-4 h-4 mr-2" />
                    <span>Notification Settings</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {/* Notifications */}
              <div className="relative" ref={notificationsRef}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative text-muted-foreground hover:text-foreground"
                >
                  <Bell className="w-5 h-5" />
                  {/* Notification badge */}
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center px-1">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Button>

                {/* Notifications dropdown */}
                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-popover rounded-lg shadow-lg border z-[70] max-h-96 overflow-hidden flex flex-col">
                    <div className="p-4 border-b flex items-center justify-between bg-card sticky top-0 z-10">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-popover-foreground">Notifications</h3>
                        {unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded-full">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => setNotificationsOpen(false)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="overflow-y-auto flex-1">
                      {recentNotifications.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                          <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>No notifications</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-border">
                          {recentNotifications.slice(0, 5).map((notification) => (
                            <div
                              key={notification.id}
                              className={`p-3 hover:bg-accent transition-colors cursor-pointer ${!notification.isRead ? 'bg-accent/50' : ''}`}
                              onClick={() => {
                                console.log('[NotificationClick] Clicked notification:', notification);

                                // Helper to extract path from URL (handles both absolute and relative URLs)
                                const extractPath = (url: string | undefined | null): string | null => {
                                  if (!url) return null;
                                  try {
                                    // If it's an absolute URL, extract just the pathname + search
                                    if (url.startsWith('http://') || url.startsWith('https://')) {
                                      const urlObj = new URL(url);
                                      return urlObj.pathname + urlObj.search;
                                    }
                                    // Already a relative path
                                    return url;
                                  } catch {
                                    return url;
                                  }
                                };

                                let targetUrl: string | null = extractPath(notification.actionUrl);

                                // For approval_required notifications, navigate to the Approvals tab
                                if (notification.type === 'approval_required') {
                                  targetUrl = '/my-tasks?tab=approvals';
                                }
                                // For approval_rejected notifications, navigate to the specific task
                                else if (notification.type === 'approval_rejected') {
                                  // Use actionUrl if available, otherwise construct from taskId/projectId
                                  if (!targetUrl) {
                                    const taskId = notification.taskId || notification.metadata?.taskId;
                                    const projectId = notification.projectId || notification.metadata?.projectId;
                                    if (projectId && taskId) {
                                      targetUrl = `/projects/${projectId}/tasks/${taskId}`;
                                    } else if (taskId) {
                                      targetUrl = `/my-tasks?task=${taskId}`;
                                    }
                                  }
                                }
                                // Default fallback for other notification types
                                else if (!targetUrl) {
                                  const taskId = notification.taskId || notification.metadata?.taskId;
                                  const projectId = notification.projectId || notification.metadata?.projectId;
                                  if (projectId && taskId) {
                                    targetUrl = `/projects/${projectId}/tasks/${taskId}`;
                                  } else if (taskId) {
                                    targetUrl = `/my-tasks?task=${taskId}`;
                                  }
                                }

                                console.log('[NotificationClick] Navigating to:', targetUrl);
                                if (targetUrl) {
                                  router.push(targetUrl);
                                  setNotificationsOpen(false);
                                } else {
                                  console.warn('[NotificationClick] No actionable URL found for notification', notification.id);
                                  toast.error('Cannot open task: Link is missing');
                                }
                              }}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium ${!notification.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    {notification.title}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate mt-1">
                                    {notification.message}
                                  </p>
                                </div>
                                {!notification.isRead && (
                                  <span className="w-2 h-2 bg-blue-600 rounded-full ml-2 flex-shrink-0"></span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {recentNotifications.length > 0 && (
                      <div className="p-3 border-t border-border">
                        <Link href="/notifications">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full"
                            onClick={() => setNotificationsOpen(false)}
                          >
                            View all notifications
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* User Profile */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center space-x-3 hover:bg-accent rounded-lg p-2 transition-colors"
                >
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center overflow-hidden">
                    {user?.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name || 'User'}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-medium text-white">
                        {user?.name?.charAt(0) || 'S'}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-foreground">
                    {user?.name || 'Admin User'}
                  </span>
                </button>

                {/* Profile Dropdown */}
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-popover rounded-lg shadow-lg border z-[70]">
                    <div className="p-2">
                      <Link href="/profile">
                        <button
                          onClick={() => setProfileDropdownOpen(false)}
                          className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-popover-foreground hover:bg-accent rounded-md transition-colors"
                        >
                          <User className="w-4 h-4" />
                          <span>My Profile</span>
                        </button>
                      </Link>
                      <button
                        onClick={() => {
                          setOrgChartOpen(true)
                          setProfileDropdownOpen(false)
                        }}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-popover-foreground hover:bg-accent rounded-md transition-colors"
                      >
                        <BarChart3 className="w-4 h-4" />
                        <span>Org Chart</span>
                      </button>
                      <Link href="/settings/general">
                        <button
                          onClick={() => setProfileDropdownOpen(false)}
                          className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-popover-foreground hover:bg-accent rounded-md transition-colors"
                        >
                          <Settings className="w-4 h-4" />
                          <span>Settings</span>
                        </button>
                      </Link>
                      <div className="border-t border-border my-1"></div>
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Page content with consistent spacing; pt-16 when topbar is fixed so content starts below it */}
        <main
          className={cn(
            'flex-1 flex flex-col min-h-0 p-6 print:overflow-visible print:h-auto print:p-0',
            contentAreaOverflowHidden && 'pt-16',
            contentClassName
          )}
        >
          {children}
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
      <TaskForm
        isOpen={createDialogOpen}
        onClose={() => { setCreateDialogOpen(false); clearCreateTaskRequest() }}
        onSubmit={handleCreateTaskSubmit}
        mode="create"
        defaultProjectId={currentProjectId}
        defaults={useUIStore.getState().createTaskDefaults || undefined}
        showWbsFields={false}
        isLoading={isCreatingTask}
      />
      {/* Org Chart Drawer */}
      <OrgChartDrawer open={orgChartOpen} onOpenChange={setOrgChartOpen} />
    </div>
  )
}
