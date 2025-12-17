'use client';

import { useState, useEffect } from 'react';
import { offlineManager } from '@/lib/offline-manager';

export function useOffline() {
  const [isOnline, setIsOnline] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize offline manager
    offlineManager.init().then(() => {
      setIsInitialized(true);
    });

    // Set initial online status
    setIsOnline(navigator.onLine);

    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      // Sync offline data when coming back online
      offlineManager.syncOfflineActions();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const storeOfflineAction = async (
    url: string,
    method: string = 'POST',
    headers: Record<string, string> = {},
    body?: string
  ) => {
    if (!isInitialized) return;
    
    await offlineManager.storeOfflineAction({
      url,
      method,
      headers,
      body
    });
  };

  const syncOfflineData = async () => {
    if (!isInitialized || !isOnline) return;
    
    await offlineManager.syncOfflineActions();
  };

  return {
    isOnline,
    isInitialized,
    storeOfflineAction,
    syncOfflineData
  };
}