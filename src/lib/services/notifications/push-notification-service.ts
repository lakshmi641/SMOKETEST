// Firebase Cloud Messaging (FCM) Push Notification Service
// Handles FCM token management, permissions, and push notification setup

import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  updateDoc,
  getDoc,
  serverTimestamp
} from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import { getMessagingToken } from '../../../lib/firebase'
import type { FCMToken, NotificationPermissionStatus } from '@/types/notifications'

// Service worker registration
let serviceWorkerRegistration: ServiceWorkerRegistration | null = null;

/**
 * Register the service worker for background notifications
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('Service Workers are not supported in this browser');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/'
    });

    console.log('Service Worker registered successfully:', registration.scope);
    serviceWorkerRegistration = registration;
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('Notifications are not supported in this browser');
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    console.log('Notification permission:', permission);
    return permission as NotificationPermissionStatus;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return 'denied';
  }
}

/**
 * Check current notification permission status
 */
export function getNotificationPermission(): NotificationPermissionStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  return Notification.permission as NotificationPermissionStatus;
}

/**
 * Get or generate FCM token for the current user
 */
export async function getFCMToken(companyId: string, userId: string, groupId?: string): Promise<string | null> {
  try {
    // Check if service worker is registered
    if (!serviceWorkerRegistration) {
      const registration = await registerServiceWorker();
      if (!registration) {
        console.warn('Service worker registration failed');
        return null;
      }
    }

    // Wait a bit for service worker to be ready
    // This ensures messaging can be initialized properly
    if (serviceWorkerRegistration?.active) {
      await new Promise(resolve => setTimeout(resolve, 100));
    } else if (serviceWorkerRegistration?.installing) {
      // Wait for service worker to be installed
      await new Promise((resolve) => {
        const sw = serviceWorkerRegistration!.installing;
        if (sw) {
          sw.addEventListener('statechange', function () {
            if (sw.state === 'activated') {
              resolve(undefined);
            }
          });
        } else {
          resolve(undefined);
        }
      });
    }

    // Initialize messaging after service worker is ready
    const { initializeMessaging } = await import('../../../lib/firebase');
    await initializeMessaging();

    // Check permission
    const permission = getNotificationPermission();
    if (permission !== 'granted') {
      console.log('Notification permission not granted:', permission);
      return null;
    }

    // Get the messaging token
    const token = await getMessagingToken();
    if (!token) {
      console.log('Failed to get FCM token');
      return null;
    }

    // Save the token to Firestore
    await saveFCMToken(companyId, userId, token, groupId);

    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
}

/**
 * Save FCM token to Firestore
 */
async function saveFCMToken(
  companyId: string,
  userId: string,
  token: string,
  groupId?: string
): Promise<void> {
  try {
    const pathSegments = groupId
      ? [`enterpriseGroups/${groupId}/companies/${companyId}/fcmTokens`]
      : [`companies/${companyId}/fcmTokens`];
    const tokenRef = doc(db, pathSegments[0], token);
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';

    const tokenData: Omit<FCMToken, 'id'> = {
      companyId,
      userId,
      token,
      deviceType: 'web',
      userAgent,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      isActive: true,
    };

    await setDoc(tokenRef, tokenData, { merge: true });
    console.log('FCM token saved to Firestore');
  } catch (error) {
    console.error('Error saving FCM token:', error);
    throw error;
  }
}

/**
 * Update FCM token last used timestamp
 */
export async function updateFCMTokenLastUsed(
  companyId: string,
  token: string
): Promise<void> {
  try {
    const tokenRef = doc(db, 'companies', companyId, 'fcmTokens', token);
    await updateDoc(tokenRef, {
      lastUsed: new Date().toISOString(),
      isActive: true,
    });
  } catch (error) {
    console.error('Error updating FCM token last used:', error);
  }
}

/**
 * Get all FCM tokens for a user
 */
export async function getUserFCMTokens(
  companyId: string,
  userId: string
): Promise<FCMToken[]> {
  try {
    const tokensRef = collection(db, 'companies', companyId, 'fcmTokens');
    const q = query(tokensRef, where('userId', '==', userId), where('isActive', '==', true));

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as FCMToken));
  } catch (error) {
    console.error('Error getting user FCM tokens:', error);
    return [];
  }
}

/**
 * Deactivate FCM token (mark as inactive)
 */
export async function deactivateFCMToken(
  companyId: string,
  token: string
): Promise<void> {
  try {
    const tokenRef = doc(db, 'companies', companyId, 'fcmTokens', token);
    await updateDoc(tokenRef, {
      isActive: false,
    });
    console.log('FCM token deactivated');
  } catch (error) {
    console.error('Error deactivating FCM token:', error);
    throw error;
  }
}

/**
 * Delete FCM token
 */
export async function deleteFCMToken(
  companyId: string,
  token: string
): Promise<void> {
  try {
    const tokenRef = doc(db, 'companies', companyId, 'fcmTokens', token);
    await deleteDoc(tokenRef);
    console.log('FCM token deleted');
  } catch (error) {
    console.error('Error deleting FCM token:', error);
    throw error;
  }
}

/**
 * Delete all FCM tokens for a user (e.g., on logout)
 */
export async function deleteAllUserFCMTokens(
  companyId: string,
  userId: string
): Promise<void> {
  try {
    const tokens = await getUserFCMTokens(companyId, userId);
    const deletePromises = tokens.map(token => deleteFCMToken(companyId, token.token));
    await Promise.all(deletePromises);
    console.log(`Deleted ${tokens.length} FCM tokens for user ${userId}`);
  } catch (error) {
    console.error('Error deleting all user FCM tokens:', error);
    throw error;
  }
}

/**
 * Initialize push notifications for a user
 * Call this after user login
 */
export async function initializePushNotifications(
  companyId: string,
  userId: string,
  groupId?: string
): Promise<boolean> {
  try {
    // Register service worker first
    const registration = await registerServiceWorker();
    if (!registration) {
      console.warn('Service worker registration failed');
      return false;
    }

    // Wait for service worker to be ready
    if (registration.installing) {
      await new Promise<void>((resolve) => {
        const sw = registration.installing;
        if (sw) {
          sw.addEventListener('statechange', function () {
            if (sw.state === 'activated' || sw.state === 'redundant') {
              resolve();
            }
          });
        } else {
          resolve();
        }
      });
    }

    // Initialize messaging after service worker is ready
    const { initializeMessaging } = await import('../../../lib/firebase');
    const messagingInstance = await initializeMessaging();
    if (!messagingInstance) {
      console.warn('Failed to initialize Firebase Messaging');
      return false;
    }

    // Check if permission is already granted
    const permission = getNotificationPermission();
    if (permission === 'granted') {
      // Get and save FCM token
      const token = await getFCMToken(companyId, userId, groupId);
      return token !== null;
    } else if (permission === 'default') {
      // Permission not requested yet - user can request it later
      console.log('Notification permission not requested yet');
      return false;
    } else {
      // Permission denied
      console.log('Notification permission denied');
      return false;
    }
  } catch (error) {
    console.error('Error initializing push notifications:', error);
    return false;
  }
}

/**
 * Setup FCM token refresh handler
 */
export function setupTokenRefreshHandler(
  companyId: string,
  userId: string,
  onTokenRefresh?: (token: string) => void
): () => void {
  // Note: Firebase SDK automatically refreshes tokens when needed
  // This is a placeholder for custom refresh logic if needed

  const handleTokenRefresh = async () => {
    try {
      const newToken = await getMessagingToken();
      if (newToken) {
        await saveFCMToken(companyId, userId, newToken);
        if (onTokenRefresh) {
          onTokenRefresh(newToken);
        }
      }
    } catch (error) {
      console.error('Error handling token refresh:', error);
    }
  };

  // Listen for service worker updates (which may indicate token refresh)
  if (serviceWorkerRegistration) {
    serviceWorkerRegistration.addEventListener('updatefound', handleTokenRefresh);
  }

  // Return cleanup function
  return () => {
    if (serviceWorkerRegistration) {
      serviceWorkerRegistration.removeEventListener('updatefound', handleTokenRefresh);
    }
  };
}

