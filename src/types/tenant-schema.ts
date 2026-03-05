export interface TenantBranding {
  logo?: string
  favicon?: string
  primaryColor?: string
  secondaryColor?: string
  accentColor?: string
  theme?: 'blue' | 'green' | 'orange' | 'red' | 'rose' | 'violet' | 'yellow' | 'default'
}

/** Maintenance mode controlled from Platform for system down / migration / breach */
export type MaintenanceReason = 'system_down' | 'migration' | 'system_breach'

export interface MaintenanceMode {
  enabled: boolean
  reason: MaintenanceReason
  message?: string
  estimatedEnd?: string
  updatedAt?: string
}

export interface TenantProfile {
  id: string
  companyId: string
  /** Multi-org: same as id when tenantId === enterpriseGroupId */
  enterpriseGroupId?: string
  name: string
  domain?: string
  subdomain?: string
  status: 'active' | 'inactive' | 'pending'
  plan?: 'free' | 'basic' | 'professional' | 'enterprise'
  branding?: TenantBranding
  tagline?: string
  features?: string[]
  /** When set from Platform, PMS shows maintenance page instead of app */
  maintenanceMode?: MaintenanceMode
  createdAt: string
  updatedAt: string
}

export interface TenantNotificationConfig {
  companyId: string
  environment?: 'sandbox' | 'production'
  isActive: boolean
  publicBaseUrl?: string
  sendgrid?: {
    apiKey?: string
    fromEmail?: string
    fromName?: string
  }
  twilio?: {
    accountSid?: string
    authToken?: string
    fromNumber?: string
    whatsappContentSid?: string
    /**
     * Specialized mappings for the 5 core events
     */
    whatsappMappings?: Partial<Record<
      'task_assigned' |
      'workspace_task_request' |
      'approval_required' |
      'task_escalated' |
      'workflow_completed' |
      'comment_mention' |
      'task_reassigned',
      string
    >>
  }
  createdAt?: string | any
  updatedAt?: string | any
}
