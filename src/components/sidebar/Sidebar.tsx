/**
 * Sidebar Component
 * 
 * Client component that can work with or without initial data.
 * If initial data is provided, it uses that (from SSR).
 * Otherwise, it falls back to client-side fetching.
 */

'use client'

import { SidebarClient } from './SidebarClient'
import type { EnhancedProject } from '@/types/project-schema'
import type { Workspace } from '@/types/workspace-schema'
import type { NavigationItem } from '@/config/navigation'

interface SidebarProps {
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

// Memoize Sidebar to prevent re-renders when parent re-renders
import { memo } from 'react'

function SidebarComponent({
  className,
  initialProjects,
  initialWorkspaces,
  initialFilteredMainNav,
  initialFilteredInsightsNav,
  initialFilteredWorkflowNav,
  initialFilteredAdminNav,
  initialFilteredSettingsNav,
  initialFilteredOrganizationNav,
}: SidebarProps) {
  return (
    <SidebarClient
      className={className}
      initialProjects={initialProjects}
      initialWorkspaces={initialWorkspaces}
      initialFilteredMainNav={initialFilteredMainNav}
      initialFilteredInsightsNav={initialFilteredInsightsNav}
      initialFilteredWorkflowNav={initialFilteredWorkflowNav}
      initialFilteredAdminNav={initialFilteredAdminNav}
      initialFilteredSettingsNav={initialFilteredSettingsNav}
      initialFilteredOrganizationNav={initialFilteredOrganizationNav}
    />
  )
}

// Memoize with custom comparison - only re-render if props actually change
export const Sidebar = memo(SidebarComponent, (prevProps, nextProps) => {
  // Only re-render if props actually change
  return (
    prevProps.className === nextProps.className &&
    prevProps.initialProjects === nextProps.initialProjects &&
    prevProps.initialWorkspaces === nextProps.initialWorkspaces &&
    prevProps.initialFilteredMainNav === nextProps.initialFilteredMainNav &&
    prevProps.initialFilteredInsightsNav === nextProps.initialFilteredInsightsNav &&
    prevProps.initialFilteredWorkflowNav === nextProps.initialFilteredWorkflowNav &&
    prevProps.initialFilteredAdminNav === nextProps.initialFilteredAdminNav &&
    prevProps.initialFilteredSettingsNav === nextProps.initialFilteredSettingsNav &&
    prevProps.initialFilteredOrganizationNav === nextProps.initialFilteredOrganizationNav
  )
})
