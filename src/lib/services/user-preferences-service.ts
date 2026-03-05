/**
 * User Preferences Service
 * Manages user-specific preferences (theme, timezone, etc.)
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { enterpriseGroupCompanySubcollectionPath } from '@/lib/firestore-paths'
import type { UserPreferences } from '@/types/user-preferences'
import { DEFAULT_USER_PREFERENCES } from '@/types/user-preferences'

export class UserPreferencesService {
  /**
   * Get user preferences document reference
   * Path: enterpriseGroups/{groupId}/companies/{companyId}/userPreferences/{userId}
   */
  private static getPreferencesRef(companyId: string, userId: string, groupId?: string | null) {
    const effectiveGroupId = groupId || companyId
    const path = enterpriseGroupCompanySubcollectionPath(effectiveGroupId, companyId, 'userPreferences')
    return doc(db, path, userId)
  }

  /**
   * Get default preferences for new users
   */
  private static getDefaultPreferences(userId: string, companyId: string): UserPreferences {
    const now = new Date().toISOString()
    return {
      userId,
      companyId,
      theme: DEFAULT_USER_PREFERENCES.theme,
      timezone: DEFAULT_USER_PREFERENCES.timezone,
      createdAt: now,
      updatedAt: now,
    }
  }

  /**
   * Get user preferences (creates default if not exists)
   */
  static async getUserPreferences(
    companyId: string,
    userId: string,
    groupId?: string | null
  ): Promise<UserPreferences> {
    const prefRef = this.getPreferencesRef(companyId, userId, groupId)
    const snapshot = await getDoc(prefRef)

    const defaultPrefs = this.getDefaultPreferences(userId, companyId)

    if (!snapshot.exists()) {
      // Create default preferences
      await setDoc(prefRef, {
        ...defaultPrefs,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
      return defaultPrefs
    }

    const data = snapshot.data()
    return {
      userId: data.userId || userId,
      companyId: data.companyId || companyId,
      theme: data.theme || defaultPrefs.theme,
      timezone: data.timezone || defaultPrefs.timezone,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || defaultPrefs.createdAt,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || defaultPrefs.updatedAt,
    }
  }

  /**
   * Update user preferences
   */
  static async updateUserPreferences(
    companyId: string,
    userId: string,
    updates: Partial<Pick<UserPreferences, 'theme' | 'timezone'>>,
    groupId?: string | null
  ): Promise<void> {
    const prefRef = this.getPreferencesRef(companyId, userId, groupId)

    await updateDoc(prefRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    })
  }

  /**
   * Update theme preference
   */
  static async updateTheme(
    companyId: string,
    userId: string,
    theme: 'light' | 'dark' | 'system'
  ): Promise<void> {
    await this.updateUserPreferences(companyId, userId, { theme })
  }

  /**
   * Update timezone preference
   */
  static async updateTimezone(
    companyId: string,
    userId: string,
    timezone: string
  ): Promise<void> {
    await this.updateUserPreferences(companyId, userId, { timezone })
  }
}
