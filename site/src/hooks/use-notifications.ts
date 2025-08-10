import { useState, useEffect } from 'react';

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      console.log('[NOTIFICATIONS] Notification API available, current permission:', Notification.permission);
      setPermission(Notification.permission);
    } else {
      console.log('[NOTIFICATIONS] Notification API not available');
    }
  }, []);

  const requestPermission = async () => {
    console.log('[NOTIFICATIONS] requestPermission called');
    if ('Notification' in window) {
      console.log('[NOTIFICATIONS] Requesting notification permission...');
      const status = await Notification.requestPermission();
      console.log('[NOTIFICATIONS] Permission request result:', status);
      setPermission(status);
      return status;
    }
    console.log('[NOTIFICATIONS] Notification API not available, returning denied');
    return 'denied' as NotificationPermission;
  };

  const showNotification = async (title: string, options?: NotificationOptions) => {
    console.log('[NOTIFICATIONS] showNotification called with title:', title);
    console.log('[NOTIFICATIONS] Current permission state:', permission);
    
    if (!('Notification' in window)) {
      console.log('[NOTIFICATIONS] Notification API not available');
      return false;
    }

    let currentPermission = permission;

    // If permission is default, request it first
    if (currentPermission === 'default') {
      console.log('[NOTIFICATIONS] Permission is default, requesting permission...');
      currentPermission = await requestPermission();
    }

    console.log('[NOTIFICATIONS] Final permission for notification:', currentPermission);

    // Only show notification if permission is granted
    if (currentPermission === 'granted') {
      console.log('[NOTIFICATIONS] Showing notification');
      new Notification(title, options);
      return true;
    }

    console.log('[NOTIFICATIONS] Not showing notification - permission not granted');
    return false;
  };

  return { permission, requestPermission, showNotification };
} 