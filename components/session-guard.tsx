"use client";

import { useEffect, useRef } from "react";

import { toast } from "sonner";
import { useRouter } from "next/navigation";

const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
];

interface SessionGuardProps {
  timeoutMinutes: number;
}

export function SessionGuard({ timeoutMinutes }: SessionGuardProps) {
  const router = useRouter();
  const lastActivityRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Convert minutes to milliseconds
    const timeoutMs = timeoutMinutes * 60 * 1000;

    const handleLogout = () => {
      if (timerRef.current) clearInterval(timerRef.current);

      // 1. Show Toast Immediately
      toast.error("Session ended due to inactivity", {
        description: "You have been logged out for security.",
        duration: 5000,
      });

      // 2. Redirect to sign-in with a reason query param
      // (This allows the sign-in page to show the error again if this toast is lost during navigation)
      router.push("/sign-in?error=session_expired");
      router.refresh();
    };

    const checkActivity = () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;

      if (timeSinceLastActivity >= timeoutMs) {
        handleLogout();
      }
    };

    const onUserActivity = () => {
      lastActivityRef.current = Date.now();
    };

    // Attach listeners
    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, onUserActivity);
    });

    // Check every minute
    timerRef.current = setInterval(checkActivity, 60 * 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, onUserActivity);
      });
    };
  }, [timeoutMinutes, router]);

  return null;
}