// components/file-manager/folder-actions-menu.tsx
// components/file-manager/folder-actions-menu.tsx
"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Edit2, MoreHorizontal, Trash2 } from "lucide-react";
import { deleteFolderAction, renameFolderAction } from "./folder-actions";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showToast } from "@/lib/toast";

type FolderActionsMenuProps = {
  folderId: string;
  folderName: string;
  parentFolderId?: string | null;
  /** optional custom classes for the trigger button */
  triggerClassName?: string;
};

export function FolderActionsMenu({
  folderId,
  folderName,
  parentFolderId = null,
  triggerClassName,
}: FolderActionsMenuProps) {
  const [openRename, setOpenRename] = useState(false);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [newName, setNewName] = useState(folderName);
  const [isPending, startTransition] = useTransition();

  function handleRename(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      showToast({
        title: "Folder name required",
        description: "Please enter a folder name.",
        variant: "error",
      });
      return;
    }

    startTransition(async () => {
      try {
        await renameFolderAction(folderId, trimmed);
        setOpenRename(false);
        showToast({
          title: "Folder renamed",
          description: `Folder is now “${trimmed}”.`,
          variant: "success",
        });
      } catch (error) {
        console.error("[FolderActionsMenu] rename error", error);
        showToast({
          title: "Rename failed",
          description:
            error instanceof Error
              ? error.message
              : "We couldn't rename this folder.",
          variant: "error",
        });
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteFolderAction(folderId, parentFolderId ?? undefined);
        setOpenConfirm(false);
        showToast({
          title: "Folder deleted",
          description: `“${folderName}” was deleted successfully.`,
          variant: "success",
        });
      } catch (error) {
        console.error("[FolderActionsMenu] delete error", error);
        showToast({
          title: "Delete failed",
          description:
            error instanceof Error
              ? error.message
              : "We couldn't delete this folder.",
          variant: "error",
        });
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={
              triggerClassName ??
              "h-7 w-7 rounded-full border bg-background text-muted-foreground shadow-sm hover:bg-accent"
            }
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44 text-xs">
          <DropdownMenuItem onClick={() => setOpenRename(true)}>
            <Edit2 className="mr-2 h-3.5 w-3.5" />
            Rename folder
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setOpenConfirm(true)}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete folder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename Dialog */}
      <Dialog open={openRename} onOpenChange={setOpenRename}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
            <DialogDescription>
              Change the name of this folder. This will not move or delete any
              files.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRename} className="space-y-4">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={isPending}
              autoFocus
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenRename(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete AlertDialog */}
      <AlertDialog open={openConfirm} onOpenChange={setOpenConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this folder?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The folder{" "}
              <span className="font-medium text-foreground">
                “{folderName}”
              </span>{" "}
              will be removed. Any files or subfolders configured to depend on
              this folder may also be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
