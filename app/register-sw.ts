// app/register-sw.tsx
"use client";

import { useEffect } from "react";

export default function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js")
        .then((reg) => {
          console.log("SW registered:", reg);
        })
        .catch((e) => console.error("SW register failed:", e));
    }

    function onOnline() {
      // ask the SW to perform a background sync if available
      if ("serviceWorker" in navigator && (navigator as any).serviceWorker?.ready) {
        (navigator as any).serviceWorker.ready
          .then((reg: ServiceWorkerRegistration) => {
            if (reg.sync) {
              reg.sync.register("sync-pending").catch((err: any) => {
                // fallback: send a message to SW to trigger sync manually
                console.warn("Background sync register failed", err);
                if (reg.active) {
                  reg.active.postMessage({ type: "sync-pending" });
                }
              });
            } else {
              // no background sync support; postMessage to SW to run sync logic
              if (reg.active) reg.active.postMessage({ type: "sync-pending" });
            }
          })
          .catch((err: any) => console.error("serviceWorker.ready error", err));
      }
    }

    window.addEventListener("online", onOnline);

    return () => {
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return null;
}
