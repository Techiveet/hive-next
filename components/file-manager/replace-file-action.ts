// components/file-manager/replace-file-action.ts
"use server";

import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * Server action to replace an existing file on disk with a new one.
 * Expects FormData with:
 *  - fileId: string
 *  - file: File
 */
export async function replaceFileAction(formData: FormData) {
  const fileId = formData.get("fileId");
  const file = formData.get("file");

  if (!fileId || typeof fileId !== "string") {
    throw new Error("Missing fileId");
  }

  if (!(file instanceof File)) {
    throw new Error("Missing or invalid file");
  }

  const dbFile = await prisma.file.findUnique({
    where: { id: fileId },
  });

  if (!dbFile) {
    throw new Error("File not found");
  }

  // --- Decide where on disk to save the edited file ------------------------

  let relativePath: string | null = null;

  // 1) If DB already has a normal URL (e.g. "/uploads/2025/01/foo.png"),
  //    reuse that location so we truly "replace" the file on disk.
  if (dbFile.url && !dbFile.url.startsWith("data:")) {
    try {
      // Handles absolute URLs and plain paths.
      const url = new URL(dbFile.url, "http://localhost");
      relativePath = url.pathname.replace(/^\/+/, ""); // remove leading slash
    } catch {
      // Fallback if url is not a valid URL string
      relativePath = dbFile.url.replace(/^\/+/, "");
    }
  }

  // 2) If url is empty or is a data URL (corrupted from old code),
  //    create a fresh path and later update dbFile.url to point to it.
  if (!relativePath) {
    const safeExt =
      file.type === "image/png"
        ? ".png"
        : file.type === "image/jpeg"
        ? ".jpg"
        : ".bin";

    relativePath = path.join(
      "uploads",
      "files",
      `${fileId}-${Date.now()}${safeExt}`
    );
  }

  const absolutePath = path.join(process.cwd(), "public", relativePath);

  // Ensure folder exists
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });

  // --- Write the new file ---------------------------------------------------

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absolutePath, buffer);

  // --- Update DB (keep same URL unless it was invalid/data URL) ------------

  const updateData: any = {
    size: buffer.length,
    mimeType: file.type || dbFile.mimeType,
  };

  if (!dbFile.url || dbFile.url.startsWith("data:")) {
    // Fix any old bad URLs by pointing to our new file
    updateData.url = "/" + relativePath.replace(/\\/g, "/");
  }

  await prisma.file.update({
    where: { id: fileId },
    data: updateData,
  });

  // Revalidate file listing page (adjust if your route differs)
  revalidatePath("/files");
}
