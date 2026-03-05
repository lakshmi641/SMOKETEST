'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { EnhancedProject } from '@/types/project-schema'
import type { Workspace } from '@/types/workspace-schema'
import { logger } from '@/lib/logger'

interface SidebarState {
  // UI: collapsed state so layout can adjust main content margin
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void

  // Projects - persisted across route changes
  projects: EnhancedProject[]
  projectsLoaded: boolean
  projectsLoading: boolean
  projectsCompanyId: string | null
  
  // Workspaces - persisted across route changes
  workspaces: Workspace[]
  workspacesLoaded: boolean
  workspacesCompanyId: string | null
  
  // Actions
  setProjects: (projects: EnhancedProject[], companyId: string) => void
  addProject: (project: EnhancedProject, companyId: string) => void
  removeProject: (projectId: string) => void
  setProjectsLoading: (loading: boolean) => void
  clearProjects: () => void
  
  setWorkspaces: (workspaces: Workspace[], companyId: string) => void
  clearWorkspaces: () => void
  
  // Check if projects are loaded for a company
  areProjectsLoaded: (companyId: string) => boolean
  areWorkspacesLoaded: (companyId: string) => boolean
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set, get) => ({
      // Initial state
      collapsed: false,
      setCollapsed: (collapsed) => set({ collapsed }),

      projects: [],
      projectsLoaded: false,
      projectsLoading: false,
      projectsCompanyId: null,

      workspaces: [],
      workspacesLoaded: false,
      workspacesCompanyId: null,

      // Actions
      setProjects: (projects, companyId) => {
        // Filter out deleted projects before storing
        const activeProjects = projects.filter(p => !p.isDeleted)
        logger.debug('[SidebarStore] setProjects called with:', projects.length, 'projects (', activeProjects.length, 'active), companyId:', companyId)
        const newState = {
          projects: [...activeProjects], // Create a copy and filter deleted
          projectsLoaded: true,
          projectsLoading: false,
          projectsCompanyId: companyId,
        }
        set(newState)
      },
      
      addProject: (project, companyId) => {
        const state = get()
        // Only add if it's for the same company and project doesn't already exist
        if (state.projectsCompanyId === companyId && !state.projects.find(p => p.id === project.id)) {
          logger.debug('[SidebarStore] Adding new project:', project.id, project.name)
          set({
            projects: [...state.projects, project],
          })
        }
      },
      
      removeProject: (projectId) => {
        const state = get()
        const filteredProjects = state.projects.filter(p => p.id !== projectId)
        if (filteredProjects.length !== state.projects.length) {
          logger.debug('[SidebarStore] Removing project:', projectId)
          set({
            projects: filteredProjects,
          })
        }
      },
      
      setProjectsLoading: (loading) => {
        set({ projectsLoading: loading })
      },
      
      clearProjects: () => {
        set({
          projects: [],
          projectsLoaded: false,
          projectsLoading: false,
          projectsCompanyId: null,
        })
      },
      
      setWorkspaces: (workspaces, companyId) => {
        set({
          workspaces: [...workspaces], // Create a copy
          workspacesLoaded: true,
          workspacesCompanyId: companyId,
        })
      },
      
      clearWorkspaces: () => {
        set({
          workspaces: [],
          workspacesLoaded: false,
          workspacesCompanyId: null,
        })
      },
      
      // Helpers
      areProjectsLoaded: (companyId) => {
        const state = get()
        return state.projectsLoaded && state.projectsCompanyId === companyId
      },
      
      areWorkspacesLoaded: (companyId) => {
        const state = get()
        return state.workspacesLoaded && state.workspacesCompanyId === companyId
      },
    }),
    {
      name: 'sidebar-storage',
      // Only persist projects and workspaces, not loading states
      // This ensures loading state is always false on page load
      partialize: (state) => ({
        collapsed: state.collapsed,
        projects: state.projects,
        projectsCompanyId: state.projectsCompanyId,
        projectsLoaded: state.projectsLoaded,
        workspaces: state.workspaces,
        workspacesCompanyId: state.workspacesCompanyId,
        workspacesLoaded: state.workspacesLoaded,
      }),
      // Don't persist loading state - always start fresh
      skipHydration: false,
    }
  )
)

