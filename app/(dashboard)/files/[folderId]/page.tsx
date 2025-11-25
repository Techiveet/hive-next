// app/(dashboard)/files/[folderId]/page.tsx

import {
  ChevronRight,
  Download,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Music,
  Video,
} from "lucide-react";

import { Breadcrumb } from "@/components/breadcrumb";
import { CreateFileButton } from "@/components/file-manager/create-file-button";
import { CreateFolderButton } from "@/components/file-manager/create-folder-button";
import { FileActionsMenu } from "@/components/file-manager/file-actions-menu";
import { FolderActionsMenu } from "@/components/file-manager/folder-actions-menu";
import Link from "next/link";
import { PdfModalViewer } from "@/components/file-manager/pdf-fullscreen-viewer";
import { getTenantAndUser } from "@/lib/get-tenant-and-user";
import { prisma } from "@/lib/prisma";

/* ---------- Helpers ---------- */

type ParamsPromise = Promise<{ folderId: string }>;
type SearchParams = Record<string, string | string[] | undefined>;

function toSingle(param: string | string[] | undefined): string | undefined {
  if (Array.isArray(param)) return param[0];
  return param;
}

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

function getPreviewType(
  mimeType: string
): "image" | "video" | "audio" | "pdf" | "text" | "none" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("text/")) return "text";
  return "none";
}

/* ---------- Page Component ---------- */

export default async function FolderPage(props: {
  params: ParamsPromise;
  searchParams: Promise<SearchParams>;
}) {
  const { folderId } = await props.params;
  const rawSearchParams = await props.searchParams;

  const fileIdParam = toSingle(rawSearchParams.fileId);
  const filesPageParam = toSingle(rawSearchParams.filesPage);

  const FILES_PAGE_SIZE = 9;
  const filesPage = Math.max(Number(filesPageParam || "1") || 1, 1);

  const { user, tenant } = await getTenantAndUser();

  // Ensure folder belongs to this tenant + user
  const currentFolder = await prisma.folder.findFirst({
    where: {
      id: folderId,
      tenantId: tenant.id,
      createdById: user.id,
    },
    include: {
      parent: true,
    },
  });

  if (!currentFolder) {
    return (
      <div className="p-6 text-sm text-red-500">
        Folder not found or you don&apos;t have access.
      </div>
    );
  }

  // Build breadcrumb for this folder (Root -> ... -> current)
  const breadcrumbFolders: { id: string; name: string }[] = [];
  let cur: any = currentFolder;

  while (cur) {
    breadcrumbFolders.unshift({ id: cur.id, name: cur.name });
    if (!cur.parentId) break;
    cur = await prisma.folder.findFirst({
      where: {
        id: cur.parentId,
        tenantId: tenant.id,
        createdById: user.id,
      },
      include: { parent: true },
    });
    if (!cur) break;
  }

  const currentPath =
    "Root / " + breadcrumbFolders.map((f) => f.name).join(" / ");

  // Subfolders
  const subfolders = await prisma.folder.findMany({
    where: {
      tenantId: tenant.id,
      createdById: user.id,
      parentId: currentFolder.id,
    },
    orderBy: { createdAt: "desc" },
  });

  // Files in this folder (paginated)
  const filesTotalCount = await prisma.file.count({
    where: {
      tenantId: tenant.id,
      ownerId: user.id,
      folderId: currentFolder.id,
    },
  });

  const files = await prisma.file.findMany({
    where: {
      tenantId: tenant.id,
      ownerId: user.id,
      folderId: currentFolder.id,
    },
    orderBy: { createdAt: "desc" },
    skip: (filesPage - 1) * FILES_PAGE_SIZE,
    take: FILES_PAGE_SIZE,
  });

  const filesTotalPages = Math.max(
    1,
    Math.ceil(filesTotalCount / FILES_PAGE_SIZE)
  );

  // Selected file for right details panel (if any)
  const selectedFile = fileIdParam
    ? await prisma.file.findFirst({
        where: {
          id: fileIdParam,
          tenantId: tenant.id,
          ownerId: user.id,
        },
      })
    : null;

  const hasDetails = !!selectedFile;

  return (
    <div className="px-4 py-4 lg:px-6 lg:py-6 xl:px-8">
      {/* Page heading + breadcrumb */}
      <div className="mb-5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumb />

          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FolderOpen className="h-3 w-3" />
            </span>
            <span className="font-medium">
              {user.email?.split("@")[0] ?? "You"}
            </span>
            <span className="h-1 w-1 rounded-full bg-emerald-500" />
            <span className="text-[10px] uppercase tracking-wide">
              {tenant.slug ?? "central"}
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
            <Link href="/files" className="hover:text-primary hover:underline">
              Root
            </Link>
            {breadcrumbFolders.map((f) => (
              <span key={f.id} className="inline-flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />
                {f.id === currentFolder.id ? (
                  <span className="font-semibold text-foreground">
                    {f.name}
                  </span>
                ) : (
                  <Link
                    href={`/files/${f.id}`}
                    className="hover:text-primary hover:underline"
                  >
                    {f.name}
                  </Link>
                )}
              </span>
            ))}
          </div>
          <h1 className="text-lg font-semibold tracking-tight">
            {currentFolder.name}
          </h1>
          <p className="text-xs text-muted-foreground">
            Manage subfolders and files inside this folder.
          </p>
        </div>
      </div>

      {/* 2 cols (no details) / 3 cols (with details) */}
      <div
        className={[
          "grid gap-6",
          hasDetails
            ? "lg:[grid-template-columns:minmax(260px,280px)_minmax(0,2.7fr)_minmax(260px,320px)] xl:[grid-template-columns:minmax(260px,280px)_minmax(0,3.1fr)_minmax(260px,320px)]"
            : "lg:[grid-template-columns:minmax(260px,280px)_minmax(0,1fr)] xl:[grid-template-columns:minmax(260px,280px)_minmax(0,1fr)]",
        ].join(" ")}
      >
        {/* LEFT: Folder stats */}
        <section className="rounded-2xl border bg-card/95 shadow-sm backdrop-blur">
          <header className="flex items-center justify-between border-b bg-gradient-to-r from-emerald-50/70 to-slate-50 px-5 py-4 dark:from-slate-900 dark:to-slate-950">
            <div>
              <h2 className="text-sm font-semibold">This Folder</h2>
              <p className="text-[11px] text-muted-foreground">{currentPath}</p>
            </div>

            <FolderActionsMenu
              folderId={currentFolder.id}
              folderName={currentFolder.name}
              triggerClassName="inline-flex h-8 w-8 items-center justify-center rounded-full border bg-background text-[11px] text-muted-foreground shadow-sm transition hover:bg-accent hover:text-foreground"
            />
          </header>

          <div className="space-y-3 px-5 py-4 text-[11px]">
            <div className="space-y-0.5 rounded-xl bg-muted/60 px-3 py-2">
              <p className="font-semibold text-muted-foreground">Subfolders</p>
              <p className="text-muted-foreground">
                {subfolders.length} subfolder
                {subfolders.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="space-y-0.5 rounded-xl bg-muted/60 px-3 py-2">
              <p className="font-semibold text-muted-foreground">Files</p>
              <p className="text-muted-foreground">
                {filesTotalCount} file{filesTotalCount === 1 ? "" : "s"} in this
                folder
              </p>
            </div>
          </div>
        </section>

        {/* MIDDLE: Subfolders + Files */}
        <section className="flex flex-col rounded-2xl border bg-card/95 shadow-sm backdrop-blur">
          <header className="flex items-center justify-between border-b bg-gradient-to-r from-slate-50 to-indigo-50 px-5 py-4 dark:from-slate-950 dark:to-slate-900">
            <div className="space-y-0.5">
              <h2 className="text-sm font-semibold">Contents</h2>
              <p className="text-[11px] text-muted-foreground">
                Subfolders and files inside &quot;{currentFolder.name}&quot;
              </p>
            </div>

            <div className="flex items-center gap-2">
              <CreateFolderButton parentId={currentFolder.id} />
              <CreateFileButton
                folderId={currentFolder.id}
                currentPath={currentPath}
              />
            </div>
          </header>

          <div className="flex-1 space-y-5 px-5 py-4">
            {/* Subfolders */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-muted-foreground">
                  Subfolders ({subfolders.length})
                </p>
              </div>

              {subfolders.length === 0 ? (
                <div className="flex min-h-[80px] items-center justify-center rounded-xl border border-dashed bg-muted/40 text-[11px] text-muted-foreground">
                  No subfolders yet.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {subfolders.map((folder) => (
                    <div
                      key={folder.id}
                      className="group flex items-center justify-between rounded-2xl border bg-muted/60 px-3 py-3 text-xs shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted"
                    >
                      <Link
                        href={`/files/${folder.id}`}
                        className="flex flex-1 items-center gap-3"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background">
                          <FolderOpen className="h-4 w-4 text-amber-500" />
                        </div>
                        <div className="flex flex-col">
                          <span className="max-w-[140px] truncate font-medium">
                            {folder.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Folder
                          </span>
                        </div>
                      </Link>

                      <FolderActionsMenu
                        folderId={folder.id}
                        folderName={folder.name}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Files in this folder (paginated) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-muted-foreground">
                  Files ({filesTotalCount})
                </p>

                <div className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Link
                    href={`/files/${currentFolder.id}?filesPage=${Math.max(
                      1,
                      filesPage - 1
                    )}`}
                    className={`rounded px-1.5 py-0.5 ${
                      filesPage <= 1
                        ? "pointer-events-none opacity-40"
                        : "hover:bg-muted"
                    }`}
                  >
                    Prev
                  </Link>
                  <span>
                    {filesPage}/{filesTotalPages}
                  </span>
                  <Link
                    href={`/files/${currentFolder.id}?filesPage=${Math.min(
                      filesTotalPages,
                      filesPage + 1
                    )}`}
                    className={`rounded px-1.5 py-0.5 ${
                      filesPage >= filesTotalPages
                        ? "pointer-events-none opacity-40"
                        : "hover:bg-muted"
                    }`}
                  >
                    Next
                  </Link>
                </div>
              </div>

              {files.length === 0 ? (
                <div className="flex min-h-[80px] items-center justify-center rounded-xl border border-dashed bg-muted/40 text-[11px] text-muted-foreground">
                  No files in this folder yet.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {files.map((file) => {
                    const type = getPreviewType(file.mimeType);
                    return (
                      <div
                        key={file.id}
                        className="group flex items-center justify-between rounded-2xl border bg-muted/60 px-3 py-3 text-xs shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted"
                      >
                        <Link
                          href={`/files/${currentFolder.id}?filesPage=${filesPage}&fileId=${file.id}`}
                          className="flex flex-1 items-center gap-3"
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background">
                            {type === "image" ? (
                              <ImageIcon className="h-4 w-4 text-violet-500" />
                            ) : type === "video" ? (
                              <Video className="h-4 w-4 text-sky-500" />
                            ) : type === "audio" ? (
                              <Music className="h-4 w-4 text-pink-500" />
                            ) : (
                              <FileText className="h-4 w-4 text-amber-500" />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="max-w-[150px] truncate font-medium">
                              {file.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatBytes(file.size)}
                            </span>
                          </div>
                        </Link>

                        <FileActionsMenu
                          fileId={file.id}
                          fileName={file.name}
                          folderId={currentFolder.id}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT: File Details (only if a file is selected) */}
        {selectedFile ? (
          <section className="flex flex-col rounded-2xl border bg-card/95 shadow-sm backdrop-blur">
            <header className="flex items-center justify-between border-b bg-gradient-to-r from-slate-50 to-amber-50 px-5 py-4 dark:from-slate-950 dark:to-slate-900">
              <h2 className="text-sm font-semibold">File Details</h2>
              <FileActionsMenu
                fileId={selectedFile.id}
                fileName={selectedFile.name}
                folderId={selectedFile.folderId}
              />
            </header>

            <div className="flex flex-1 flex-col gap-4 px-5 py-6 text-[11px]">
              <div className="flex items-center justify-center rounded-2xl bg-muted/60 p-3">
                <FilePreview
                  mimeType={selectedFile.mimeType}
                  url={selectedFile.url}
                  name={selectedFile.name}
                />
              </div>

              <div className="flex justify-end">
                <a
                  href={selectedFile.url}
                  download={selectedFile.name}
                  className="inline-flex items-center gap-1 rounded-full border bg-background px-3 py-1 text-[11px] font-medium shadow-sm hover:bg-muted"
                >
                  <Download className="h-3 w-3" />
                  Download
                </a>
              </div>

              <DetailRow label="File Name" value={selectedFile.name} />
              <DetailRow
                label="Size"
                value={formatBytes(selectedFile.size)}
              />
              <DetailRow
                label="MIME Type"
                value={selectedFile.mimeType || "Unknown"}
              />
              <DetailRow label="Location" value={currentPath} />
              <DetailRow
                label="Created At"
                value={selectedFile.createdAt.toISOString()}
              />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- Presentational helpers ---------- */

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5 rounded-lg bg-muted/40 px-3 py-2">
      <p className="text-[10px] font-semibold text-muted-foreground">{label}</p>
      <p className="text-[11px] break-words">{value}</p>
    </div>
  );
}

function FilePreview({
  mimeType,
  url,
  name,
}: {
  mimeType: string;
  url: string;
  name: string;
}) {
  const type = getPreviewType(mimeType);

  if (type === "image") {
    return (
      <img
        src={url}
        alt={name}
        className="max-h-48 max-w-full rounded-lg object-contain"
      />
    );
  }

  if (type === "video") {
    return (
      <video
        src={url}
        controls
        className="max-h-48 max-w-full rounded-lg bg-black"
      />
    );
  }

  if (type === "audio") {
    return (
      <audio src={url} controls className="w-full">
        Your browser does not support the audio element.
      </audio>
    );
  }

  // PDF → modal viewer with full-screen button inside
  if (type === "pdf") {
    return (
      <div className="flex flex-col items-center gap-2 text-[11px]">
        <p className="text-muted-foreground">
          This is a PDF file. Click below to view it.
        </p>
        <PdfModalViewer url={url} />
      </div>
    );
  }

  if (type === "text") {
    return (
      <iframe
        src={url}
        title={name}
        className="h-48 w-full rounded-lg border bg-background"
      />
    );
  }

  return (
    <div className="text-center text-[11px] text-muted-foreground">
      No inline preview available. Use the download button to open this file.
    </div>
  );
}
