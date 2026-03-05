'use client'

// Notification Context for real-time notification management

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useCompany } from './CompanyContext'
import {
  subscribeToNotifications,
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  subscribeToUnreadCount,
  deleteNotification
} from '@/lib/services/notifications/notification-service'
import type { Notification } from '@/types/notifications'
import { logger } from '@/lib/logger'
import { auth } from '@/lib/firebase'

interface NotificationContextType {
  // Notifications
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
  error: string | null

  // Actions
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (notificationId: string) => Promise<void>
  refreshNotifications: () => Promise<void>

  // Subscriptions
  subscribe: () => void
  unsubscribe: () => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

interface NotificationProviderProps {
  children: ReactNode
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const { user } = useAuthStore()
  const { companyId, groupId } = useCompany()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Use refs to track unsubscribe functions to avoid infinite loops
  const unsubscribeFnRef = useRef<(() => void) | null>(null)
  const unreadUnsubscribeFnRef = useRef<(() => void) | null>(null)

  // Shared function to cleanup subscriptions
  const cleanupSubscriptions = useCallback(() => {
    if (unsubscribeFnRef.current) {
      unsubscribeFnRef.current()
      unsubscribeFnRef.current = null
    }
    if (unreadUnsubscribeFnRef.current) {
      unreadUnsubscribeFnRef.current()
      unreadUnsubscribeFnRef.current = null
    }
  }, [])



  // Shared function to setup subscriptions
  const setupSubscriptions = useCallback(() => {
    if (!user || !companyId || !auth.currentUser) {
      if (!user) {
        // Clear if no user
        setNotifications([])
        setUnreadCount(0)
      }
      return
    }

    // Cleanup existing subscriptions first
    cleanupSubscriptions()

    try {
      // Subscribe to notifications
      const unsub = subscribeToNotifications(
        companyId,
        user.id,
        (notifs) => {
          setNotifications(notifs)
          setIsLoading(false)
          setError(null)
        },
        { limit: 50, groupId: groupId ?? undefined }
      )

      const unreadUnsub = subscribeToUnreadCount(
        companyId,
        user.id,
        (count) => setUnreadCount(count),
        groupId ?? undefined
      )

      unsubscribeFnRef.current = unsub
      unreadUnsubscribeFnRef.current = unreadUnsub
    } catch (err) {
      logger.error('Error subscribing to notifications:', err)
      setError(err instanceof Error ? err.message : 'Failed to subscribe to notifications')
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, companyId, groupId])

  // Subscribe to notifications (manual trigger if needed)
  const subscribe = useCallback(() => {
    setupSubscriptions()
  }, [setupSubscriptions])

  // Unsubscribe (manual trigger if needed)
  const unsubscribe = useCallback(() => {
    cleanupSubscriptions()
  }, [cleanupSubscriptions])

  // Load notifications on mount or when user/company changes
  useEffect(() => {
    if (user && companyId) {
      setupSubscriptions()
    } else {
      setNotifications([])
      setUnreadCount(0)
      setIsLoading(false)
    }

    return () => {
      cleanupSubscriptions()
    }
  }, [user?.id, companyId, setupSubscriptions])

  // Mark notification as read
  const handleMarkAsRead = useCallback(async (notificationId: string) => {
    if (!companyId) return

    try {
      await markAsRead(companyId, notificationId, groupId ?? undefined)
      // Update local state optimistically
      setNotifications(prev => prev.map(n =>
        n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
      ))
    } catch (err) {
      logger.error('Error marking notification as read:', err)
      throw err
    }
  }, [companyId, groupId])

  // Mark all as read
  const handleMarkAllAsRead = useCallback(async () => {
    if (!user || !companyId) return

    try {
      await markAllAsRead(companyId, user.id, groupId ?? undefined)
      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() })))
      setUnreadCount(0)
    } catch (err) {
      logger.error('Error marking all notifications as read:', err)
      throw err
    }
  }, [user, companyId, groupId])

  // Delete notification
  const handleDeleteNotification = useCallback(async (notificationId: string) => {
    if (!companyId) return

    try {
      await deleteNotification(companyId, notificationId, groupId ?? undefined)
      // Update local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
    } catch (err) {
      logger.error('Error deleting notification:', err)
      throw err
    }
  }, [companyId, groupId])

  // Refresh notifications
  const refreshNotifications = useCallback(async () => {
    if (!user || !companyId) return

    try {
      setIsLoading(true)
      const notifs = await getNotifications(companyId, user.id, { limit: 50, groupId: groupId ?? undefined })
      setNotifications(notifs)

      const count = await getUnreadCount(companyId, user.id, groupId ?? undefined)
      setUnreadCount(count)

      setIsLoading(false)
      setError(null)
    } catch (err) {
      logger.error('Error refreshing notifications:', err)
      setError(err instanceof Error ? err.message : 'Failed to refresh notifications')
      setIsLoading(false)
    }
  }, [user, companyId, groupId])

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead: handleMarkAsRead,
    markAllAsRead: handleMarkAllAsRead,
    deleteNotification: handleDeleteNotification,
    refreshNotifications,
    subscribe,
    unsubscribe,
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

// Hook to use notification context
export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

