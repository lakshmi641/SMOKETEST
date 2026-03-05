// Notification Types and Interfaces for PMS App

export type NotificationType =
  | 'task_assigned'
  | 'task_due_soon'
  | 'task_overdue'
  | 'task_completed'
  | 'task_updated'
  | 'approval_required'
  | 'approval_approved'
  | 'approval_rejected'
  | 'project_created'
  | 'project_updated'
  | 'project_milestone'
  | 'quality_alert'
  | 'system_announcement'
  | 'recurring_task_generated'
  | 'recurring_config_updated'
  | 'ghost_task_alert'
  | 'ghost_task_resolved'
  | 'recurring_task_paused'
  | 'recurring_task_reactivated'
  | 'recurring_schedule_ended'
  | 'workflow_completed';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export type DigestFrequency = 'immediate' | 'hourly' | 'daily' | 'weekly';

export interface Notification {
  id: string
  companyId: string
  userId: string
  type: NotificationType
  title: string
  message: string
  priority: NotificationPriority
  isRead: boolean
  readAt?: string
  actionRequired: boolean
  actionUrl?: string

  // Type-specific fields
  taskId?: string
  projectId?: string
  templateId?: string
  positionId?: string

  // Metadata
  metadata?: Record<string, any>
  expiresAt?: string

  // Timestamps
  createdAt: string
  updatedAt?: string
}

export interface FCMToken {
  id: string
  companyId: string
  userId: string
  token: string
  deviceType: 'web' | 'mobile'
  userAgent?: string
  createdAt: string
  lastUsed: string
  isActive: boolean
}

export interface NotificationPreferences {
  id: string
  companyId: string
  userId: string

  // Channel preferences
  emailNotifications: boolean
  pushNotifications: boolean
  inAppNotifications: boolean

  // Type preferences
  taskAssigned: boolean
  taskDueSoon: boolean
  taskOverdue: boolean
  taskCompleted: boolean
  taskUpdated: boolean
  approvalRequired: boolean
  approvalStatusChange: boolean
  projectUpdates: boolean
  qualityAlerts: boolean
  systemAnnouncements: boolean

  // Timing preferences
  dueSoonHours: number
  digestFrequency: DigestFrequency
  quietHours: {
    enabled: boolean
    startTime: string // HH:MM format
    endTime: string // HH:MM format
    timezone: string
  }

  // Sound preferences
  soundEnabled: boolean
  soundType?: string

  createdAt: string
  updatedAt: string
}

export interface NotificationStats {
  total: number
  unread: number
  byType: Record<NotificationType, number>
  byPriority: Record<NotificationPriority, number>
}

export type NotificationPermissionStatus = 'default' | 'granted' | 'denied';

