"use client";

import { ConnectionPopup } from "@/components/offline/connection-popup";
import { RegisterServiceWorker } from "@/components/offline/register-service-worker";

// OR if you use register-sw.tsx, import that one instead.

export function OfflineUI() {
  return (
    <>
      <RegisterServiceWorker />
      <ConnectionPopup />
    </>
  );
}
