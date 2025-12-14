"use client";

import { Button } from "@/components/ui/button";
import { reportNotSpamAction } from "../email-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function SpamBanner({ idForActions, reason }: { idForActions: string; reason?: string | null }) {
  const router = useRouter();

  const handleNotSpam = async () => {
    try {
      await reportNotSpamAction(idForActions);
      toast.success("Moved to inbox");

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("refresh-sidebar-counts"));
      }

      router.push("/email?folder=inbox");
      router.refresh();
    } catch (e) {
      console.error(e);
      toast.error("Failed");
    }
  };

  return (
    <div className="rounded-lg border bg-muted/40 p-4 flex items-center justify-between gap-4">
      <div className="text-sm">
        <span className="font-semibold">Why is this message in spam?</span>{" "}
        <span className="text-muted-foreground">
          {reason || "This message matched spam signals."}
        </span>
      </div>

      <Button variant="outline" onClick={handleNotSpam}>
        Report not spam
      </Button>
    </div>
  );
}
