// components/file-manager/file-actions-menu.tsx
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, Star, Trash2, Undo2, XCircle } from "lucide-react";
import {
  deleteFilePermanently,
  moveToTrash,
  restoreFromTrash,
  toggleFavorite,
} from "@/app/(dashboard)/files/actions";

import { useTransition } from "react";

export function FileActionsMenu({
  fileId,
  fileName,
  folderId,
  isFavorite,
  isTrashed,
  path = "/files",
}: {
  fileId: string;
  fileName: string;
  folderId?: string | null;
  isFavorite?: boolean;
  isTrashed?: boolean;
  path?: string; // current route for revalidatePath
}) {
  const [isPending, startTransition] = useTransition();

 const handleFavorite = () => {
    // If you intend to use path for revalidation, you must update the server action signature first.
    // For now, assuming the error is correct:
    startTransition(() => toggleFavorite(fileId)); 
  };

 const handleTrash = () => {
    // Check if these also need fixing based on their definitions
    startTransition(() => moveToTrash(fileId)); 
  };

  const handleRestore = () => {
    startTransition(() => restoreFromTrash(fileId));
  };

  const handleDeleteForever = () => {
    startTransition(() => deleteFilePermanently(fileId));
  };``

  return (
    <div className="flex items-center gap-1">
      {/* Favourite toggle */}
      {!isTrashed && (
        <button
          type="button"
          onClick={handleFavorite}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border bg-background text-xs text-muted-foreground hover:bg-amber-50 hover:text-amber-500"
          disabled={isPending}
          title={isFavorite ? "Remove from favourites" : "Add to favourites"}
        >
          <Star
            className={`h-3.5 w-3.5 ${
              isFavorite ? "fill-amber-400 text-amber-500" : ""
            }`}
          />
        </button>
      )}

      {/* Trash / restore / delete forever */}
      {!isTrashed ? (
        <button
          type="button"
          onClick={handleTrash}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border bg-background text-xs text-muted-foreground hover:bg-red-50 hover:text-red-500"
          disabled={isPending}
          title="Move to Recycle Bin"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={handleRestore}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border bg-background text-xs text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600"
            disabled={isPending}
            title="Restore from Recycle Bin"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>

          {/* AlertDialog for permanent delete */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border bg-background text-xs text-muted-foreground hover:bg-red-100 hover:text-red-600"
                disabled={isPending}
                title="Delete permanently"
              >
                <XCircle className="h-3.5 w-3.5" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Delete “{fileName}” permanently?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. The file will be removed
                  permanently from the system.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteForever}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  Delete permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
