// components/OfflineBadge.tsx
"use client";

import { useEffect, useState } from "react";

export default function OfflineBadge() {
  const [mounted, setMounted] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    // Mark as mounted (client-only)
    setMounted(true);

    // Initial online state
    setOnline(navigator.onLine);

    function handleOnline() {
      setOnline(true);
    }

    function handleOffline() {
      setOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // 🔥 CRITICAL: do not render on server
  if (!mounted) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 12,
        top: 12,
        zIndex: 9999,
        padding: "6px 10px",
        borderRadius: 8,
        boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
        background: online ? "#10b98122" : "#ef444422",
        color: online ? "#065f46" : "#7f1d1d",
        fontWeight: 600,
        fontSize: 13,
      }}
    >
      {online ? "Online" : "Offline — Changes saved locally"}
    </div>
  );
}
