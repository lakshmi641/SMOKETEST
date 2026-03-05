'use client'

// Component to initialize push notifications when user is authenticated
// Add this component to your app layout or auth provider

import { useEffect } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useCompany } from '@/contexts/CompanyContext';

export function PushNotificationInitializer() {
  const { companyId, groupId } = useCompany();
  const { permission, isInitialized, requestPermission } = usePushNotifications(companyId, groupId || undefined);

  // Request permission if not already granted/denied
  useEffect(() => {
    if (permission === 'default' && !isInitialized) {
      // Optionally request permission automatically
      // Or wait for user to click a button
      // For now, we'll wait for user action or show a prompt
      console.log('Push notifications available. Permission status:', permission);
    }
  }, [permission, isInitialized]);

  // This component doesn't render anything visible
  // It just initializes push notifications in the background
  return null;
}

