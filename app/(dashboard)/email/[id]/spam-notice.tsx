"use client";

import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import { reportNotSpamByEmailIdAction } from "../email-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function SpamNotice(props: {
  emailId: string;
  previousFolder: string;
  spamReason?: string | null;
  spamScore?: number | null;
  spamFlags?: any;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const handleReportNotSpam = () => {
    start(async () => {
      try {
        await reportNotSpamByEmailIdAction(props.emailId);

        toast.success("Moved to inbox");
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("refresh-sidebar-counts"));
        }

        // go back to previous folder (or inbox)
        router.push(`/email?folder=${props.previousFolder || "inbox"}`);
        router.refresh();
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || "Failed to report not spam");
      }
    });
  };

  return (
    <div className="rounded-lg border bg-slate-50 dark:bg-slate-900/40 px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <Info className="h-4 w-4 mt-0.5 text-slate-500" />
        <div className="text-sm text-slate-700 dark:text-slate-200">
          <span className="font-semibold">Why is this message in spam?</span>{" "}
          <span className="text-slate-600 dark:text-slate-400">
            {props.spamReason
              ? props.spamReason
              : "This message matches patterns identified as spam."}
            {typeof props.spamScore === "number" ? ` (score: ${props.spamScore.toFixed(2)})` : ""}
          </span>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={handleReportNotSpam}
      >
        {pending ? "Working..." : "Report not spam"}
      </Button>
    </div>
  );
}
