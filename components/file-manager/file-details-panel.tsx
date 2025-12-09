// components/file-manager/file-details-panel.tsx
"use client";

import * as React from "react";

import { Download, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ImageEditorDialog } from "./image-editor-dialog";
import { replaceFileAction } from "./replace-file-action";
import { showToast } from "@/lib/toast";
import { useTransition } from "react";

type FileRecord = {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  createdAt?: string | Date;
  folderId?: string | null;
};

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let value = bytes;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

export function FileDetailsPanel({
  file,
  locationLabel,
}: {
  file: FileRecord;
  locationLabel: string;
}) {
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editorFile, setEditorFile] = React.useState<File | null>(null);
  const [loadingEditorFile, setLoadingEditorFile] = React.useState(false);

  const isImage = !!file.mimeType && file.mimeType.startsWith("image/");

  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const effectivePreviewUrl = previewUrl ?? file.url;

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleOpenEditor = async () => {
    if (!isImage) return;

    try {
      setLoadingEditorFile(true);

      if (editorFile) {
        setEditorOpen(true);
        return;
      }

      const response = await fetch(file.url);
      const blob = await response.blob();

      const f = new File([blob], file.name || "image", {
        type: blob.type || file.mimeType || "image/png",
      });

      setEditorFile(f);
      setEditorOpen(true);
    } catch (error) {
      console.error("[FileDetailsPanel] load editor file error", error);
      showToast({
        title: "Unable to open editor",
        description:
          "We couldn't load the image for editing. Please try again.",
        variant: "error",
      });
    } finally {
      setLoadingEditorFile(false);
    }
  };

  const handleSaveEditedFile = (editedFile: File | null) => {
    if (!editedFile) return;

    const localUrl = URL.createObjectURL(editedFile);
    setPreviewUrl(localUrl);
    setEditorFile(editedFile);

    const formData = new FormData();
    formData.append("fileId", file.id);
    formData.append("file", editedFile);

    startTransition(async () => {
      try {
        await replaceFileAction(formData);

        showToast({
          title: "Image updated",
          description: "The file image was replaced successfully.",
          variant: "success",
        });
      } catch (error) {
        console.error("[FileDetailsPanel] replace error", error);
        showToast({
          title: "Update failed",
          description:
            error instanceof Error
              ? error.message
              : "We couldn't update the image. Please try again.",
          variant: "error",
        });

        URL.revokeObjectURL(localUrl);
        setPreviewUrl(null);
      }
    });
  };

  return (
    <div className="flex flex-1 flex-col gap-4 px-5 py-6 text-[11px]">
      {/* Preview */}
      <div className="flex items-center justify-center rounded-2xl bg-muted/60 p-3">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={effectivePreviewUrl}
            alt={file.name}
            className="max-h-48 max-w-full rounded-lg object-contain"
          />
        ) : file.mimeType?.startsWith("video/") ? (
          <video
            src={file.url}
            controls
            className="max-h-48 max-w-full rounded-lg bg-black"
          />
        ) : file.mimeType?.startsWith("audio/") ? (
          <audio src={file.url} controls className="w-full">
            Your browser does not support the audio element.
          </audio>
        ) : (
          <div className="text-center text-[11px] text-muted-foreground">
            No inline preview available. Use the download button to open this
            file.
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2">
        <a
          href={file.url}
          download={file.name}
          className="inline-flex items-center gap-1 rounded-full border bg-background px-3 py-1 text-[11px] font-medium shadow-sm hover:bg-muted"
        >
          <Download className="h-3 w-3" />
          Download
        </a>

        {isImage && (
          <Button
            type="button"
            size="sm"
            disabled={isPending || loadingEditorFile}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px]"
            onClick={handleOpenEditor}
          >
            <Pencil className="h-3 w-3" />
            {loadingEditorFile ? "Opening..." : "Edit Image"}
          </Button>
        )}
      </div>

      {/* Details */}
      <div className="space-y-0.5 rounded-lg bg-muted/40 px-3 py-2">
        <p className="text-[10px] font-semibold text-muted-foreground">
          File Name
        </p>
        <p className="break-words text-[11px]">{file.name}</p>
      </div>

      <div className="space-y-0.5 rounded-lg bg-muted/40 px-3 py-2">
        <p className="text-[10px] font-semibold text-muted-foreground">
          Size
        </p>
        <p className="break-words text-[11px]">{formatBytes(file.size)}</p>
      </div>

      <div className="space-y-0.5 rounded-lg bg-muted/40 px-3 py-2">
        <p className="text-[10px] font-semibold text-muted-foreground">
          MIME Type
        </p>
        <p className="break-words text-[11px]">
          {file.mimeType || "Unknown"}
        </p>
      </div>

      <div className="space-y-0.5 rounded-lg bg-muted/40 px-3 py-2">
        <p className="text-[10px] font-semibold text-muted-foreground">
          Location
        </p>
        <p className="break-words text-[11px]">{locationLabel}</p>
      </div>

      {file.createdAt && (
        <div className="space-y-0.5 rounded-lg bg-muted/40 px-3 py-2">
          <p className="text-[10px] font-semibold text-muted-foreground">
            Created At
          </p>
          <p className="break-words text-[11px]">
            {new Date(file.createdAt).toLocaleString()}
          </p>
        </div>
      )}

      {/* Shared editor dialog */}
      {isImage && (
        <ImageEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          file={editorFile}
          onSave={handleSaveEditedFile}
        />
      )}
    </div>
  );
}
