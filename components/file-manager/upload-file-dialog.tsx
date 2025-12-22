// components/file-manager/upload-file-dialog.tsx
"use client";

import "filepond/dist/filepond.min.css";
import "filepond-plugin-image-preview/dist/filepond-plugin-image-preview.css";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FilePond, registerPlugin } from "react-filepond";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import FilePondPluginImagePreview from "filepond-plugin-image-preview";
import { ImageEditorDialog } from "./image-editor-dialog";
import { Input } from "@/components/ui/input";
import { UploadCloud } from "lucide-react";
import { showToast } from "@/lib/toast";
import { uploadFileAction } from "./upload-file-action";
import { useOffline } from "@/lib/offline/use-offline";

// Register FilePond plugins
registerPlugin(FilePondPluginImagePreview);

type UploadFileDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId?: string | null;
  currentPath: string;
};

export function UploadFileDialog({
  open,
  onOpenChange,
  folderId,
  currentPath,
}: UploadFileDialogProps) {
  const [isPending, startTransition] = useTransition();

  const [fileToUpload, setFileToUpload] = useState<File[]>([]);
  const [baseName, setBaseName] = useState("");

  const { isOnline, storeOfflineAction } = useOffline();

  // Image editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [imageFileForEdit, setImageFileForEdit] = useState<File | null>(null);
  const [isEdited, setIsEdited] = useState(false);

  const selectedFile = fileToUpload[0] ?? null;
  const selectedIsImage = !!selectedFile?.type?.startsWith("image/");

  function resetAndClose() {
    setFileToUpload([]);
    setBaseName("");
    setImageFileForEdit(null);
    setIsEdited(false);
    onOpenChange(false);
  }

  function buildFormData(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    if (baseName?.trim()) {
      formData.append("baseName", baseName.trim());
    }

    if (folderId) {
      formData.append("folderId", folderId);
    }

    return formData;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!selectedFile) {
      showToast({
        title: "No file selected",
        description: "Please select a file to upload.",
        variant: "error",
      });
      return;
    }

    startTransition(async () => {
      try {
        const formData = buildFormData(selectedFile);
        const displayName = baseName?.trim() || selectedFile.name;

        // ✅ OFFLINE: queue the REAL FormData (includes file bytes)
        if (!isOnline) {
          // IMPORTANT: don't set Content-Type for FormData
          await storeOfflineAction("/api/file-manager/files", "POST", {}, formData);

          resetAndClose();

          showToast({
            title: "File Queued for Upload",
            description: `‘${displayName}’ will be uploaded when you're back online.`,
            variant: "success",
          });
          return;
        }

        // ✅ ONLINE: normal upload
        await uploadFileAction(formData);

        resetAndClose();

        showToast({
          title: "File Uploaded",
          description: `‘${displayName}’ uploaded successfully to ${currentPath}.`,
          variant: "success",
        });
      } catch (error) {
        console.error("[UploadFileDialog] error", error);

        showToast({
          title: "Upload Failed",
          description:
            error instanceof Error
              ? error.message
              : "We couldn't upload the file. Please try again.",
          variant: "error",
        });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md md:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UploadCloud className="h-5 w-5" /> Upload File(s)
          </DialogTitle>
          <DialogDescription>
            Select a file to upload to the current directory. If you're offline,
            it will be queued and synced automatically when you're back online.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Save in Folder */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">
              Save in Folder
            </label>
            <Input
              value={currentPath}
              readOnly
              className="cursor-default bg-muted/50 text-xs"
            />
          </div>

          {/* Base Name Input */}
          <div>
            <label
              htmlFor="baseName"
              className="mb-1 block text-xs font-semibold text-muted-foreground"
            >
              Base Name (optional, no extension)
            </label>
            <Input
              id="baseName"
              placeholder="e.g., Invoice-2025-Q3"
              value={baseName}
              onChange={(e) => setBaseName(e.target.value)}
              disabled={isPending}
              className="text-xs"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Leave blank to keep the original filename. If provided, the file
              will be renamed automatically.
            </p>
          </div>

          {/* FilePond Area */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">
              Select Files
            </label>

            <FilePond
              files={fileToUpload}
              onupdatefiles={(fileItems) => {
                const nextFiles = fileItems.map(
                  (fileItem) => fileItem.file as File
                );

                setFileToUpload(nextFiles);
                setIsEdited(false);

                const first = nextFiles[0];
                if (first && first.type.startsWith("image/")) {
                  setImageFileForEdit(first);
                } else {
                  setImageFileForEdit(null);
                }
              }}
              allowMultiple={false}
              maxFiles={1}
              server={null}
              name="file"
              labelIdle='Drag & Drop your file or <span class="filepond--label-action"> Browse </span>'
              disabled={isPending}
              className="text-sm"
            />

            <p className="mt-2 px-1 text-[10px] text-muted-foreground">
              Allowed formats: images, documents, archives, audio, video, source
              files, and more.
            </p>

            {/* Edit image button */}
            {selectedIsImage && imageFileForEdit && (
              <div className="mt-3 flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditorOpen(true)}
                  disabled={isPending}
                >
                  Edit image (crop &amp; rotate)
                </Button>

                {isEdited && (
                  <span className="text-[10px] font-medium text-emerald-600">
                    Edited
                  </span>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="px-6"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={isPending || fileToUpload.length === 0}
              className="bg-purple-600 px-6 text-white shadow-md hover:bg-purple-700"
            >
              {isPending ? "Working..." : isOnline ? "Upload" : "Queue Upload"}
            </Button>
          </DialogFooter>
        </form>

        {/* Shared image editor dialog */}
        <ImageEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          file={imageFileForEdit}
          onSave={(editedFile) => {
            if (!editedFile) return;

            // ✅ editedFile becomes the actual file that will be uploaded/queued
            setFileToUpload([editedFile]);
            setImageFileForEdit(editedFile);
            setIsEdited(true);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
