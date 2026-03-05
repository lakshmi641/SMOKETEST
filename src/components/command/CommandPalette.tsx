'use client'

import { useEffect, useState, useCallback } from 'react'
import { Command } from 'cmdk'
import { useRouter } from 'next/navigation'
import {
  Search,
  Plus,
  FolderKanban,
  CheckSquare,
  Users,
  Settings,
  Home,
  Building2,
  Calendar,
  Network,
  Workflow,
  Bell,
  Library,
  FileText,
  UserCheck,
  BarChart3,
  Database
} from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { usePathname } from 'next/navigation'
import { PermissionService } from '@/lib/services/permission-service'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: React.ComponentType<{ className?: string }>
  action: () => void
  keywords?: string[]
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const { currentCompany, currentCompanyUser } = useCompany()
  const { user } = useAuthStore()
  const [search, setSearch] = useState('')
  const [recentProjects, setRecentProjects] = useState<any[]>([])

  // Keyboard shortcut - Cmd+K or Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open, onOpenChange])

  // Close on Escape
  useEffect(() => {
    if (open) {
      setSearch('')
    }
  }, [open])

  const handleSelect = useCallback((callback: () => void) => {
    onOpenChange(false)
    setTimeout(() => {
      callback()
    }, 100)
  }, [onOpenChange])

  // Define all available commands
  const pathname = usePathname()

  const quickActions: CommandItem[] = [
    {
      id: 'create-project',
      label: 'Create Project',
      description: 'Start a new manufacturing project',
      icon: Plus,
      action: () => {
        let workspaceIdFromPath: string | undefined
        const segments = pathname.split('/').filter(Boolean)
        if (segments[0] === 'workspaces' && segments[1]) {
          workspaceIdFromPath = segments[1]
        }
        router.push(`/projects/create${workspaceIdFromPath ? `?workspaceId=${workspaceIdFromPath}` : ''}`)
      },
      keywords: ['new', 'add', 'project']
    },
    {
      id: 'create-task',
      label: 'Create Task',
      description: 'Add a new task',
      icon: CheckSquare,
      action: () => {
        // Set global flag to open task dialog and navigate to My Tasks
        try {
          // Use store directly to avoid hook usage here
          const { requestCreateTask } = useUIStore.getState()
          // If currently within a project route, prefill with that projectId
          let projectIdFromPath: string | undefined
          const segments = pathname.split('/').filter(Boolean)
          if (segments[0] === 'projects' && segments[1] && segments[1] !== 'create') {
            projectIdFromPath = segments[1]
          }
          requestCreateTask(projectIdFromPath)
        } catch (e) { }
        // Do not navigate; dialog opens globally
      },
      keywords: ['new', 'add', 'task', 'todo']
    },
  ]

  const navigationCommands: CommandItem[] = [
    {
      id: 'nav-my-tasks',
      label: 'My Tasks',
      description: 'View your assigned tasks',
      icon: UserCheck,
      action: () => router.push('/my-tasks'),
      keywords: ['tasks', 'my', 'work', 'todo', 'home', 'dashboard', 'main']
    },
    {
      id: 'nav-projects',
      label: 'Projects',
      description: 'View all projects',
      icon: FolderKanban,
      action: () => router.push('/projects'),
      keywords: ['projects', 'all']
    },
    {
      id: 'nav-notifications',
      label: 'Notifications',
      description: 'View notifications',
      icon: Bell,
      action: () => router.push('/notifications'),
      keywords: ['alerts', 'notifications']
    },
  ]

  // Define all admin commands with their requirements
  const allAdminCommands: Array<CommandItem & { requirements?: any }> = [
    {
      id: 'nav-workflow',
      label: 'Workflow Designer',
      description: 'Create and manage workflows',
      icon: Workflow,
      action: () => router.push('/workflow'),
      keywords: ['workflow', 'automation', 'process'],
      requirements: {
        requiredFeatures: ['workflowAutomation'],
        requiredRoles: ['owner', 'admin', 'manager'],
      }
    },
    {
      id: 'nav-organization',
      label: 'Organization',
      description: 'Manage organizational structure',
      icon: Network,
      action: () => router.push('/organization'),
      keywords: ['org', 'structure', 'hierarchy'],
      requirements: {
        requiredRoles: ['owner', 'admin', 'manager'],
      }
    },
    /* 
        {
          id: 'nav-task-library',
          label: 'Task Library',
          description: 'Manage task templates',
          icon: Library,
          action: () => router.push('/task-library'),
          keywords: ['library', 'templates', 'tasks'],
          requirements: {
            requiredFeatures: ['taskManagement'],
            requiredRoles: ['owner', 'admin', 'manager'],
          }
        },
        {
          id: 'nav-task-templates',
          label: 'Task Templates',
          description: 'Configure task templates',
          icon: FileText,
          action: () => router.push('/task-templates'),
          keywords: ['templates', 'tasks'],
          requirements: {
            requiredFeatures: ['taskManagement'],
            requiredRoles: ['owner', 'admin', 'manager'],
          }
        },
        */
    {
      id: 'nav-people',
      label: 'People',
      description: 'Manage team members',
      icon: Users,
      action: () => router.push('/people'),
      keywords: ['users', 'team', 'people', 'employees'],
      requirements: {
        requiredRoles: ['owner', 'admin'],
        requiredPermissions: ['canInviteUsers'],
      }
    },
    {
      id: 'nav-data-management',
      label: 'Data Management',
      description: 'Manage data files and pipeline',
      icon: Database,
      action: () => router.push('/data-management'),
      keywords: ['data', 'files', 'pipeline', 'upload', 'gcp', 'clickhouse'],
      requirements: {
        requiredFeatures: ['fileManagement'],
        requiredRoles: ['owner', 'admin'],
      }
    },
    {
      id: 'nav-settings',
      label: 'Settings',
      description: 'System configuration',
      icon: Settings,
      action: () => router.push('/settings/general'),
      keywords: ['config', 'settings', 'preferences', 'branding'],
      requirements: {
        requiredRoles: ['owner', 'admin'],
        requiredPermissions: ['canEditCompanySettings'],
      }
    },
  ]

  // Filter admin commands based on permissions
  const adminCommands: CommandItem[] = allAdminCommands
    .filter(cmd => {
      if (!cmd.requirements) return true
      return PermissionService.canAccessRoute(
        currentCompany,
        currentCompanyUser,
        cmd.requirements
      )
    })
    .map(({ requirements, ...cmd }) => cmd)

  const allCommands = [...quickActions, ...navigationCommands, ...adminCommands]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 shadow-2xl max-w-2xl">
        <DialogTitle className="sr-only">Command Menu</DialogTitle>
        <DialogDescription className="sr-only">
          Quickly search for projects, tasks, and system actions.
        </DialogDescription>
        <Command
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
          shouldFilter={true}
        >
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              placeholder="Type a command or search..."
              value={search}
              onValueChange={setSearch}
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-0 focus:ring-0"
            />
          </div>
          <Command.List className="max-h-[400px] overflow-y-auto overflow-x-hidden p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            {/* Quick Actions */}
            <Command.Group heading="Quick Actions" className="mb-2">
              {quickActions.map((command) => {
                const Icon = command.icon
                return (
                  <Command.Item
                    key={command.id}
                    value={`${command.label} ${command.description} ${command.keywords?.join(' ')}`}
                    onSelect={() => handleSelect(command.action)}
                    className="flex items-center gap-2 px-2 py-2 cursor-pointer rounded-md hover:bg-accent aria-selected:bg-accent"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="font-medium">{command.label}</div>
                      {command.description && (
                        <div className="text-xs text-muted-foreground">{command.description}</div>
                      )}
                    </div>
                  </Command.Item>
                )
              })}
            </Command.Group>

            {/* Navigation */}
            <Command.Group heading="Navigation" className="mb-2">
              {navigationCommands.map((command) => {
                const Icon = command.icon
                return (
                  <Command.Item
                    key={command.id}
                    value={`${command.label} ${command.description} ${command.keywords?.join(' ')}`}
                    onSelect={() => handleSelect(command.action)}
                    className="flex items-center gap-2 px-2 py-2 cursor-pointer rounded-md hover:bg-accent aria-selected:bg-accent"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="font-medium">{command.label}</div>
                      {command.description && (
                        <div className="text-xs text-muted-foreground">{command.description}</div>
                      )}
                    </div>
                  </Command.Item>
                )
              })}
            </Command.Group>

            {/* Admin Commands */}
            {adminCommands.length > 0 && (
              <Command.Group heading="Admin" className="mb-2">
                {adminCommands.map((command) => {
                  const Icon = command.icon
                  return (
                    <Command.Item
                      key={command.id}
                      value={`${command.label} ${command.description} ${command.keywords?.join(' ')}`}
                      onSelect={() => handleSelect(command.action)}
                      className="flex items-center gap-2 px-2 py-2 cursor-pointer rounded-md hover:bg-accent aria-selected:bg-accent"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="font-medium">{command.label}</div>
                        {command.description && (
                          <div className="text-xs text-muted-foreground">{command.description}</div>
                        )}
                      </div>
                    </Command.Item>
                  )
                })}
              </Command.Group>
            )}

            {/* Recent Projects - TODO: Load from Firestore */}
            {recentProjects.length > 0 && (
              <Command.Group heading="Recent Projects" className="mb-2">
                {recentProjects.map((project) => (
                  <Command.Item
                    key={project.id}
                    value={project.name}
                    onSelect={() => handleSelect(() => router.push(`/projects/${project.id}`))}
                    className="flex items-center gap-2 px-2 py-2 cursor-pointer rounded-md hover:bg-accent aria-selected:bg-accent"
                  >
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="font-medium">{project.name}</div>
                      <div className="text-xs text-muted-foreground">{project.description}</div>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          {/* Footer */}
          <div className="border-t px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                  <span className="text-xs">↑↓</span>
                </kbd>
                <span>navigate</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                  <span className="text-xs">↵</span>
                </kbd>
                <span>select</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                  <span className="text-xs">esc</span>
                </kbd>
                <span>close</span>
              </div>
            </div>
            {currentCompany && (
              <div className="text-xs text-muted-foreground">
                {currentCompany.name}
              </div>
            )}
          </div>
        </Command>
      </DialogContent >
    </Dialog >
  )
}

