// app/(dashboard)/files/page.tsx

import {
  Clock,
  Download,
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
import { FileSearchInput } from "@/components/file-manager/file-search-input";
import { FolderActionsMenu } from "@/components/file-manager/folder-actions-menu";
import Link from "next/link";
import { PdfModalViewer } from "@/components/file-manager/pdf-fullscreen-viewer";
import type React from "react";
import { getCurrentUserPermissions } from "@/lib/rbac";
import { getTenantAndUser } from "@/lib/get-tenant-and-user";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

/* ---------- Server action: update global file manager settings ---------- */

export async function updateFileManagerSettings(formData: FormData) {
  "use server";

  const { user } = await getTenantAndUser("/files?section=settings");

  const isCentralAdmin =
    (user as any)?.role === "CENTRAL_ADMIN" ||
    (user as any)?.isCentralAdmin === true;

  if (!isCentralAdmin) {
    throw new Error("Only central admin can update file manager settings.");
  }

  const maxFileSizeMb = Math.max(
    1,
    Number(formData.get("maxFileSizeMb") || "1")
  );

  const rawExtensions =
    (formData.get("allowedExtensions") as string | null) ?? "";
  const allowedExtensions = rawExtensions
    .split(",")
    .map((ext) => ext.trim())
    .filter(Boolean);

  const autoEmptyRecycleBinDays = Math.max(
    0,
    Number(formData.get("autoEmptyRecycleBinDays") || "0")
  );

  const requireDeleteConfirmation =
    formData.get("requireDeleteConfirmation") === "on";
  const allowPublicSharing = formData.get("allowPublicSharing") === "on";

  await prisma.fileManagerSettings.upsert({
    where: { id: "global" },
    update: {
      maxFileSizeMb,
      allowedExtensions,
      autoEmptyRecycleBinDays,
      requireDeleteConfirmation,
      allowPublicSharing,
    },
    create: {
      id: "global",
      maxFileSizeMb,
      allowedExtensions,
      autoEmptyRecycleBinDays,
      requireDeleteConfirmation,
      allowPublicSharing,
    },
  });

  revalidatePath("/files");
}

/* ---------- Helpers ---------- */

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

const DOC_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "text/html",
];

type FileCategoryKey = "images" | "videos" | "audio" | "docs" | "other";

function getFileCategory(mimeType: string): FileCategoryKey {
  if (mimeType.startsWith("image/")) return "images";
  if (mimeType.startsWith("video/")) return "videos";
  if (mimeType.startsWith("audio/")) return "audio";
  if (DOC_MIME_TYPES.includes(mimeType)) return "docs";
  return "other";
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

type FileFilterType = "images" | "videos" | "docs" | "audio";

type SectionType =
  | "my-files"
  | "favorites"
  | "recycle-bin"
  | "recent"
  | "settings";

type ViewType = "grid" | "list";

/* ---------- Page Component ---------- */

export default async function FilesPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const rawSearchParams = await props.searchParams;

  // Auth / tenant
  const { user, tenant } = await getTenantAndUser("/files");

  // RBAC permissions for this tenant context
  const userPermissions = await getCurrentUserPermissions(tenant.id);
  const canManageFiles = userPermissions.includes("manage_files");
  const canViewSettingsSection = userPermissions.includes(
    "manage_storage_settings"
  );

  // If user has no manage_files permission → no access to /files at all
  if (!canManageFiles) {
    redirect("/"); // URL won't work without manage_files
  }

  const fileIdParam = toSingle(rawSearchParams.fileId);
  const recentsPageParam = toSingle(rawSearchParams.recentsPage);
  const typeParam = toSingle(rawSearchParams.type) as
    | FileFilterType
    | undefined;

  const sectionParam = toSingle(
    rawSearchParams.section
  ) as SectionType | undefined;

  const viewParam = toSingle(rawSearchParams.view) as ViewType | undefined;

  // Coerce section based on permission: settings requires manage_storage_settings
  let section: SectionType = sectionParam ?? "my-files";
  if (section === "settings" && !canViewSettingsSection) {
    section = "my-files";
  }

  const view: ViewType = viewParam === "list" ? "list" : "grid";
  const isListView = view === "list";

  const searchQuery = (toSingle(rawSearchParams.q) ?? "").trim();
  const hasSearch = searchQuery.length > 0;

  const RECENTS_PAGE_SIZE = section === "recent" ? 12 : 6;
  const recentsPage = Math.max(Number(recentsPageParam || "1") || 1, 1);

  const isCentralAdmin =
    (user as any)?.role === "CENTRAL_ADMIN" ||
    (user as any)?.isCentralAdmin === true;

  // Root folders
  const rootFolders = await prisma.folder.findMany({
    where: {
      tenantId: tenant.id,
      createdById: user.id,
      parentId: null,
    },
    orderBy: { createdAt: "desc" },
  });

  // Stats (exclude trashed files)
  const allFilesForStats = await prisma.file.findMany({
    where: {
      tenantId: tenant.id,
      ownerId: user.id,
      deletedAt: null,
    },
    select: {
      size: true,
      mimeType: true,
    },
  });

  const totals: Record<FileCategoryKey, number> = {
    images: 0,
    videos: 0,
    audio: 0,
    docs: 0,
    other: 0,
  };

  let grandTotalBytes = 0;
  for (const f of allFilesForStats) {
    const cat = getFileCategory(f.mimeType);
    totals[cat] += f.size;
    grandTotalBytes += f.size;
  }

  const totalFilesCount = allFilesForStats.length;

  // Counters for sections
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [favoritesCount, recycleBinCount, recentFilesCount] =
    await Promise.all([
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
    ]);

  /* ---------- Global storage/settings from DB ---------- */

  const dbSettings = await prisma.fileManagerSettings.findUnique({
    where: { id: "global" },
  });

  const defaultExtensions = [
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".txt",
    ".csv",
    ".png",
    ".jpg",
    ".jpeg",
  ];

  const maxFileSizeMb = dbSettings?.maxFileSizeMb ?? 50;
  const allowedExtensions = dbSettings?.allowedExtensions?.length
    ? dbSettings.allowedExtensions
    : defaultExtensions;

  const autoEmptyRecycleBinDays = dbSettings?.autoEmptyRecycleBinDays ?? 30;
  const requireDeleteConfirmation =
    dbSettings?.requireDeleteConfirmation ?? true;
  const allowPublicSharing = dbSettings?.allowPublicSharing ?? false;

  /* ---------- Recents / filtered / section files ---------- */

  const recentsBaseWhere: any = {
    tenantId: tenant.id,
    ownerId: user.id,
  };

  // recycle bin vs active
  if (section === "recycle-bin") {
    recentsBaseWhere.deletedAt = { not: null };
  } else {
    recentsBaseWhere.deletedAt = null;
  }

  // favorites
  if (section === "favorites") {
    recentsBaseWhere.isFavorite = true;
  }

  // type filters
  if (typeParam === "images") {
    recentsBaseWhere.mimeType = { startsWith: "image/" };
  } else if (typeParam === "videos") {
    recentsBaseWhere.mimeType = { startsWith: "video/" };
  } else if (typeParam === "audio") {
    recentsBaseWhere.mimeType = { startsWith: "audio/" };
  } else if (typeParam === "docs") {
    recentsBaseWhere.mimeType = { in: DOC_MIME_TYPES };
  }

  // search
  if (hasSearch) {
    recentsBaseWhere.name = {
      contains: searchQuery,
    };
  }

  const recentsTotalCount = await prisma.file.count({
    where: recentsBaseWhere,
  });

  const recents = await prisma.file.findMany({
    where: recentsBaseWhere,
    orderBy:
      section === "recent"
        ? { updatedAt: "desc" }
        : { createdAt: "desc" },
    skip: (recentsPage - 1) * RECENTS_PAGE_SIZE,
    take: RECENTS_PAGE_SIZE,
  });

  const recentsTotalPages = Math.max(
    1,
    Math.ceil(recentsTotalCount / RECENTS_PAGE_SIZE)
  );

  // Selected file for right panel
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
  const rootPath = "Root";

  const typeQuery = typeParam ? `&type=${typeParam}` : "";
  const searchQueryPart = hasSearch
    ? `&q=${encodeURIComponent(searchQuery)}`
    : "";
  const sectionQueryPart =
    section && section !== "my-files" ? `&section=${section}` : "";
  const viewQueryPart = view === "list" ? `&view=list` : "";

  /* ---------- Render ---------- */

  return (
    <div className="px-4 py-4 lg:px-6 lg:py-6 xl:px-8">
      {/* Header */}
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
          <h1 className="text-lg font-semibold tracking-tight">File Manager</h1>
          <p className="text-xs text-muted-foreground">
            Organize files for{" "}
            <span className="font-medium">{tenant.name}</span>
          </p>
        </div>
      </div>

      {/* Layout grid: 2 cols (no detail) / 3 cols (with detail) */}
      <div
        className={[
          "grid gap-6",
          hasDetails
            ? "lg:[grid-template-columns:minmax(260px,280px)_minmax(0,2.7fr)_minmax(260px,320px)] xl:[grid-template-columns:minmax(260px,280px)_minmax(0,3.1fr)_minmax(260px,320px)]"
            : "lg:[grid-template-columns:minmax(260px,280px)_minmax(0,1fr)] xl:[grid-template-columns:minmax(260px,280px)_minmax(0,1fr)]",
        ].join(" ")}
      >
        {/* LEFT: Sidebar */}
        <section className="rounded-2xl border bg-card/95 shadow-sm backdrop-blur">
          <header className="flex items-center justify-between border-b bg-gradient-to-r from-emerald-50/70 to-slate-50 px-5 py-4 dark:from-slate-900 dark:to-slate-950">
            <div>
              <h2 className="text-sm font-semibold">File Manager</h2>
              <p className="text-[11px] text-muted-foreground">
                Your central file navigation
              </p>
            </div>

            <button className="inline-flex h-8 w-8 items-center justify-center rounded-full border bg-background text-[11px] text-muted-foreground shadow-sm transition hover:bg-accent hover:text-foreground">
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          </header>

          <div className="space-y-4 px-5 py-4">
            {/* Search (client component) */}
            <FileSearchInput placeholder="Search files" />

            {/* Sections */}
            <nav className="space-y-1 text-xs">
              <SidebarItem
                href={`/files?view=${view}`}
                active={section === "my-files"}
                icon={<FolderOpen className="h-3.5 w-3.5" />}
              >
                My Files
                <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                  {totalFilesCount}
                </span>
              </SidebarItem>

              <SidebarItem
                href={`/files?section=favorites&view=${view}`}
                active={section === "favorites"}
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
                active={section === "recycle-bin"}
                icon={<Trash2 className="h-3.5 w-3.5" />}
              >
                Recycle Bin
                <span className="ml-auto rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600">
                  {recycleBinCount}
                </span>
              </SidebarItem>

              <SidebarItem
                href={`/files?section=recent&view=${view}`}
                active={section === "recent"}
                icon={<Clock className="h-3.5 w-3.5" />}
              >
                Recent Files
                <span className="ml-auto rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-600">
                  {recentFilesCount}
                </span>
              </SidebarItem>

              {canViewSettingsSection && (
                <SidebarItem
                  href={`/files?section=settings&view=${view}`}
                  active={section === "settings"}
                  icon={<Settings2 className="h-3.5 w-3.5" />}
                >
                  Settings
                </SidebarItem>
              )}
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

            {/* Logout placeholder */}
            <button className="inline-flex w-full items-center justify-start gap-2 rounded-xl border bg-background px-3 py-2 text-[11px] font-medium text-muted-foreground shadow-sm transition hover:bg-destructive/5 hover:text-destructive">
              Logout
            </button>
          </div>
        </section>

        {/* MIDDLE: Folders + Files / Settings */}
        <section className="flex flex-col rounded-2xl border bg-card/95 shadow-sm backdrop-blur">
          <header className="flex items-center justify-between border-b bg-gradient-to-r from-slate-50 to-indigo-50 px-5 py-4 dark:from-slate-950 dark:to-slate-900">
            <div className="space-y-0.5">
              <h2 className="text-sm font-semibold">
                {section === "settings"
                  ? "File Manager Settings"
                  : "Folders & Files"}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {section === "settings"
                  ? "Customize how your file manager behaves."
                  : "Quick access to your top-level folders and latest files"}
              </p>
            </div>

            {section !== "settings" && (
              <div className="flex items-center gap-2">
                <CreateFolderButton />
                <CreateFileButton folderId={null} currentPath={rootPath} />
              </div>
            )}
          </header>

          <div className="flex-1 space-y-5 px-5 py-4">
            {section === "settings" ? (
              <SettingsPanel
                view={view}
                maxFileSizeMb={maxFileSizeMb}
                allowedExtensions={allowedExtensions}
                autoEmptyRecycleBinDays={autoEmptyRecycleBinDays}
                requireDeleteConfirmation={requireDeleteConfirmation}
                allowPublicSharing={allowPublicSharing}
                isCentralAdmin={isCentralAdmin}
              />
            ) : (
              <>
                {/* File types tiles */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      File Types
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      Total: {formatBytes(grandTotalBytes)}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <FileTile
                      icon={<ImageIcon className="h-4 w-4 text-violet-500" />}
                      label="Images"
                      size={formatBytes(totals.images)}
                      href={`/files?type=images&recentsPage=1${sectionQueryPart}${searchQueryPart}${viewQueryPart}`}
                      active={typeParam === "images"}
                    />
                    <FileTile
                      icon={<Video className="h-4 w-4 text-sky-500" />}
                      label="Videos"
                      size={formatBytes(totals.videos)}
                      href={`/files?type=videos&recentsPage=1${sectionQueryPart}${searchQueryPart}${viewQueryPart}`}
                      active={typeParam === "videos"}
                    />
                    <FileTile
                      icon={<FileText className="h-4 w-4 text-amber-500" />}
                      label="Docs"
                      size={formatBytes(totals.docs)}
                      href={`/files?type=docs&recentsPage=1${sectionQueryPart}${searchQueryPart}${viewQueryPart}`}
                      active={typeParam === "docs"}
                    />
                    <FileTile
                      icon={<Music className="h-4 w-4 text-pink-500" />}
                      label="Audio / Other"
                      size={formatBytes(totals.audio + totals.other)}
                      href={`/files?type=audio&recentsPage=1${sectionQueryPart}${searchQueryPart}${viewQueryPart}`}
                      active={typeParam === "audio"}
                    />
                  </div>
                </div>

                {/* Folders list */}
                {section !== "recycle-bin" && section !== "favorites" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        Folders ({rootFolders.length})
                      </p>
                      <Link
                        href={`/files?view=${view}`}
                        className="text-[10px] font-medium text-primary hover:underline"
                      >
                        View all
                      </Link>
                    </div>

                    {rootFolders.length === 0 ? (
                      <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed bg-muted/40 text-[11px] text-muted-foreground">
                        No folders yet. Use{" "}
                        <span className="mx-1 font-semibold text-primary">
                          Create Folder
                        </span>
                        to get started.
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {rootFolders.map((folder) => (
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
                )}

                {/* Recents / filtered files */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      {section === "favorites"
                        ? "Favourite Files"
                        : section === "recycle-bin"
                        ? "Recycle Bin"
                        : section === "recent"
                        ? "Recent Files"
                        : typeParam === "images"
                        ? "Images"
                        : typeParam === "videos"
                        ? "Videos"
                        : typeParam === "docs"
                        ? "Docs"
                        : typeParam === "audio"
                        ? "Audio Files"
                        : hasSearch
                        ? `Search results for "${searchQuery}"`
                        : "Recents"}
                    </p>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/files?recentsPage=1${sectionQueryPart}${typeQuery}${searchQueryPart}${viewQueryPart}`}
                        className="text-[10px] font-medium text-primary hover:underline"
                      >
                        View all
                      </Link>

                      <div className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Link
                          href={`/files?recentsPage=${Math.max(
                            1,
                            recentsPage - 1
                          )}${sectionQueryPart}${typeQuery}${searchQueryPart}${viewQueryPart}`}
                          className={`rounded px-1.5 py-0.5 ${
                            recentsPage <= 1
                              ? "pointer-events-none opacity-40"
                              : "hover:bg-muted"
                          }`}
                        >
                          Prev
                        </Link>
                        <span>
                          {recentsPage}/{recentsTotalPages}
                        </span>
                        <Link
                          href={`/files?recentsPage=${Math.min(
                            recentsTotalPages,
                            recentsPage + 1
                          )}${sectionQueryPart}${typeQuery}${searchQueryPart}${viewQueryPart}`}
                          className={`rounded px-1.5 py-0.5 ${
                            recentsPage >= recentsTotalPages
                              ? "pointer-events-none opacity-40"
                              : "hover:bg-muted"
                          }`}
                        >
                          Next
                        </Link>
                      </div>
                    </div>
                  </div>

                  {recents.length === 0 ? (
                    <div className="flex min-h-[80px] items-center justify-center rounded-xl border border-dashed bg-muted/40 text-[11px] text-muted-foreground">
                      No files found.
                    </div>
                  ) : isListView ? (
                    <div className="flex flex-col gap-2">
                      {recents.map((file) => {
                        const previewType = getPreviewType(file.mimeType);
                        return (
                          <div
                            key={file.id}
                            className="group flex items-center justify-between rounded-xl border bg-muted/60 px-3 py-2 text-xs shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted"
                          >
                            <Link
                              href={`/files?fileId=${file.id}&recentsPage=${recentsPage}${sectionQueryPart}${typeQuery}${searchQueryPart}${viewQueryPart}`}
                              className="flex flex-1 items-center gap-3"
                            >
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background">
                                {previewType === "image" ? (
                                  <ImageIcon className="h-4 w-4 text-violet-500" />
                                ) : previewType === "video" ? (
                                  <Video className="h-4 w-4 text-sky-500" />
                                ) : previewType === "audio" ? (
                                  <Music className="h-4 w-4 text-pink-500" />
                                ) : (
                                  <FileText className="h-4 w-4 text-amber-500" />
                                )}
                              </div>
                              <div className="flex flex-1 items-center justify-between gap-3">
                                <span className="truncate font-medium">
                                  {file.name}
                                </span>
                                <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                                  {formatBytes(file.size)}
                                </span>
                              </div>
                            </Link>

                            <FileActionsMenu
                              fileId={file.id}
                              fileName={file.name}
                              folderId={file.folderId}
                              isFavorite={file.isFavorite}
                              isTrashed={!!file.deletedAt}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {recents.map((file) => {
                        const previewType = getPreviewType(file.mimeType);
                        return (
                          <div
                            key={file.id}
                            className="group flex items-center justify-between rounded-2xl border bg-muted/60 px-3 py-3 text-xs shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted"
                          >
                            <Link
                              href={`/files?fileId=${file.id}&recentsPage=${recentsPage}${sectionQueryPart}${typeQuery}${searchQueryPart}${viewQueryPart}`}
                              className="flex flex-1 items-center gap-3"
                            >
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background">
                                {previewType === "image" ? (
                                  <ImageIcon className="h-4 w-4 text-violet-500" />
                                ) : previewType === "video" ? (
                                  <Video className="h-4 w-4 text-sky-500" />
                                ) : previewType === "audio" ? (
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
                              folderId={file.folderId}
                              isFavorite={file.isFavorite}
                              isTrashed={!!file.deletedAt}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        {/* RIGHT: File Details – only rendered when selectedFile exists */}
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

            <div className="flex flex-1 flex-col gap-4 px-5 py-6 text-[11px]">
              <div className="flex items-center justify-center rounded-2xl bg-muted/60 p-3">
                <FilePreview
                  mimeType={selectedFile!.mimeType}
                  url={selectedFile!.url}
                  name={selectedFile!.name}
                />
              </div>

              <div className="flex justify-end">
                <a
                  href={selectedFile!.url}
                  download={selectedFile!.name}
                  className="inline-flex items-center gap-1 rounded-full border bg-background px-3 py-1 text-[11px] font-medium shadow-sm hover:bg-muted"
                >
                  <Download className="h-3 w-3" />
                  Download
                </a>
              </div>

              <DetailRow label="File Name" value={selectedFile!.name} />
              <DetailRow
                label="Size"
                value={formatBytes(selectedFile!.size)}
              />
              <DetailRow
                label="MIME Type"
                value={selectedFile!.mimeType || "Unknown"}
              />
              <DetailRow
                label="Location"
                value={
                  selectedFile!.folderId
                    ? "Inside a folder (see middle column)"
                    : "Root"
                }
              />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- Presentational components ---------- */

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

function FileTile({
  icon,
  label,
  size,
  href,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  size: string;
  href: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-3 rounded-2xl px-3 py-3 text-xs shadow-sm transition hover:-translate-y-0.5",
        active
          ? "border border-primary/50 bg-primary/5"
          : "border bg-muted/60 hover:border-primary/40 hover:bg-muted",
      ].join(" ")}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background">
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-medium">{label}</span>
        <span className="text-[10px] text-muted-foreground">{size}</span>
      </div>
    </Link>
  );
}

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

function SettingsPanel({
  view,
  maxFileSizeMb,
  allowedExtensions,
  autoEmptyRecycleBinDays,
  requireDeleteConfirmation,
  allowPublicSharing,
  isCentralAdmin,
}: {
  view: "grid" | "list";
  maxFileSizeMb: number;
  allowedExtensions: string[];
  autoEmptyRecycleBinDays: number;
  requireDeleteConfirmation: boolean;
  allowPublicSharing: boolean;
  isCentralAdmin: boolean;
}) {
  const readonly = !isCentralAdmin;
  const allowedExtensionsCsv = allowedExtensions.join(", ");

  return (
    <form
      action={isCentralAdmin ? updateFileManagerSettings : undefined}
      className="space-y-4 text-[11px]"
    >
      {/* View options */}
      <div className="rounded-2xl border bg-muted/40 p-4">
        <h3 className="mb-2 text-xs font-semibold">View Options</h3>
        <p className="mb-3 text-[10px] text-muted-foreground">
          Choose how files are displayed by default in the Files page.
        </p>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/files?section=settings&view=grid"
            className={[
              "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] font-medium shadow-sm transition",
              view === "grid"
                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-transparent bg-background hover:border-muted",
            ].join(" ")}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Grid view
          </Link>

          <Link
            href="/files?section=settings&view=list"
            className={[
              "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] font-medium shadow-sm transition",
              view === "list"
                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-transparent bg-background hover:border-muted",
            ].join(" ")}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
            List view
          </Link>
        </div>

        <p className="mt-2 text-[10px] text-muted-foreground">
          This preference is currently applied via the <code>?view=</code>{" "}
          query. You can later persist this per-user in the database.
        </p>
      </div>

      {/* Storage / upload policy */}
      <div className="space-y-3 rounded-2xl border bg-muted/40 p-4">
        <h3 className="text-xs font-semibold">Storage Settings</h3>
        <p className="text-[10px] text-muted-foreground">
          Global upload restrictions applied to all tenants and users.
        </p>

        {/* Max file size */}
        <div className="space-y-1 rounded-xl bg-background px-3 py-2 text-[10px]">
          <label className="flex items-center justify-between gap-4">
            <span className="font-semibold text-muted-foreground">
              Max file size (MB)
            </span>
            <input
              type="number"
              min={1}
              name="maxFileSizeMb"
              defaultValue={maxFileSizeMb}
              disabled={readonly}
              className="h-7 w-20 rounded border bg-card px-2 text-right text-[10px] disabled:opacity-60"
            />
          </label>
          <p className="text-[10px] text-muted-foreground">
            Files larger than this will be rejected at upload time.
          </p>
        </div>

        {/* Allowed extensions */}
        <div className="space-y-1 rounded-xl bg-background px-3 py-2 text-[10px]">
          <p className="mb-1 font-semibold text-muted-foreground">
            Allowed file extensions
          </p>

          <div className="mb-2 flex flex-wrap gap-1.5">
            {allowedExtensions.map((ext) => (
              <span
                key={ext}
                className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px]"
              >
                {ext}
              </span>
            ))}
          </div>

          <input
            type="text"
            name="allowedExtensions"
            defaultValue={allowedExtensionsCsv}
            disabled={readonly}
            placeholder=".pdf, .docx, .xlsx, .png, .jpg"
            className="h-7 w-full rounded border bg-card px-2 text-[10px] disabled:opacity-60"
          />

          <p className="text-[10px] text-muted-foreground">
            Type extensions separated by commas. This behaves like a basic
            Select2: you can add/remove values and they will be parsed into
            tags. Apply this list in your upload validation.
          </p>
        </div>
      </div>

      {/* Other file manager behaviours */}
      <div className="space-y-3 rounded-2xl border bg-muted/40 p-4">
        <h3 className="text-xs font-semibold">Behaviour</h3>

        {/* Auto empty recycle bin */}
        <div className="space-y-1 rounded-xl bg-background px-3 py-2 text-[10px]">
          <label className="flex items-center justify-between gap-4">
            <span className="font-semibold text-muted-foreground">
              Auto-empty Recycle Bin after (days)
            </span>
            <input
              type="number"
              min={0}
              name="autoEmptyRecycleBinDays"
              defaultValue={autoEmptyRecycleBinDays}
              disabled={readonly}
              className="h-7 w-20 rounded border bg-card px-2 text-right text-[10px] disabled:opacity-60"
            />
          </label>
          <p className="text-[10px] text-muted-foreground">
            0 means keep files in Recycle Bin until manually purged. You can
            run a daily cron that deletes items older than this.
          </p>
        </div>

        {/* Require confirmation for permanent delete */}
        <div className="space-y-1 rounded-xl bg-background px-3 py-2 text-[10px]">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              name="requireDeleteConfirmation"
              defaultChecked={requireDeleteConfirmation}
              disabled={readonly}
              className="h-3 w-3 rounded border"
            />
            <span className="font-semibold text-muted-foreground">
              Require confirmation before permanent delete
            </span>
          </label>
          <p className="text-[10px] text-muted-foreground">
            When enabled, your file actions (e.g. permanent delete button) can
            show an AlertDialog before actually removing the file from the
            database.
          </p>
        </div>

        {/* Public sharing */}
        <div className="space-y-1 rounded-xl bg-background px-3 py-2 text-[10px]">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              name="allowPublicSharing"
              defaultChecked={allowPublicSharing}
              disabled={readonly}
              className="h-3 w-3 rounded border"
            />
            <span className="font-semibold text-muted-foreground">
              Allow public sharing links
            </span>
          </label>
          <p className="text-[10px] text-muted-foreground">
            If disabled, features like &quot;Get public link&quot; should be
            hidden or rejected on the server. You can use this as a global kill
            switch for external links.
          </p>
        </div>
      </div>

      {/* Submit / info */}
      {isCentralAdmin ? (
        <div className="flex items-center justify-between pt-1">
          <p className="text-[10px] text-muted-foreground">
            These settings are global and affect all tenants and users.
          </p>
          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-full border border-emerald-500 bg-emerald-500 px-3 py-1 text-[10px] font-medium text-white shadow-sm hover:bg-emerald-600"
          >
            Save Settings
          </button>
        </div>
      ) : (
        <p className="pt-1 text-[10px] text-muted-foreground">
          Only the central admin can change these limits. You&apos;re seeing the
          current configuration.
        </p>
      )}
    </form>
  );
}
