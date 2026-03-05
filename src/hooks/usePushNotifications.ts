// Hook for managing push notifications setup and permissions

import { useState, useEffect, useCallback } from 'react';
import {
  getNotificationPermission,
  requestNotificationPermission,
  initializePushNotifications,
  deleteAllUserFCMTokens,
  setupTokenRefreshHandler
} from '@/lib/services/notifications';
import { useAuthStore } from '@/store/authStore';
import type { NotificationPermissionStatus } from '@/types/notifications';

interface UsePushNotificationsReturn {
  permission: NotificationPermissionStatus;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  requestPermission: () => Promise<boolean>;
  initialize: () => Promise<boolean>;
  cleanup: () => Promise<void>;
}

/**
 * Hook to manage push notifications for the current user
 * @param companyId - Optional company ID. If not provided, will try to get from user object
 */
export function usePushNotifications(companyId?: string | null, groupId?: string): UsePushNotificationsReturn {
  const { user } = useAuthStore();
  const resolvedCompanyId = companyId || user?.companyId || null;
  const [permission, setPermission] = useState<NotificationPermissionStatus>('default');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cleanupFn, setCleanupFn] = useState<(() => void) | null>(null);

  // Check permission status on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPermission(getNotificationPermission());
    }
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const newPermission = await requestNotificationPermission();
      setPermission(newPermission);

      if (newPermission === 'granted' && user && resolvedCompanyId) {
        // Auto-initialize if permission granted
        return await initialize(user.id, resolvedCompanyId, groupId);
      }

      return newPermission === 'granted';
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to request permission';
      setError(errorMessage);
      console.error('Error requesting notification permission:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, resolvedCompanyId]);

  // Initialize push notifications
  const initialize = useCallback(async (userId: string, companyId: string, groupId?: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const success = await initializePushNotifications(companyId, userId, groupId);

      if (success) {
        setIsInitialized(true);

        // Setup token refresh handler
        const cleanup = setupTokenRefreshHandler(
          companyId,
          userId,
          (newToken) => {
            console.log('FCM token refreshed:', newToken);
          }
        );

        setCleanupFn(() => cleanup);
      }

      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize push notifications';
      setError(errorMessage);
      console.error('Error initializing push notifications:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-initialize when user logs in and permission is granted
  useEffect(() => {
    if (user && resolvedCompanyId && permission === 'granted' && !isInitialized && !isLoading) {
      initialize(user.id, resolvedCompanyId, groupId);
    }
  }, [user, resolvedCompanyId, groupId, permission, isInitialized, isLoading, initialize]);

  // Cleanup on unmount or logout
  const cleanup = useCallback(async (): Promise<void> => {
    if (cleanupFn) {
      cleanupFn();
      setCleanupFn(null);
    }

    if (user && resolvedCompanyId) {
      try {
        await deleteAllUserFCMTokens(resolvedCompanyId, user.id);
      } catch (err) {
        console.error('Error cleaning up FCM tokens:', err);
      }
    }

    setIsInitialized(false);
  }, [cleanupFn, user, resolvedCompanyId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupFn) {
        cleanupFn();
      }
    };
  }, [cleanupFn]);

  return {
    permission,
    isInitialized,
    isLoading,
    error,
    requestPermission,
    initialize: user && resolvedCompanyId ? () => initialize(user.id, resolvedCompanyId, groupId) : async () => false,
    cleanup,
  };
}

