// components/offline/connection-popup.tsx
"use client";

import { CloudUpload, Wifi, WifiOff } from "lucide-react";
import { useEffect, useRef } from "react";

import { toast } from "sonner";
import { useOffline } from "@/lib/offline/use-offline";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function ConnectionPopup() {
  const { isOnline, pending, isSyncing, syncOfflineData, hasInternet, hasServer } =
    useOffline();

  const prevOnlineRef = useRef<boolean | null>(null);

  useEffect(() => {
    // ignore first render (avoid popup on initial load)
    if (prevOnlineRef.current === null) {
      prevOnlineRef.current = isOnline;
      return;
    }

    // went offline
    if (prevOnlineRef.current === true && isOnline === false) {
      toast.error("You’re offline", {
        description: !hasInternet
          ? "No internet connection. Changes will be saved locally."
          : "Internet is ok, but server is unreachable. Changes will be saved locally.",
        icon: <WifiOff className="h-4 w-4" />,
        duration: 5000,
      });
    }

    // came back online
    if (prevOnlineRef.current === false && isOnline === true) {
      toast.success("Back online", {
        description:
          pending > 0
            ? `Syncing ${pending} pending change${pending > 1 ? "s" : ""}…`
            : "All set.",
        icon: <Wifi className="h-4 w-4" />,
        duration: 3500,
      });

      // kick sync in background (tiny delay helps UI feel smooth)
      (async () => {
        await sleep(400);
        await syncOfflineData();
      })();
    }

    prevOnlineRef.current = isOnline;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  // Optional: show a “syncing” info toast when sync starts
  const prevSyncingRef = useRef<boolean>(false);
  useEffect(() => {
    if (!prevSyncingRef.current && isSyncing) {
      toast.message("Syncing changes…", {
        description: "Uploading queued actions to the server.",
        icon: <CloudUpload className="h-4 w-4" />,
        duration: 2500,
      });
    }
    prevSyncingRef.current = isSyncing;
  }, [isSyncing]);

  return null;
}
