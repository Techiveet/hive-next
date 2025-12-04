"use client";

import { usePathname, useRouter } from "next/navigation";

import { toast } from "sonner";
import { useEffect } from "react";

export function TwoFactorEnforcer({ 
  enforced, 
  isEnabled 
}: { 
  enforced: boolean; 
  isEnabled: boolean 
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // If 2FA is enforced, but user doesn't have it enabled...
    if (enforced && !isEnabled) {
      // ...and they are NOT already on the settings page to fix it
      if (!pathname.includes("/settings")) {
        toast.error("Security Policy: Two-Factor Authentication is required.");
        router.push("/settings?section=system"); // Send them to enable it
      }
    }
  }, [enforced, isEnabled, pathname, router]);

  return null;
}