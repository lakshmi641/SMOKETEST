'use client'

import { create } from 'zustand'

interface CreateTaskDefaults {
  isMilestone?: boolean
}

interface UIState {
  createTaskRequested: boolean
  createTaskProjectId?: string | null
  createTaskDefaults?: CreateTaskDefaults | null
  requestCreateTask: (projectId?: string, defaults?: CreateTaskDefaults) => void
  clearCreateTaskRequest: () => void

  // Gantt State
  ganttZoomLevel: 'day' | 'week' | 'month'
  ganttViewMode: 'standard' | 'critical_path'
  setGanttZoomLevel: (level: 'day' | 'week' | 'month') => void
  setGanttViewMode: (mode: 'standard' | 'critical_path') => void
  // Dashboard Theme
  dashboardTheme: 'modern' | 'compact' | 'clean' | 'contrast'
  setDashboardTheme: (theme: 'modern' | 'compact' | 'clean' | 'contrast') => void
}

export const useUIStore = create<UIState>((set) => ({
  createTaskRequested: false,
  createTaskProjectId: null,
  createTaskDefaults: null,
  requestCreateTask: (projectId, defaults) => set({
    createTaskRequested: true,
    createTaskProjectId: projectId || null,
    createTaskDefaults: defaults || null
  }),
  clearCreateTaskRequest: () => set({
    createTaskRequested: false,
    createTaskProjectId: null,
    createTaskDefaults: null
  }),

  ganttZoomLevel: 'week',
  ganttViewMode: 'standard',
  setGanttZoomLevel: (level) => set({ ganttZoomLevel: level }),
  setGanttViewMode: (mode) => set({ ganttViewMode: mode }),

  dashboardTheme: 'modern',
  setDashboardTheme: (theme) => set({ dashboardTheme: theme }),
}))


