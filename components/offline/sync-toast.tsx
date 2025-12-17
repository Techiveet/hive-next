"use client";

import { useEffect, useState } from "react";

export function SyncToast() {
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    function handle(e: MessageEvent) {
      const data: any = (e as any).data;
      if (!data) return;

      if (data.type === "sync-start") setSyncing(true);
      if (data.type === "sync-complete") setSyncing(false);
    }

    navigator.serviceWorker?.addEventListener("message", handle);
    return () => navigator.serviceWorker?.removeEventListener("message", handle);
  }, []);

  if (!syncing) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        bottom: 12,
        background: "#111827",
        color: "#fff",
        padding: "8px 12px",
        borderRadius: 6,
        zIndex: 9999,
      }}
    >
      Syncing pending changes…
    </div>
  );
}
