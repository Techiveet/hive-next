'use client';

import { useOffline } from '@/lib/use-offline';
import { Badge } from '@/components/ui/badge';

export function OfflineIndicator() {
  const { isOnline } = useOffline();

  if (isOnline) return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      <Badge variant="destructive" className="animate-pulse">
        Offline Mode
      </Badge>
    </div>
  );
}