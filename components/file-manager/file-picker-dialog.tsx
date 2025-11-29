// components/file-manager/file-picker-dialog.tsx
"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

type FileRecord = {
  id: string;
  name: string;
  url: string;
  size: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filter?: "images" | "all";
  onSelect: (file: FileRecord) => void;
};

export function FilePickerDialog({
  open,
  onOpenChange,
  filter = "images",
  onSelect,
}: Props) {
  const [files, setFiles] = React.useState<FileRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (filter === "images") params.set("type", "images");

        const res = await fetch(
          `/api/file-manager/files?${params.toString()}`,
          { method: "GET" }
        );

        if (!res.ok) {
          throw new Error("Failed to load files");
        }

        const data = (await res.json()) as FileRecord[];
        setFiles(data);
      } catch (err: any) {
        console.error(err);
        setError(err?.message ?? "Failed to load files");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [open, filter]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Select a file</DialogTitle>
          <DialogDescription>
            {filter === "images"
              ? "Choose an image from your File Manager."
              : "Choose a file from your File Manager."}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          {loading && (
            <p className="text-xs text-muted-foreground">Loading files...</p>
          )}
          {error && (
            <p className="mb-2 text-xs text-destructive">{error}</p>
          )}

          {!loading && !error && (
            <ScrollArea className="h-72 rounded-md border bg-muted/40 p-2">
              {files.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  No files found.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {files.map((file) => (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => onSelect(file)}
                      className="group flex flex-col items-center gap-2 rounded-md border bg-background p-2 text-[11px] shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5"
                    >
                      <div className="flex h-20 w-full items-center justify-center overflow-hidden rounded-md bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={file.url}
                          alt={file.name}
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <span className="line-clamp-2 text-center">
                        {file.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          )}
        </div>

        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
