// app/(dashboard)/files/[folderId]/page.tsx

import {
  ChevronRight,
  Clock,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Music,
  Settings2,
  Share2,
  Star,
  Trash2,
  Video,
} from "lucide-react";

import { Breadcrumb } from "@/components/breadcrumb";
import { CreateFileButton } from "@/components/file-manager/create-file-button";
import { CreateFolderButton } from "@/components/file-manager/create-folder-button";
import { FileActionsMenu } from "@/components/file-manager/file-actions-menu";
import { FileDetailsPanel } from "@/components/file-manager/file-details-panel";
import { FileSearchInput } from "@/components/file-manager/file-search-input";
import { FolderActionsMenu } from "@/components/file-manager/folder-actions-menu";
import Link from "next/link";
import type React from "react";
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
  const viewParam = toSingle(rawSearchParams.view) as
    | "grid"
    | "list"
    | undefined;
  const view: "grid" | "list" = viewParam === "list" ? "list" : "grid";

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

  // Global stats for sidebar (same idea as /files)
  const allFilesForStats = await prisma.file.findMany({
    where: {
      tenantId: tenant.id,
      ownerId: user.id,
      deletedAt: null,
    },
    select: {
      size: true,
    },
  });

  let grandTotalBytes = 0;
  for (const f of allFilesForStats) {
    grandTotalBytes += f.size;
  }
  const totalFilesCount = allFilesForStats.length;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [favoritesCount, recycleBinCount, recentFilesCount] = await Promise.all(
    [
      prisma.file.count({
        where: {
          tenantId: tenant.id,
          ownerId: user.id,
          deletedAt: null,
          isFavorite: true,
        },
      }),
      prisma.file.count({
        where: {
          tenantId: tenant.id,
          ownerId: user.id,
          deletedAt: { not: null },
        },
      }),
      prisma.file.count({
        where: {
          tenantId: tenant.id,
          ownerId: user.id,
          deletedAt: null,
          updatedAt: { gte: thirtyDaysAgo },
        },
      }),
    ]
  );

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

  // Files in this folder (paginated, exclude trashed)
  const filesTotalCount = await prisma.file.count({
    where: {
      tenantId: tenant.id,
      ownerId: user.id,
      folderId: currentFolder.id,
      deletedAt: null,
    },
  });

  const files = await prisma.file.findMany({
    where: {
      tenantId: tenant.id,
      ownerId: user.id,
      folderId: currentFolder.id,
      deletedAt: null,
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

      <div
        className={[
          "grid gap-6",
          hasDetails
            ? "lg:[grid-template-columns:minmax(260px,280px)_minmax(0,2.7fr)_minmax(260px,320px)] xl:[grid-template-columns:minmax(260px,280px)_minmax(0,3.1fr)_minmax(260px,320px)]"
            : "lg:[grid-template-columns:minmax(260px,280px)_minmax(0,1fr)] xl:[grid-template-columns:minmax(260px,280px)_minmax(0,1fr)]",
        ].join(" ")}
      >
        {/* LEFT: same sidebar as /files */}
        <section className="rounded-2xl border bg-card/95 shadow-sm backdrop-blur">
          <header className="flex items-center justify-between border-b bg-gradient-to-r from-emerald-50/70 to-slate-50 px-5 py-4 dark:from-slate-900 dark:to-slate-950">
            <div>
              <h2 className="text-sm font-semibold">File Manager</h2>
              <p className="text-[11px] text-muted-foreground">
                Your central file navigation
              </p>
            </div>

            <Link
              href="/files?section=settings"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border bg-background text-[11px] text-muted-foreground shadow-sm transition hover:bg-accent hover:text-foreground"
              aria-label="Open file manager settings"
              title="File Manager Settings"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </Link>
          </header>

          <div className="space-y-4 px-5 py-4">
            {/* Search */}
            <FileSearchInput placeholder="Search files" />

            {/* Sections */}
            <nav className="space-y-1 text-xs">
              {/* We treat subfolder pages as part of "My Files" */}
              <SidebarItem
                href={`/files?view=${view}`}
                active={true}
                icon={<FolderOpen className="h-3.5 w-3.5" />}
              >
                My Files
                <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                  {totalFilesCount}
                </span>
              </SidebarItem>

              <SidebarItem
                href={`/files?section=favorites&view=${view}`}
                icon={<Star className="h-3.5 w-3.5" />}
              >
                Favourites
                <span className="ml-auto rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                  {favoritesCount}
                </span>
              </SidebarItem>

              <SidebarItem icon={<Share2 className="h-3.5 w-3.5" />}>
                Shared Files
              </SidebarItem>

              <SidebarItem
                href={`/files?section=recycle-bin&view=${view}`}
                icon={<Trash2 className="h-3.5 w-3.5" />}
              >
                Recycle Bin
                <span className="ml-auto rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600">
                  {recycleBinCount}
                </span>
              </SidebarItem>

              <SidebarItem
                href={`/files?section=recent&view=${view}`}
                icon={<Clock className="h-3.5 w-3.5" />}
              >
                Recent Files
                <span className="ml-auto rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-600">
                  {recentFilesCount}
                </span>
              </SidebarItem>
            </nav>

            {/* Storage summary */}
            <div className="space-y-2 rounded-xl bg-muted/60 p-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-muted-foreground">
                  Storage
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {totalFilesCount} file{totalFilesCount === 1 ? "" : "s"}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-background">
                <div className="h-full w-[20%] rounded-full bg-emerald-500" />
              </div>
              <p className="text-[10px] text-muted-foreground">
                {formatBytes(grandTotalBytes)} used
              </p>
            </div>

            {/* This folder quick stats inside sidebar */}
            <div className="space-y-2 rounded-xl bg-muted/40 p-3 text-[11px]">
              <p className="text-[11px] font-semibold text-muted-foreground">
                This Folder
              </p>
              <div className="space-y-1 rounded-lg bg-muted/60 px-3 py-2">
                <p className="font-semibold text-muted-foreground">
                  Subfolders
                </p>
                <p className="text-muted-foreground">
                  {subfolders.length} subfolder
                  {subfolders.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="space-y-1 rounded-lg bg-muted/60 px-3 py-2">
                <p className="font-semibold text-muted-foreground">Files</p>
                <p className="text-muted-foreground">
                  {filesTotalCount} file{filesTotalCount === 1 ? "" : "s"} in
                  this folder
                </p>
              </div>
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
                        href={`/files/${folder.id}?view=${view}`}
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
                    )}&view=${view}`}
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
                    )}&view=${view}`}
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
                        className="group flex items-center justify-between rounded-2xl border bg-muted/60 px-3 py-3 text-xs shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted overflow-hidden"
                      >
                        <Link
                          href={`/files/${currentFolder.id}?filesPage=${filesPage}&fileId=${file.id}&view=${view}`}
                          className="flex min-w-0 flex-1 items-center gap-3"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background">
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

                          <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                            <span className="truncate font-medium">
                              {file.name}
                            </span>

                            {!hasDetails && (
                              <span className="shrink-0 whitespace-nowrap text-[10px] text-muted-foreground">
                                {formatBytes(file.size)}
                              </span>
                            )}
                          </div>
                        </Link>

                        <div className="shrink-0 pl-2">
                          <FileActionsMenu
                            fileId={file.id}
                            fileName={file.name}
                            folderId={currentFolder.id}
                            isFavorite={file.isFavorite}
                            isTrashed={!!file.deletedAt}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT: File Details (only if a file is selected) */}
        {hasDetails ? (
          <section className="flex flex-col rounded-2xl border bg-card/95 shadow-sm backdrop-blur">
            <header className="flex items-center justify-between border-b bg-gradient-to-r from-slate-50 to-amber-50 px-5 py-4 dark:from-slate-950 dark:to-slate-900">
              <h2 className="text-sm font-semibold">File Details</h2>
              <FileActionsMenu
                fileId={selectedFile!.id}
                fileName={selectedFile!.name}
                folderId={selectedFile!.folderId}
                isFavorite={selectedFile!.isFavorite}
                isTrashed={!!selectedFile!.deletedAt}
              />
            </header>

            <FileDetailsPanel
              file={{
                id: selectedFile!.id,
                name: selectedFile!.name,
                url: selectedFile!.url,
                size: selectedFile!.size,
                mimeType: selectedFile!.mimeType,
                createdAt: selectedFile!.createdAt,
                folderId: selectedFile!.folderId,
              }}
              locationLabel={currentPath}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- Presentational helpers ---------- */

function SidebarItem({
  children,
  icon,
  active,
  href,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  active?: boolean;
  href?: string;
}) {
  const Comp: any = href ? Link : "button";

  return (
    <Comp
      href={href}
      className={[
        "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-medium",
        "transition-all duration-150",
        active
          ? "bg-emerald-50 text-emerald-700 shadow-sm"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      ].join(" ")}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-background text-xs shadow-sm">
        {icon}
      </span>
      <span className="flex flex-1 items-center gap-1 text-left">
        {children}
      </span>
    </Comp>
  );
}
