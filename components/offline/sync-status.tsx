//components/offline/sync-status.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOffline } from "@/lib/offline/use-offline";

export function SyncStatus() {
  const { isOnline, pending, isSyncing, syncOfflineData } = useOffline();

  if (pending === 0) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Badge variant="secondary">Offline queue ready</Badge>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
      <Badge variant="secondary">
        {pending} pending sync{pending > 1 ? "s" : ""}
      </Badge>

      {isOnline && (
        <Button size="sm" onClick={syncOfflineData} disabled={isSyncing}>
          {isSyncing ? "Syncing..." : "Sync Now"}
        </Button>
      )}
    </div>
  );
}