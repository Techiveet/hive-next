// components/offline/debug-panel.tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useOffline } from "@/lib/offline/use-offline";

export function DebugPanel() {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const { pending, isOnline, hasInternet, hasServer } = useOffline();
  
  useEffect(() => {
    const updateDebugInfo = async () => {
      // Check IndexedDB
      const dbInfo = await getIndexedDBInfo();
      
      // Check Cache
      const cacheInfo = await getCacheInfo();
      
      // Check Service Worker
      const swInfo = await getServiceWorkerInfo();
      
      setDebugInfo({
        timestamp: new Date().toISOString(),
        connection: {
          navigatorOnline: typeof navigator !== 'undefined' ? navigator.onLine : 'N/A',
          isOnline,
          hasInternet,
          hasServer,
        },
        queue: {
          pending,
        },
        storage: dbInfo,
        cache: cacheInfo,
        serviceWorker: swInfo,
      });
    };
    
    updateDebugInfo();
    const interval = setInterval(updateDebugInfo, 2000);
    return () => clearInterval(interval);
  }, [pending, isOnline, hasInternet, hasServer]);
  
  return (
    <Card className="fixed bottom-4 left-4 w-80 z-50">
      <CardContent className="p-4 space-y-2">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">Offline Debug</h3>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => console.log('Debug Info:', debugInfo)}
          >
            Log to Console
          </Button>
        </div>
        
        <div className="text-xs space-y-1">
          <div className="grid grid-cols-2 gap-1">
            <span className="text-muted-foreground">Status:</span>
            <span className={isOnline ? "text-green-600" : "text-red-600"}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
            
            <span className="text-muted-foreground">Pending:</span>
            <span>{pending}</span>
            
            <span className="text-muted-foreground">Internet:</span>
            <span>{hasInternet ? 'Yes' : 'No'}</span>
            
            <span className="text-muted-foreground">Server:</span>
            <span>{hasServer ? 'Reachable' : 'Unreachable'}</span>
          </div>
          
          <Button
            size="sm"
            variant="ghost"
            className="w-full mt-2"
            onClick={() => {
              const win = window.open('', '_blank');
              win?.document.write(`
                <pre>${JSON.stringify(debugInfo, null, 2)}</pre>
              `);
            }}
          >
            View Full Debug Info
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

async function getIndexedDBInfo() {
  if (typeof window === 'undefined') return {};
  
  try {
    const dbList = await indexedDB.databases?.() || [];
    return {
      databaseCount: dbList.length,
      databaseNames: dbList.map(db => db.name),
    };
  } catch {
    return { error: 'Could not access IndexedDB' };
  }
}

async function getCacheInfo() {
  if (typeof caches === 'undefined') return {};
  
  try {
    const cacheNames = await caches.keys();
    const cacheDetails = await Promise.all(
      cacheNames.map(async (name) => {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        return {
          name,
          itemCount: keys.length,
        };
      })
    );
    
    return {
      cacheCount: cacheNames.length,
      caches: cacheDetails,
    };
  } catch {
    return { error: 'Could not access Cache API' };
  }
}

async function getServiceWorkerInfo() {
  if (!('serviceWorker' in navigator)) return { available: false };
  
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    return {
      available: true,
      registrationCount: registrations.length,
      registrations: registrations.map(reg => ({
        scope: reg.scope,
        state: reg.active?.state || 'unknown',
      })),
    };
  } catch {
    return { error: 'Could not access Service Worker' };
  }
}