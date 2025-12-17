'use client';

import { useOffline } from '@/lib/use-offline';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function SyncStatus() {
  const { isOnline, syncOfflineData } = useOffline();
  const [pendingActions, setPendingActions] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Simplified - no IndexedDB for now
    setPendingActions(0);
  }, []);

  const handleSync = async () => {
    if (!isOnline || isSyncing) return;
    
    setIsSyncing(true);
    try {
      await syncOfflineData();
      setPendingActions(0);
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Always show for demo
  if (pendingActions === 0) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Badge variant="secondary">
          Offline mode ready
        </Badge>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
      <Badge variant="secondary">
        {pendingActions} pending sync{pendingActions > 1 ? 's' : ''}
      </Badge>
      
      {isOnline && (
        <Button
          size="sm"
          onClick={handleSync}
          disabled={isSyncing}
        >
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </Button>
      )}
    </div>
  );
}