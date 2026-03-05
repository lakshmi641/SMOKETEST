'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useCompany } from '@/contexts/CompanyContext'
import { useCompanyConfig } from '@/hooks/useCompanyConfig'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { useAuthStore } from '@/store/authStore'
import { useSidebarStore } from '@/store/sidebarStore'
import { useStarredItems } from '@/hooks/useStarredItems'
import { useApprovalCount } from '@/hooks/useApprovalCount'
import { useActiveInstanceCount } from '@/hooks/useActiveInstanceCount'
import { useProjectsQuery } from '@/hooks/queries/useProjectQueries'
import { useWorkspacesQuery } from '@/hooks/queries/useWorkspaceQueries'
import { PermissionService } from '@/lib/services/permission-service'
import type { NavigationItem } from '@/config/navigation'
import type { Workspace } from '@/types/workspace-schema'
import type { EnhancedProject } from '@/types/project-schema'

export function useSidebarLogic(initialData: {
    initialProjects?: EnhancedProject[]
    initialWorkspaces?: Workspace[]
    initialFilteredMainNav?: NavigationItem[]
    initialFilteredInsightsNav?: NavigationItem[]
    initialFilteredWorkflowNav?: NavigationItem[]
    initialFilteredAdminNav?: NavigationItem[]
    initialFilteredSettingsNav?: NavigationItem[]
    initialFilteredOrganizationNav?: NavigationItem[]
}) {
    const {
        collapsed: isCollapsed,
        setCollapsed: setIsCollapsed,
        setProjects
    } = useSidebarStore()
    const pathname = usePathname()
    const router = useRouter()
    const { companyId, groupId, currentCompany, currentCompanyUser } = useCompany()
    const companyConfig = useCompanyConfig()
    const { selectedWorkspace } = useWorkspace()
    const { user: currentUser } = useAuthStore()
    const { count: approvalCount } = useApprovalCount()
    const { count: activeInstanceCount } = useActiveInstanceCount()
    const { starredItems } = useStarredItems()
    const queryClient = useQueryClient()

    const currentPathname = useMemo(() => pathname, [pathname])

    // Fetch projects (pass groupId for multi-org so we read from enterprise path)
    const { data: projects = [], isLoading: projectsLoading } = useProjectsQuery(
        companyId || '',
        groupId ?? undefined,
        currentUser?.id,
        currentCompanyUser?.role === 'owner' || currentCompanyUser?.role === 'admin',
        initialData.initialProjects
    )

    // Sync projects to global store for other pages (like Favorites) to use
    useEffect(() => {
        if (projects.length > 0 && companyId) {
            setProjects(projects, companyId)
        }
    }, [projects, companyId, setProjects])

    // Fetch workspaces
    const { data: workspacesRaw = [], isLoading: workspacesLoading } = useWorkspacesQuery(
        groupId ?? companyId ?? '',
        companyId || '',
        initialData.initialWorkspaces
    )

    const activeProjects = useMemo(() => projects.filter(p => !p.isDeleted), [projects])

    // Group projects by workspace for Jira-style sidebar (workspaces with nested projects)
    const projectsByWorkspace = useMemo(() => {
        const map: Record<string, typeof activeProjects> = {}
        for (const p of activeProjects) {
            const wid = p.workspaceId ?? ''
            if (!map[wid]) map[wid] = []
            map[wid].push(p)
        }
        return map
    }, [activeProjects])

    // Handle events
    useEffect(() => {
        const handleProjectEvent = () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] })
            queryClient.invalidateQueries({ queryKey: ['workspaces'] })
        }
        const handleWorkspaceEvent = () => {
            queryClient.invalidateQueries({ queryKey: ['workspaces', companyId] })
        }

        window.addEventListener('project-created', handleProjectEvent)
        window.addEventListener('project-deleted', handleProjectEvent)
        window.addEventListener('workspace-created', handleWorkspaceEvent)
        window.addEventListener('workspace-deleted', handleWorkspaceEvent)

        return () => {
            window.removeEventListener('project-created', handleProjectEvent)
            window.removeEventListener('project-deleted', handleProjectEvent)
            window.removeEventListener('workspace-created', handleWorkspaceEvent)
            window.removeEventListener('workspace-deleted', handleWorkspaceEvent)
        }
    }, [queryClient, companyId])

    const workspaces = useMemo(() => {
        if (!currentCompanyUser || !currentUser?.id) return workspacesRaw
        const userId = currentUser.id
        const isAdmin = currentCompanyUser.role === 'owner' || currentCompanyUser.role === 'admin'

        return workspacesRaw.map((workspace: Workspace) => {
            const oldAdminIds = (workspace as any).adminIds || [];
            const ownerId = workspace.ownerId || (Array.isArray(oldAdminIds) && oldAdminIds.length > 0 ? oldAdminIds[0] : null);
            const oldSpocIds = (workspace as any).spocIds || [];
            const members = workspace.members || oldSpocIds;
            const isCreator = workspace.createdBy === userId
            const isOwner = ownerId === userId;
            const isMember = Array.isArray(members) && members.includes(userId);

            return {
                ...workspace,
                isMember: isAdmin || isCreator || isOwner || isMember
            };
        }).filter((workspace: any) => {
            const visibility = workspace.visibility || 'standard';
            const hasVisibleProject = activeProjects.some(p => p.workspaceId === workspace.id);

            if (visibility === 'private' || visibility === 'secret') {
                return workspace.isMember || hasVisibleProject;
            }
            // Standard workspaces are visible to everyone
            return true;
        })
    }, [workspacesRaw, currentCompanyUser, currentUser?.id, activeProjects])

    // Collapsible sections state
    const usePersistedState = (key: string, defaultValue: boolean) => {
        const [state, setState] = useState(() => {
            if (typeof window !== 'undefined') {
                const saved = localStorage.getItem(key)
                return saved !== null ? saved === 'true' : defaultValue
            }
            return defaultValue
        })

        useEffect(() => {
            if (typeof window !== 'undefined') {
                localStorage.setItem(key, String(state))
            }
        }, [key, state])

        return [state, setState] as const
    }

    const [projectsExpanded, setProjectsExpanded] = usePersistedState('sidebar_projects_expanded', true)
    const [workspacesExpanded, setWorkspacesExpanded] = usePersistedState('sidebar_workspaces_expanded', true)

    const WORKSPACE_EXPANDED_KEY = 'sidebar_workspace_expanded_map'
    const [workspaceExpandedMap, setWorkspaceExpandedMapState] = useState<Record<string, boolean>>(() => {
        if (typeof window === 'undefined') return {}
        try {
            const raw = localStorage.getItem(WORKSPACE_EXPANDED_KEY)
            return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
        } catch {
            return {}
        }
    })
    const setWorkspaceExpanded = useCallback((workspaceId: string, expanded: boolean) => {
        setWorkspaceExpandedMapState(prev => {
            const next = { ...prev, [workspaceId]: expanded }
            if (typeof window !== 'undefined') localStorage.setItem(WORKSPACE_EXPANDED_KEY, JSON.stringify(next))
            return next
        })
    }, [])
    const isWorkspaceExpanded = useCallback((workspaceId: string) => workspaceExpandedMap[workspaceId] ?? true, [workspaceExpandedMap])
    const [insightsExpanded, setInsightsExpanded] = usePersistedState('sidebar_insights_expanded', true)
    const [workflowsExpanded, setWorkflowsExpanded] = usePersistedState('sidebar_workflows_expanded', true)
    const [governanceExpanded, setGovernanceExpanded] = usePersistedState('sidebar_governance_expanded', true)
    const [workflowSettingsExpanded, setWorkflowSettingsExpanded] = usePersistedState('sidebar_workflow_settings_expanded', false)
    const [settingsExpanded, setSettingsExpanded] = usePersistedState('sidebar_settings_expanded', false)
    const [adminExpanded, setAdminExpanded] = usePersistedState('sidebar_admin_expanded', false)
    const [organizationExpanded, setOrganizationExpanded] = usePersistedState('sidebar_organization_expanded', true)
    const [workspaceConfigExpanded, setWorkspaceConfigExpanded] = usePersistedState('sidebar_workspace_config_expanded', true)

    // Navigation
    const navigation = useMemo(() => require('@/config/navigation'), [])

    const filterNav = useCallback((items: NavigationItem[]) => {
        return items
            .filter(item => PermissionService.canAccessRoute(currentCompany, currentCompanyUser, {
                requiredFeatures: item.requiredFeatures,
                requiredRoles: item.requiredRoles,
                requiredPermissions: item.requiredPermissions,
            }))
            .sort((a, b) => (a.order || 0) - (b.order || 0))
    }, [currentCompany, currentCompanyUser])

    const filteredNav = useMemo(() => ({
        main: filterNav(initialData.initialFilteredMainNav ?? navigation.mainNavigation),
        insights: filterNav(initialData.initialFilteredInsightsNav ?? navigation.analyticsNavigation),
        workflows: filterNav(initialData.initialFilteredWorkflowNav ?? navigation.workflowNavigation),
        governance: filterNav(navigation.governanceNavigation),
        admin: filterNav(initialData.initialFilteredAdminNav ?? navigation.adminNavigation),
        settings: filterNav(initialData.initialFilteredSettingsNav ?? navigation.settingsSubNavigation),
        organization: filterNav(initialData.initialFilteredOrganizationNav ?? navigation.organizationSubNavigation),
        workspaceConfig: filterNav(navigation.workspaceConfigSubNavigation),
    }), [filterNav, initialData, navigation])

    // Starred items
    const starredProjects = useMemo(() => {
        const projectIds = Array.from(starredItems.projects || [])
        return activeProjects.filter(p => projectIds.includes(p.id))
    }, [activeProjects, starredItems.projects])

    const starredWorkspaces = useMemo(() => {
        const workspaceIds = Array.from(starredItems.workspaces || [])
        return workspaces.filter((w: Workspace) => workspaceIds.includes(w.id))
    }, [workspaces, starredItems.workspaces])

    const getProjectColor = useCallback((project: EnhancedProject): string => {
        const colors = ['#2563eb', '#16a34a', '#ea580c', '#7c3aed', '#dc2626', '#0891b2', '#ca8a04', '#db2777']
        const hash = project.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
        return colors[hash % colors.length] ?? colors[0]!
    }, [])

    return {
        isCollapsed, setIsCollapsed,
        pathname, router,
        companyConfig,
        activeProjects, projectsLoading,
        workspaces, workspacesLoading,
        projectsByWorkspace,
        selectedWorkspace,
        starredProjects, starredWorkspaces,
        filteredNav,
        approvalCount, activeInstanceCount,
        projectsExpanded, setProjectsExpanded,
        workspacesExpanded, setWorkspacesExpanded,
        workspaceExpandedMap,
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
    }
}
