/**
 * User Preferences Type
 * Stores user-specific preferences like theme and timezone
 */

export interface UserPreferences {
  userId: string
  companyId: string
  theme: 'light' | 'dark' | 'system'
  timezone: string
  createdAt: string
  updatedAt: string
}

export const DEFAULT_USER_PREFERENCES: Omit<UserPreferences, 'userId' | 'companyId' | 'createdAt' | 'updatedAt'> = {
  theme: 'system',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
}
