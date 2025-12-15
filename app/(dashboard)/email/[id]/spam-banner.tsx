"use client";

import { Button } from "@/components/ui/button";
import { reportNotSpamAction } from "../email-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/hooks/use-translation";

export function SpamBanner({
  idForActions,
  reason,
}: {
  idForActions: string;
  reason?: string | null;
}) {
  const router = useRouter();
  const { t } = useTranslation();

  const handleNotSpam = async () => {
    try {
      await reportNotSpamAction(idForActions);

      toast.success(t("email.spam.toast.movedToInbox", "Moved to inbox"));

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("refresh-sidebar-counts"));
      }

      router.push("/email?folder=inbox");
      router.refresh();
    } catch (e) {
      console.error(e);
      toast.error(t("common.failed", "Failed"));
    }
  };

  return (
    <div className="rounded-lg border bg-muted/40 p-4 flex items-center justify-between gap-4">
      <div className="text-sm">
        <span className="font-semibold">
          {t("email.spam.whyTitle", "Why is this message in spam?")}
        </span>{" "}
        <span className="text-muted-foreground">
          {reason || t("email.spam.defaultReason", "This message matched spam signals.")}
        </span>
      </div>

      <Button variant="outline" onClick={handleNotSpam}>
        {t("email.spam.reportNotSpam", "Report not spam")}
      </Button>
    </div>
  );
}
