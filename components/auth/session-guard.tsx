// components/auth/session-guard.tsx
"use client";

import { useEffect, useRef } from "react";

import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

const INACTIVITY_TIMEOUT_MINUTES = 15;
const INACTIVITY_TIMEOUT_MS = INACTIVITY_TIMEOUT_MINUTES * 60 * 1000;

type Props = {
  children: React.ReactNode;
};

export function SessionGuard({ children }: Props) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // auto-logout handler
    const logoutAndRedirect = async () => {
      try {
        await authClient.signOut();
      } catch {
        // ignore – worst case cookie is already gone
      }
      router.replace("/sign-in?timeout=1");
    };

    const resetTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(logoutAndRedirect, INACTIVITY_TIMEOUT_MS);
    };

    // start timer once
    resetTimer();

    const activityEvents: (keyof WindowEventMap)[] = [
      "mousemove",
      "keydown",
      "click",
      "scroll",
      "touchstart",
    ];

    activityEvents.forEach((event) =>
      window.addEventListener(event, resetTimer)
    );

    // 🧠 Fix: if user hits Back and the page comes from bfcache,
    // force a reload so the server-side auth check runs again.
    const handlePageShow = (event: PageTransitionEvent) => {
      // REMOVED THE @ts-expect-error comment below because TypeScript now knows this property exists
      if (event.persisted) {
        window.location.reload();
      }
    };
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      activityEvents.forEach((event) =>
        window.removeEventListener(event, resetTimer)
      );
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [router]);

  return <>{children}</>;
}