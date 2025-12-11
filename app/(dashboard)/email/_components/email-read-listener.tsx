//app/(dashboard)/email/_components/email-read-listener.tsx
"use client";

import { markEmailAsReadAction } from "../email-actions";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function EmailReadListener({ 
  emailId, 
  isRead 
}: { 
  emailId: string; 
  isRead: boolean; 
}) {
  const router = useRouter();

  useEffect(() => {
    // Only fire if it hasn't been marked read yet
    if (!isRead) {
      markEmailAsReadAction(emailId).then(() => {
        router.refresh(); 
      });
    }
  }, [emailId, isRead, router]);

  return null; // Renders nothing visibly
}

