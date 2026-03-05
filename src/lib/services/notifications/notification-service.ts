// Real-time Notification Service
// Handles real-time notification listening and management

import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  updateDoc,
  deleteDoc,
  getDocs,
  Timestamp
} from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import { companyCollectionPathSegments } from '../../firestore-paths'
import type { Notification, NotificationType } from '@/types/notifications'

function getNotificationsRef(companyId: string, groupId?: string | null) {
  return groupId
    ? collection(db, ...companyCollectionPathSegments(groupId, companyId, 'notifications'))
    : collection(db, 'companies', companyId, 'notifications')
}

function getNotificationDocRef(companyId: string, notificationId: string, groupId?: string | null) {
  return groupId
    ? doc(db, ...companyCollectionPathSegments(groupId, companyId, 'notifications'), notificationId)
    : doc(db, 'companies', companyId, 'notifications', notificationId)
}

/**
 * Subscribe to real-time notifications for a user.
 * When groupId is set, uses enterpriseGroups/{groupId}/companies/{companyId}/notifications.
 */
export function subscribeToNotifications(
  companyId: string,
  userId: string,
  callback: (notifications: Notification[]) => void,
  options?: {
    limit?: number
    unreadOnly?: boolean
    type?: NotificationType
    groupId?: string | null
  }
): () => void {
  const notificationsRef = getNotificationsRef(companyId, options?.groupId)

  const q = query(
    notificationsRef,
    where('userId', '==', userId)
  )

  // Client-side filtering only
  // Removed additional query constraints to ensure stability

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      let notifications = snapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
          readAt: data.readAt?.toDate?.()?.toISOString() || data.readAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
          expiresAt: data.expiresAt?.toDate?.()?.toISOString() || data.expiresAt,
        } as Notification
      })

      // Client-side filtering
      if (options?.unreadOnly) {
        notifications = notifications.filter(n => !n.isRead)
      }
      if (options?.type) {
        notifications = notifications.filter(n => n.type === options.type)
      }

      // Sort client-side
      notifications.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime()
        const timeB = new Date(b.createdAt).getTime()
        return timeB - timeA // Descending
      })

      // Apply limit client-side
      if (options?.limit && notifications.length > options.limit) {
        notifications = notifications.slice(0, options.limit)
      }

      callback(notifications)
    },
    (error) => {
      console.error('Error listening to notifications:', error)
    }
  )

  return unsubscribe
}

/**
 * Get notifications for a user (one-time fetch).
 * When groupId is set, uses enterprise path.
 */
export async function getNotifications(
  companyId: string,
  userId: string,
  options?: {
    limit?: number
    unreadOnly?: boolean
    type?: NotificationType
    groupId?: string | null
  }
): Promise<Notification[]> {
  const notificationsRef = getNotificationsRef(companyId, options?.groupId)

  const q = query(
    notificationsRef,
    where('userId', '==', userId)
  )



  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => {
    const data = doc.data()
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
      readAt: data.readAt?.toDate?.()?.toISOString() || data.readAt,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
      expiresAt: data.expiresAt?.toDate?.()?.toISOString() || data.expiresAt,
    } as Notification
  })
    // Filter client-side
    .filter(n => {
      if (options?.unreadOnly && n.isRead) return false
      if (options?.type && n.type !== options.type) return false
      return true
    })
    // Sort client-side
    .sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime()
      const timeB = new Date(b.createdAt).getTime()
      return timeB - timeA // Descending
    })
    // Limit client-side
    .slice(0, options?.limit || undefined)
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(
  companyId: string,
  userId: string,
  groupId?: string | null
): Promise<number> {
  const notifications = await getNotifications(companyId, userId, { unreadOnly: true, groupId })
  return notifications.length
}

/**
 * Subscribe to unread notification count
 */
export function subscribeToUnreadCount(
  companyId: string,
  userId: string,
  callback: (count: number) => void,
  groupId?: string | null
): () => void {
  return subscribeToNotifications(
    companyId,
    userId,
    (notifications) => {
      const unreadCount = notifications.filter(n => !n.isRead).length
      callback(unreadCount)
    },
    { unreadOnly: true, groupId }
  )
}

/**
 * Mark notification as read
 */
export async function markAsRead(
  companyId: string,
  notificationId: string,
  groupId?: string | null
): Promise<void> {
  const notificationRef = getNotificationDocRef(companyId, notificationId, groupId)
  await updateDoc(notificationRef, {
    isRead: true,
    readAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(
  companyId: string,
  userId: string,
  groupId?: string | null
): Promise<void> {
  const unreadNotifications = await getNotifications(companyId, userId, { unreadOnly: true, groupId })

  const updatePromises = unreadNotifications.map(notification =>
    markAsRead(companyId, notification.id, groupId)
  )

  await Promise.all(updatePromises)
}

/**
 * Delete notification
 */
export async function deleteNotification(
  companyId: string,
  notificationId: string,
  groupId?: string | null
): Promise<void> {
  const notificationRef = getNotificationDocRef(companyId, notificationId, groupId)
  await deleteDoc(notificationRef)
}

/**
 * Delete all notifications for a user
 */
export async function deleteAllNotifications(
  companyId: string,
  userId: string,
  groupId?: string | null
): Promise<void> {
  const notifications = await getNotifications(companyId, userId, { groupId })

  const deletePromises = notifications.map(notification =>
    deleteNotification(companyId, notification.id, groupId)
  )

  await Promise.all(deletePromises)
}

