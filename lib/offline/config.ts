// lib/offline/config.ts
export const offlineConfig = {
  // Network detection
  serverCheckTimeout: 2000,
  serverCheckInterval: 15000,
  
  // Queue settings
  maxFileSize: 5 * 1024 * 1024, // 5MB
  maxRetries: 3,
  retryDelay: 5000, // 5 seconds
  
  // Sync settings
  syncBatchSize: 5,
  syncTimeout: 10000, // 10 seconds per request
  minSyncInterval: 5000, // 5 seconds between syncs
  autoSyncDelay: 1000, // 1 second delay after coming online
  
  // UI settings
  toastDuration: {
    connection: 3000,
    sync: 2000,
    error: 5000,
  },
  
  // Service Worker
  cacheName: "hive-v4",
  assetsToCache: ["/", "/icon", "/manifest.json", "/offline.html"],
};

export type OfflineConfig = typeof offlineConfig;