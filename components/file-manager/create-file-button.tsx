// components/file-manager/create-file-button.tsx
"use client";

import { Button } from "@/components/ui/button";
import { UploadCloud } from "lucide-react";
import { UploadFileDialog } from "./upload-file-dialog";
import { useState } from "react";

type CreateFileButtonProps = {
  folderId?: string | null;
  currentPath: string; // The display path string resolved on the server
};

export function CreateFileButton({
  folderId = null,
  currentPath,
}: CreateFileButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="sm"
      className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground shadow-sm transition hover:-translate-y-0.5 hover:bg-primary/90"
        onClick={() => setOpen(true)}
      >
        <UploadCloud className="h-3 w-3" />
        Create/Upload File
      </Button>

      <UploadFileDialog
        open={open}
        onOpenChange={setOpen}
        folderId={folderId}
        currentPath={currentPath}
      />
    </>
  );
}
