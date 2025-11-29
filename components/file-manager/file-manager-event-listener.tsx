// components/file-manager/file-manager-event-listener.tsx
"use client";

import * as React from "react";

import { FilePickerDialog } from "./file-picker-dialog";

type FileRecord = {
  id: string;
  name: string;
  url: string;
  size?: number;
};

type OpenFileManagerDetail = {
  filter?: "images" | "all";
  onSelect?: (file: FileRecord) => void;
};

export function FileManagerEventListener() {
  const [open, setOpen] = React.useState(false);
  const [request, setRequest] = React.useState<OpenFileManagerDetail | null>(
    null
  );

  React.useEffect(() => {
    function handler(e: Event) {
      const custom = e as CustomEvent<OpenFileManagerDetail>;
      const detail = custom.detail;

      if (!detail) return;

      console.log("[FileManagerEventListener] open-file-manager", detail);

      setRequest(detail);
      setOpen(true);
    }

    window.addEventListener("open-file-manager", handler as EventListener);
    return () =>
      window.removeEventListener("open-file-manager", handler as EventListener);
  }, []);

  if (!open || !request) return null;

  return (
    <FilePickerDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setOpen(false);
          setRequest(null);
        } else {
          setOpen(true);
        }
      }}
      filter={request.filter ?? "images"}
      onSelect={(file) => {
        request.onSelect?.(file);
        setOpen(false);
        setRequest(null);
      }}
    />
  );
}
