'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { WorkspaceService } from '@/lib/services'
import { useCompany } from './CompanyContext'
import { useAuthStore } from '@/store/authStore'
import type { Workspace } from '@/types/workspace-schema'
import type { GeneratedTask } from '@/types/task-template-schema'
import toast from 'react-hot-toast'
import { collection, getDocs } from 'firebase/firestore'
import { getFirestoreInstance } from '@/lib/firebase'
import { useWorkspacesQuery } from '@/hooks/queries/useWorkspaceQueries'
import { useProjectsQuery } from '@/hooks/queries/useProjectQueries'
import { useQueryClient } from '@tanstack/react-query'

interface WorkspaceWithMetrics extends Workspace {
  totalProjects?: number
  activeProjects?: number
  totalTasks?: number
  completedTasks?: number
}

interface WorkspaceContextType {
  selectedWorkspace: WorkspaceWithMetrics | null
  workspaces: WorkspaceWithMetrics[]
  loading: boolean
  setSelectedWorkspace: (workspace: WorkspaceWithMetrics | null) => void
  selectWorkspaceById: (workspaceId: string) => Promise<void>
  refreshWorkspaces: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined)

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { groupId, companyId, currentCompanyUser } = useCompany()
  const { user: authUser, loading: authLoading } = useAuthStore()
  const pathname = usePathname()
  const [selectedWorkspace, setSelectedWorkspaceState] = useState<WorkspaceWithMetrics | null>(null)

  const canFetchWorkspaceData = !authLoading && !!authUser && !!companyId
  const { data: workspaces = [], isLoading: workspacesLoading } = useWorkspacesQuery(
    canFetchWorkspaceData && groupId ? groupId : undefined,
    canFetchWorkspaceData ? companyId : undefined
  )
  const { data: projectsData = [] } = useProjectsQuery(
    canFetchWorkspaceData ? (companyId ?? undefined) : undefined,
    canFetchWorkspaceData ? (groupId ?? undefined) : undefined,
    canFetchWorkspaceData ? (authUser?.id ?? undefined) : undefined,
    currentCompanyUser?.role === 'owner' || currentCompanyUser?.role === 'admin'
  )
  const queryClient = useQueryClient()

  const refreshWorkspaces = useCallback(async () => {
    queryClient.invalidateQueries({ queryKey: ['workspaces', groupId, companyId] })
  }, [queryClient, groupId, companyId])

  // Simplified loading state
  const loading = authLoading || workspacesLoading

  // Restore selected workspace from localStorage or workspaces list
  useEffect(() => {
    if (loading || !companyId) return

    const savedWorkspaceId = localStorage.getItem(`selectedWorkspace_${companyId}`)
    if (savedWorkspaceId) {
      const workspace = workspaces.find((w: Workspace) => w.id === savedWorkspaceId)
      if (workspace) {
        setSelectedWorkspaceState(workspace)
      } else {
        setSelectedWorkspaceState(null)
      }
    } else if (workspaces.length === 1 && workspaces[0]) {
      setSelectedWorkspaceState(workspaces[0])
      localStorage.setItem(`selectedWorkspace_${companyId}`, workspaces[0].id)
    }
  }, [workspaces, companyId, loading])

  // Set selected workspace and save to localStorage
  const setSelectedWorkspace = useCallback((workspace: WorkspaceWithMetrics | null) => {
    setSelectedWorkspaceState(workspace)
    if (workspace && companyId) {
      localStorage.setItem(`selectedWorkspace_${companyId}`, workspace.id)
    } else if (companyId) {
      localStorage.removeItem(`selectedWorkspace_${companyId}`)
    }
  }, [companyId])

  // Select workspace by ID
  const selectWorkspaceById = useCallback(async (workspaceId: string) => {
    if (authLoading || !authUser || !groupId || !companyId) return

    try {
      const existing = workspaces.find((w: Workspace) => w.id === workspaceId)
      if (existing) {
        setSelectedWorkspace(existing)
        return
      }

      const db = getFirestoreInstance()
      const { companyCollectionPathSegments } = await import('@/lib/firestore-paths')
      const [workspace, tasksSnapshot] = await Promise.all([
        WorkspaceService.getWorkspace(groupId, companyId, workspaceId),
        getDocs(collection(db, ...companyCollectionPathSegments(groupId, companyId, 'tasks'))).catch(() => ({ docs: [] }))
      ])

      if (workspace) {
        const allTasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as GeneratedTask[]
        const workspaceProjects = projectsData.filter((p: any) => p.workspaceId === workspace.id)
        const activeProjects = workspaceProjects.filter((p: any) => p.status === 'active')
        const workspaceTasks = allTasks.filter(t =>
          workspaceProjects.some(p => p.id === t.projectId)
        )
        const completedTasks = workspaceTasks.filter(t => t.status === 'completed').length

        const workspaceWithCounts: WorkspaceWithMetrics = {
          ...workspace,
          totalProjects: workspaceProjects.length,
          activeProjects: activeProjects.length,
          totalTasks: workspaceTasks.length,
          completedTasks: completedTasks,
        }

        setSelectedWorkspace(workspaceWithCounts)
      } else {
        toast.error('Workspace not found')
        setSelectedWorkspace(null)
      }
    } catch (error) {
      console.error('Error loading workspace:', error)
      toast.error('Failed to load workspace')
      setSelectedWorkspace(null)
    }
  }, [groupId, companyId, setSelectedWorkspace, authLoading, authUser, workspaces, projectsData])

  // Load workspaces after login and when company changes
  useEffect(() => {
    // Only load workspaces if user is authenticated and company is available
    if (!authLoading && authUser && companyId) {
      refreshWorkspaces()
    }
  }, [refreshWorkspaces, authLoading, authUser, companyId])

  // Extract workspace from URL if in workspace route
  useEffect(() => {
    if (pathname?.startsWith('/workspaces/')) {
      const match = pathname.match(/\/workspaces\/([^/]+)/)
      if (match && match[1] && match[1] !== 'create') {
        const workspaceId = match[1]
        if (selectedWorkspace?.id !== workspaceId) {
          selectWorkspaceById(workspaceId)
        }
      }
    }
  }, [pathname, selectWorkspaceById, selectedWorkspace])

  // Listen for project events to update counts
  useEffect(() => {
    const handleProjectChange = () => {
      console.log('Refreshing workspaces due to project change...')
      refreshWorkspaces()
    }

    const handleWorkspaceChange = () => {
      refreshWorkspaces()
    }

    window.addEventListener('project-created', handleProjectChange)
    window.addEventListener('project-deleted', handleProjectChange)
    window.addEventListener('workspace-created', handleWorkspaceChange)
    window.addEventListener('workspace-deleted', handleWorkspaceChange)

    return () => {
      window.removeEventListener('project-created', handleProjectChange)
      window.removeEventListener('project-deleted', handleProjectChange)
      window.removeEventListener('workspace-created', handleWorkspaceChange)
      window.removeEventListener('workspace-deleted', handleWorkspaceChange)
    }
  }, [refreshWorkspaces])

  return (
    <WorkspaceContext.Provider
      value={{
        selectedWorkspace,
        workspaces,
        loading,
        setSelectedWorkspace,
        selectWorkspaceById,
        refreshWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider')
  }
  return context
}

