"use server";

import { getTenantAndUser } from "@/lib/get-tenant-and-user";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function saveEditedImageAction(formData: FormData) {
  const fileId = formData.get("fileId");

  if (!fileId || typeof fileId !== "string") {
    throw new Error("Missing fileId.");
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new Error("No edited file received.");
  }

  const { user, tenant } = await getTenantAndUser();

  // Make sure file belongs to this user + tenant
  const dbFile = await prisma.file.findFirst({
    where: {
      id: fileId,
      tenantId: tenant.id,
      ownerId: user.id,
    },
  });

  if (!dbFile) {
    throw new Error("File not found or you do not have permission.");
  }

  const mimeType = file.type || dbFile.mimeType || "image/png";

  const buffer = await file.arrayBuffer();
  const base64Content = Buffer.from(buffer).toString("base64");
  const fileUrl = `data:${mimeType};base64,${base64Content}`;

  await prisma.file.update({
    where: { id: dbFile.id },
    data: {
      url: fileUrl,
      size: file.size,
      mimeType,
    },
  });

  // Revalidate views
  revalidatePath("/files");
  if (dbFile.folderId) {
    revalidatePath(`/files/${dbFile.folderId}`);
  }
}
