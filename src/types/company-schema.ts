// Company Schema for Multi-Tenant Project Management System

export interface Company {
  id: string
  name: string
  domain: string
  description?: string

  // Company Settings
  settings: CompanySettings

  // Subscription & Billing
  subscription: CompanySubscription

  // Company Branding
  branding?: CompanyBranding

  // PMS Configuration
  pmsConfig?: PMSConfig

  // Status & Metadata
  status: 'active' | 'suspended' | 'trial' | 'inactive'
  plan: 'free' | 'basic' | 'professional' | 'enterprise'

  // Timestamps
  createdAt: string
  updatedAt: string
  trialEndsAt?: string

  // Admin Information
  createdBy: string // User ID
  adminUsers: string[] // User IDs

  // Company Limits
  limits: CompanyLimits

  // Features
  features: CompanyFeatures
}

export interface CompanySettings {
  // General Settings
  timezone: string
  dateFormat: string
  currency: string
  language: string

  // Project Settings
  defaultProjectStatus: 'planning' | 'active' | 'on-hold' | 'completed' | 'cancelled'
  defaultProjectPriority: 'low' | 'medium' | 'high' | 'urgent'
  autoAssignProjects: boolean

  // User Settings
  allowSelfRegistration: boolean
  requireEmailVerification: boolean
  defaultUserRole: 'admin' | 'manager' | 'employee'

  // Notification Settings
  emailNotifications: boolean
  slackIntegration: boolean
  webhookUrl?: string

  // Security Settings
  passwordPolicy: {
    minLength: number
    requireUppercase: boolean
    requireNumbers: boolean
    requireSpecialChars: boolean
  }

  // Data Retention
  dataRetentionDays: number
  autoArchiveCompletedProjects: boolean
  archiveAfterDays: number
}

export interface CompanySubscription {
  plan: 'free' | 'basic' | 'professional' | 'enterprise'
  status: 'active' | 'trial' | 'expired' | 'cancelled'
  billingCycle: 'monthly' | 'yearly'

  // Limits
  maxUsers: number
  maxProjects: number
  maxStorageGB: number

  // Billing
  pricePerMonth: number
  pricePerYear: number
  nextBillingDate?: string
  lastPaymentDate?: string

  // Trial
  trialDays: number
  trialUsed: boolean
}

export interface CompanyBranding {
  logo?: string
  primaryColor: string
  secondaryColor: string
  favicon?: string

  // Custom CSS
  customCSS?: string

  // Email Templates
  emailSignature?: string
  emailTemplate?: string
}

export interface CompanyLimits {
  maxUsers: number
  maxProjects: number
  maxTasksPerProject: number
  maxFileSizeMB: number
  maxStorageGB: number
  maxApiCallsPerMonth: number

  // Current Usage
  currentUsers: number
  currentProjects: number
  currentStorageGB: number
  currentApiCalls: number
}

export interface CompanyFeatures {
  // Core Features
  projectManagement: boolean
  taskManagement: boolean
  timeTracking: boolean
  fileManagement: boolean

  // Advanced Features
  advancedReporting: boolean
  customFields: boolean
  workflowAutomation: boolean
  governance: boolean            // Governance: approval lines & escalation paths
  directApprovals: boolean       // Direct task-level approvals
  escalationPaths: boolean       // Escalation path tracking
  approvalInbox: boolean         // Unified approval inbox
  websiteBuilder: boolean        // WaaS website builder feature
  apiAccess: boolean

  // Integrations
  slackIntegration: boolean
  googleWorkspace: boolean
  microsoft365: boolean
  webhookSupport: boolean

  // Security Features
  sso: boolean
  twoFactorAuth: boolean
  auditLogs: boolean
  dataEncryption: boolean
}

// Company User Role (different from global user role)
export interface CompanyUser {
  id: string
  userId: string // Reference to global user
  companyId: string
  role: 'owner' | 'admin' | 'manager' | 'employee' | 'viewer' | 'group_admin'
  permissions: CompanyPermissions

  // Profile (present on enterprise group user docs)
  name?: string
  displayName?: string
  email?: string

  // Invitation
  invitedBy: string
  invitedAt: string
  acceptedAt?: string

  // Status
  status: 'pending' | 'active' | 'suspended' | 'removed'

  // Timestamps
  joinedAt: string
  lastActiveAt: string
  createdAt: string
  updatedAt: string
}

export interface CompanyPermissions {
  // Project Permissions
  canCreateProjects: boolean
  canEditProjects: boolean
  canDeleteProjects: boolean
  canViewAllProjects: boolean

  // User Permissions
  canInviteUsers: boolean
  canRemoveUsers: boolean
  canEditUserRoles: boolean

  // Settings Permissions
  canEditCompanySettings: boolean
  canEditBilling: boolean
  canViewAnalytics: boolean

  // Admin Permissions
  isOwner: boolean
  isAdmin: boolean
}

// Company Invitation
export interface CompanyInvitation {
  id: string
  companyId: string
  email: string
  role: 'admin' | 'manager' | 'employee' | 'viewer'
  invitedBy: string
  invitedAt: string
  expiresAt: string

  // Status
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'

  // Response
  acceptedAt?: string
  acceptedBy?: string
  token: string
}

// Company Activity Log
export interface CompanyActivity {
  id: string
  companyId: string
  userId: string
  action: string
  resourceType: 'project' | 'user' | 'task' | 'company' | 'settings'
  resourceId?: string
  description: string
  metadata?: Record<string, any>

  // Timestamps
  timestamp: string
  ipAddress?: string
  userAgent?: string
}

// Company Statistics
export interface CompanyStats {
  companyId: string
  period: 'day' | 'week' | 'month' | 'year'
  date: string

  // User Stats
  totalUsers: number
  activeUsers: number
  newUsers: number

  // Project Stats
  totalProjects: number
  activeProjects: number
  completedProjects: number
  newProjects: number

  // Task Stats
  totalTasks: number
  completedTasks: number
  overdueTasks: number

  // Usage Stats
  storageUsedGB: number
  apiCallsUsed: number

  // Performance Stats
  averageProjectDuration: number
  teamUtilization: number
  qualityScore: number
}

// PMS Configuration
export interface PMSConfig {
  industry: string
  description: string
  features: string[]
  equipmentTypes?: string[]
  manufacturingPhases?: string[]
  qualityStandards?: string[]
  complianceRequirements?: string[]
}

