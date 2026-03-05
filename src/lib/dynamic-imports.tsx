'use client'

import dynamic from 'next/dynamic'

// Loading component for dynamic imports
const DefaultLoading = () => (
  <div className="space-y-4 p-4">
    <div className="h-8 w-3/4 bg-gray-200 rounded animate-pulse" />
    <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse" />
    <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse" />
    <div className="h-32 w-full bg-gray-200 rounded animate-pulse" />
  </div>
)

// Pre-configured dynamic components for common use cases
export const DynamicProjectTable = dynamic(
  () => import('@/components/features/projects').then(mod => ({ default: mod.ProjectTable })),
  { 
    loading: DefaultLoading,
    ssr: false 
  }
)

export const DynamicVirtualizedProjectTable = dynamic(
  () => import('@/components/features/projects').then(mod => ({ default: mod.VirtualizedProjectTable })),
  { 
    loading: DefaultLoading,
    ssr: false 
  }
)

export const DynamicProjectCreationWizard = dynamic(
  () => import('@/components/features/projects').then(mod => ({ default: mod.ProjectCreationWizard })),
  { 
    loading: DefaultLoading,
    ssr: false 
  }
)

export const DynamicProjectCreationForm = dynamic(
  () => import('@/components/features/projects').then(mod => ({ default: mod.ProjectCreationForm })),
  { 
    loading: DefaultLoading,
    ssr: false 
  }
)

export const DynamicOrgChartVisualization = dynamic(
  () => import('@/components/features/org').then(mod => ({ default: mod.OrgChartVisualization })),
  { 
    loading: DefaultLoading,
    ssr: false 
  }
)

export const DynamicTaskTemplateManagement = dynamic(
  () => import('@/components/templates/TaskTemplateManagement').then(mod => ({ default: mod.TaskTemplateManagement })),
  { 
    loading: DefaultLoading,
    ssr: false 
  }
)

export const DynamicPositionTaskAssignmentManagement = dynamic(
  () => import('@/components/features/org').then(mod => ({ default: mod.PositionTaskAssignmentManagement })),
  { 
    loading: DefaultLoading,
    ssr: false 
  }
)

// Heavy components that should be loaded on demand
export const DynamicMyTasksDashboard = dynamic(
  () => import('@/components/features/dashboard').then(mod => ({ default: mod.MyTasksDashboard })),
  { 
    loading: DefaultLoading,
    ssr: false 
  }
)

export const DynamicOrgUnitManagement = dynamic(
  () => import('@/components/features/org').then(mod => ({ default: mod.OrgUnitManagement })),
  { 
    loading: DefaultLoading,
    ssr: false 
  }
)

export const DynamicPositionManagement = dynamic(
  () => import('@/components/features/org').then(mod => ({ default: mod.PositionManagement })),
  { 
    loading: DefaultLoading,
    ssr: false 
  }
)

export const DynamicAssignmentManagement = dynamic(
  () => import('@/components/features/org').then(mod => ({ default: mod.AssignmentManagement })),
  { 
    loading: DefaultLoading,
    ssr: false 
  }
)

export const DynamicDelegationManagement = dynamic(
  () => import('@/components/features/org').then(mod => ({ default: mod.DelegationManagement })),
  { 
    loading: DefaultLoading,
    ssr: false 
  }
)