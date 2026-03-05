/**
 * Navigation Configuration
 * 
 * Defines all navigation items with their permission requirements.
 * Each item specifies:
 * - requiredFeatures: Company feature flags that must be enabled
 * - requiredRoles: User roles that can access (empty = all roles)
 * - requiredPermissions: Granular permissions required (optional, OR with roles)
 */

import {
  Users,
  Settings,
  Bell,
  Building2,
  Network,
  UserCheck,
  Library,
  TrendingUp,
  Database,
  FolderKanban,
  Shield,
  MessageSquare,
  LayoutDashboard,
  History,
  Star,
  Globe,
  Crown,
  ShieldCheck,
  Palette,
  Sliders,
  Brain,
  type LucideIcon
} from 'lucide-react'
import { CompanyFeatures, CompanyUser } from '@/types/company-schema'

export interface NavigationItem {
  id: string
  name: string
  href: string
  icon: LucideIcon
  category: 'main' | 'projects' | 'analytics' | 'workflow' | 'governance' | 'admin'

  // Permission requirements
  requiredFeatures?: (keyof CompanyFeatures)[]  // ALL must be enabled
  requiredRoles?: string[]                      // User must have ONE of these roles (empty = all roles)
  requiredPermissions?: (keyof CompanyUser['permissions'])[]  // User must have ONE of these permissions

  // Display options
  badge?: string
  order?: number
}

// Main Navigation - available to all users (with feature checks)
export const mainNavigation: NavigationItem[] = [
  {
    id: 'my-tasks',
    name: 'My Tasks',
    href: '/my-tasks',
    icon: UserCheck,
    category: 'main',
    order: 0,
    requiredFeatures: ['taskManagement'],
  },

  {
    id: 'executive-dashboard',
    name: 'Executive Dashboard',
    href: '/executive-dashboard',
    icon: LayoutDashboard,
    category: 'main',
    order: 4,
    requiredRoles: ['admin', 'owner', 'group_admin'],
  },

  {
    id: 'ceo-visibility-agent',
    name: 'CEO Visibility Agent',
    href: '/ceo-agent',
    icon: Brain,
    category: 'main',
    order: 5,
    requiredRoles: ['admin', 'owner', 'group_admin'],
  },

  {
    id: 'website',
    name: 'Website',
    href: '/website',
    icon: Globe,
    category: 'main',
    order: 6,
    requiredFeatures: ['websiteBuilder'],
    requiredRoles: ['owner', 'admin', 'group_admin', 'manager'],
  },
]

// Projects Navigation - requires projectManagement feature
export const projectsNavigation: NavigationItem[] = [
  {
    id: 'workspaces',
    name: 'Workspaces',
    href: '/workspaces',
    icon: FolderKanban,
    category: 'projects',
    order: 1,
    requiredFeatures: ['projectManagement'],
  },
  {
    id: 'projects',
    name: 'Projects',
    href: '/projects',
    icon: Building2,
    category: 'projects',
    order: 2,
    requiredFeatures: ['projectManagement'],
  },
  {
    id: 'projects-create',
    name: 'Create Project',
    href: '/projects/create',
    icon: Building2,
    category: 'projects',
    order: 3,
    requiredFeatures: ['projectManagement'],
    // Anyone can create projects - no role restrictions
  },
  {
    id: 'workspaces-create',
    name: 'Create Workspace',
    href: '/workspaces/create',
    icon: FolderKanban,
    category: 'projects',
    order: 4,
    requiredFeatures: ['projectManagement'],
    requiredRoles: ['owner', 'admin', 'group_admin'], // Only owners, admins, and group admins can create workspaces
  },
]

// Analytics Navigation - requires advancedReporting feature
export const analyticsNavigation: NavigationItem[] = [
  {
    id: 'analytics',
    name: 'Sales Performance',
    href: '/analytics',
    icon: TrendingUp,
    category: 'analytics',
    order: 1,
    requiredFeatures: ['advancedReporting'],
    requiredRoles: ['owner', 'admin', 'group_admin', 'manager'],
    requiredPermissions: ['canViewAnalytics'],
  },
]

// Workflow Navigation - organized by function
export const workflowNavigation: NavigationItem[] = [
  {
    id: 'workflows-all',
    name: 'Process Library',
    href: '/workflows',
    icon: Network,
    category: 'workflow',
    order: 1,
    requiredFeatures: ['workflowAutomation'],
  },
  {
    id: 'workflow-definitions',
    name: 'Process Designer',
    href: '/workflows?mode=designer',
    icon: Network,
    category: 'workflow',
    order: 3,
    requiredFeatures: ['workflowAutomation'],
    requiredRoles: ['owner', 'admin', 'group_admin', 'manager'],
  },
  {
    id: 'workflow-instances',
    name: 'Process Tracking',
    href: '/workflows/instances',
    icon: History,
    category: 'workflow',
    order: 4,
    requiredFeatures: ['workflowAutomation'],
  },
  {
    id: 'workflow-notifications',
    name: 'Workflow Alerts',
    href: '/workflows/notifications',
    icon: Bell,
    category: 'workflow',
    order: 4,
    requiredFeatures: ['workflowAutomation'],
  },
]

// Governance Navigation - approval and escalation rules
export const governanceNavigation: NavigationItem[] = [
  {
    id: 'approval-lines',
    name: 'Approval Rules',
    href: '/governance/approval-lines',
    icon: ShieldCheck,
    category: 'governance',
    order: 1,
    requiredFeatures: ['governance'],
    requiredRoles: ['owner', 'admin', 'group_admin', 'manager'],
  },
  {
    id: 'escalation-paths',
    name: 'Escalation Rules',
    href: '/governance/escalation-paths',
    icon: TrendingUp,
    category: 'governance',
    order: 2,
    requiredFeatures: ['governance'],
    requiredRoles: ['owner', 'admin', 'group_admin', 'manager'],
  },
]

// Admin Navigation - organization and people
export const adminNavigation: NavigationItem[] = [
  {
    id: 'data-management',
    name: 'Data Management',
    href: '/data-management',
    icon: Database,
    category: 'admin',
    order: 5,
    requiredFeatures: ['fileManagement'],
    requiredRoles: ['owner', 'admin', 'group_admin'],
  },
  {
    id: 'import-history',
    name: 'Import History',
    href: '/admin/imports',
    icon: History,
    category: 'admin',
    order: 10,
    requiredRoles: ['owner', 'admin', 'group_admin', 'manager'],
  },
]

// Organization & Access Sub-navigation
export const organizationSubNavigation: NavigationItem[] = [
  {
    id: 'organization',
    name: 'Organization',
    href: '/organization',
    icon: Network,
    category: 'admin',
    order: 1,
    requiredRoles: ['owner', 'admin', 'group_admin', 'manager'],
  },
  {
    id: 'people',
    name: 'People',
    href: '/people',
    icon: Users,
    category: 'admin',
    order: 2,
    requiredRoles: ['owner', 'admin', 'group_admin'],
    requiredPermissions: ['canInviteUsers'],
  },
  {
    id: 'roles',
    name: 'Roles & Permissions',
    href: '/admin/roles',
    icon: Shield,
    category: 'admin',
    order: 3,
    // Only owners, admins, and group admins can manage roles
    requiredRoles: ['owner', 'admin', 'group_admin'],
  },
]

// Workspace config under Admin (Admin → Workspace → Config)
export const workspaceConfigSubNavigation: NavigationItem[] = [
  {
    id: 'workspace-config',
    name: 'Config',
    href: '/admin/workspace/config',
    icon: Sliders,
    category: 'admin',
    order: 1,
    requiredRoles: ['owner', 'admin', 'group_admin'],
  },
]

// Settings Sub-navigation for admin settings
export const settingsSubNavigation: NavigationItem[] = [
  {
    id: 'settings-general',
    name: 'General',
    href: '/settings/general',
    icon: Building2,
    category: 'admin',
    order: 1,
    requiredRoles: ['owner', 'admin', 'group_admin'],
    requiredPermissions: ['canEditCompanySettings'],
  },
  {
    id: 'settings-appearance',
    name: 'Appearance',
    href: '/settings/appearance',
    icon: Palette,
    category: 'admin',
    order: 2,
    requiredRoles: ['owner', 'admin', 'group_admin'],
    requiredPermissions: ['canEditCompanySettings'],
  },
  {
    id: 'settings-notifications',
    name: 'Notifications',
    href: '/settings/notifications',
    icon: Bell,
    category: 'admin',
    order: 3,
    requiredRoles: ['owner', 'admin', 'group_admin'],
  },
  {
    id: 'group-admin',
    name: 'Group Admin',
    href: '/admin/group',
    icon: Crown,
    category: 'admin',
    order: 4,
    requiredRoles: ['group_admin'],
  },
]

// All navigation items
export const allNavigationItems: NavigationItem[] = [
  ...mainNavigation,
  ...projectsNavigation,
  ...analyticsNavigation,
  ...workflowNavigation,
  ...governanceNavigation,
  ...adminNavigation,
  ...settingsSubNavigation,
  ...organizationSubNavigation,
  ...workspaceConfigSubNavigation,
]

// Get navigation items by category
export function getNavigationByCategory(category: NavigationItem['category']): NavigationItem[] {
  return allNavigationItems
    .filter(item => item.category === category)
    .sort((a, b) => (a.order || 0) - (b.order || 0))
}

// Get navigation item by ID
export function getNavigationItem(id: string): NavigationItem | undefined {
  return allNavigationItems.find(item => item.id === id)
}

// Get navigation item by href
export function getNavigationItemByHref(href: string): NavigationItem | undefined {
  return allNavigationItems.find(item => item.href === href)
}

