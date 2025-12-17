// components/email/email-top-toolbar.tsx
"use client";

import { Archive, Inbox, Trash2 } from "lucide-react";
import {
  archiveEmailsAction,
  deleteEmailsAction,
} from "@/app/(dashboard)/email/email-actions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/hooks/use-translation";

interface Props {
  emailId: string;
  currentFolder: string; // Pass this from the parent page
  isStarred: boolean;
}

export function EmailTopToolbar({ emailId, currentFolder, isStarred }: Props) {
  const router = useRouter();
  const { t } = useTranslation();

  const handleArchive = async () => {
    await archiveEmailsAction([emailId]);
    toast.success(t("email.toolbar.toast.archived", "Archived"));
    router.refresh();
  };

  const handleMoveToInbox = async () => {
    // TODO: replace with real action when ready (moveEmailToInboxAction)
    toast.info(t("email.toolbar.toast.movedToInbox", "Moved to Inbox"));
    router.refresh();
  };

  const handleDelete = async () => {
    await deleteEmailsAction([emailId], currentFolder);

    toast.success(
      currentFolder === "trash"
        ? t("email.toolbar.toast.deletedForever", "Deleted forever")
        : t("email.toolbar.toast.movedToTrash", "Moved to trash")
    );

    router.push("/email");
  };

  return (
    <div className="flex items-center justify-between border-b p-4">
      <div className="flex items-center gap-2">
        {/* STATUS INDICATORS */}
        {currentFolder === "archive" && (
          <Badge
            variant="secondary"
            className="bg-orange-100 text-orange-700 hover:bg-orange-100"
          >
            {t("email.toolbar.badge.archived", "Archived")}
          </Badge>
        )}

        {currentFolder === "trash" && (
          <Badge
            variant="destructive"
            className="bg-red-100 text-red-700 hover:bg-red-100"
          >
            {t("email.toolbar.badge.trashed", "Trashed")}
          </Badge>
        )}

        {isStarred && (
          <Badge
            variant="outline"
            className="border-amber-400 text-amber-500"
          >
            {t("email.toolbar.badge.starred", "Starred")}
          </Badge>
        )}
      </div>

      <div className="flex gap-1">
        {/* DYNAMIC BUTTONS BASED ON STATE */}

        {/* If in Archive, show 'Move to Inbox', else show 'Archive' */}
        {currentFolder === "archive" ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMoveToInbox}
            title={t("email.toolbar.action.moveToInbox", "Move to Inbox")}
          >
            <Inbox className="h-4 w-4 mr-2" />
            {t("email.toolbar.button.toInbox", "To Inbox")}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleArchive}
            disabled={currentFolder === "trash"}
            title={t("email.toolbar.action.archive", "Archive")}
          >
            <Archive className="h-4 w-4" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          className="text-red-500"
          title={
            currentFolder === "trash"
              ? t("email.toolbar.action.deleteForever", "Delete forever")
              : t("email.toolbar.action.moveToTrash", "Move to trash")
          }
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
