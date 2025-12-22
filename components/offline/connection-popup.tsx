// components/offline/connection-popup.tsx - UPDATED
"use client";

import { AlertCircle, CloudUpload, HardDrive, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { toast } from "sonner";
import { useOffline } from "@/lib/offline/use-offline";

type NetState = "online" | "offline-internet" | "offline-server" | "degraded";

function computeState(hasInternet: boolean, hasServer: boolean): NetState {
  if (!hasInternet) return "offline-internet";
  if (!hasServer) return "offline-server";
  return "online";
}

export function ConnectionPopup() {
  const { 
    isOnline, 
    pending, 
    isSyncing, 
    syncOfflineData, 
    hasInternet, 
    hasServer, 
    checkConnection 
  } = useOffline();

  const [showDetails, setShowDetails] = useState(false);
  const [lastChange, setLastChange] = useState<number>(Date.now());

  // derive a stable state label
  const state = useMemo(() => computeState(hasInternet, hasServer), [hasInternet, hasServer]);

  // Track state changes for UX
  const prevStateRef = useRef<NetState | null>(null);
  const lastToastAtRef = useRef<number>(0);
  const toastIdRef = useRef<string | number>("connection-status");

  // Handle connection state changes
  useEffect(() => {
    const now = Date.now();
    const prev = prevStateRef.current;
    
    if (prev === null) {
      prevStateRef.current = state;
      return;
    }

    // Prevent rapid toggling (debounce 1.5s)
    if (now - lastToastAtRef.current < 1500) {
      prevStateRef.current = state;
      return;
    }

    // State actually changed
    if (prev !== state) {
      lastToastAtRef.current = now;
      setLastChange(now);

      const messages = {
        "online": {
          title: "Back online",
          description: pending > 0 
            ? `Syncing ${pending} pending change${pending > 1 ? "s" : ""}…` 
            : "You're connected",
          icon: <Wifi className="h-4 w-4" />,
          variant: "success" as const,
        },
        "offline-internet": {
          title: "You're offline",
          description: "No internet connection. Changes will be saved locally.",
          icon: <WifiOff className="h-4 w-4" />,
          variant: "error" as const,
        },
        "offline-server": {
          title: "Server unreachable",
          description: "Internet is available but server isn't responding. Working offline.",
          icon: <AlertCircle className="h-4 w-4" />,
          variant: "warning" as const,
        },
      };

      const config = messages[state];
      if (config) {
        if (state === "online") {
          toast.success(config.title, {
            id: toastIdRef.current,
            description: config.description,
            icon: config.icon,
            duration: 3000,
            action: pending > 0 ? {
              label: "Sync Now",
              onClick: () => syncOfflineData(),
            } : undefined,
          });
          
          // Auto-sync when coming online
          if (pending > 0 && !isSyncing) {
            setTimeout(() => syncOfflineData(), 1000);
          }
          
        } else {
          toast.error(config.title, {
            id: toastIdRef.current,
            description: config.description,
            icon: config.icon,
            duration: 5000,
            action: {
              label: "Retry",
              onClick: () => checkConnection(),
            },
          });
        }
      }
    }

    prevStateRef.current = state;
  }, [state, pending, isSyncing, syncOfflineData, checkConnection]);

  // Sync status toasts
  const prevSyncRef = useRef(false);
  useEffect(() => {
    const syncToastId = "sync-status";
    
    if (!prevSyncRef.current && isSyncing) {
      toast.loading("Syncing changes…", {
        id: syncToastId,
        description: `Uploading ${pending} queued action${pending !== 1 ? "s" : ""}…`,
        icon: <CloudUpload className="h-4 w-4 animate-pulse" />,
        duration: Infinity,
      });
    }

    if (prevSyncRef.current && !isSyncing) {
      toast.dismiss(syncToastId);
      
      // Don't show success toast if no items were synced
      if (pending === 0) {
        toast.success("Sync complete", {
          id: syncToastId,
          description: "All changes are up to date.",
          duration: 2000,
        });
      }
    }

    prevSyncRef.current = isSyncing;
  }, [isSyncing, pending]);

  // Show pending count badge in toast when items are queued
  useEffect(() => {
    if (pending > 0 && !isOnline && !isSyncing) {
      const pendingToastId = "pending-items";
      
      toast.message("Offline changes pending", {
        id: pendingToastId,
        description: `${pending} item${pending > 1 ? "s" : ""} will sync when back online.`,
        icon: <HardDrive className="h-4 w-4" />,
        duration: 6000,
        action: {
          label: "Details",
          onClick: () => setShowDetails(true),
        },
      });
      
      // Auto-dismiss after 6 seconds
      const timer = setTimeout(() => {
        toast.dismiss(pendingToastId);
      }, 6000);
      
      return () => clearTimeout(timer);
    }
  }, [pending, isOnline, isSyncing]);

  return null;
}