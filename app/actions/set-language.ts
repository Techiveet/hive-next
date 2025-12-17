"use server";

import { getCurrentSession } from "@/lib/auth-server";
import { getTenantAndUser } from "@/lib/get-tenant-and-user";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function setLanguageAction(locale: string) {
  const { user } = await getCurrentSession();
  if (!user) throw new Error("User not authenticated");

  const { tenant } = await getTenantAndUser();
  const tenantId = tenant?.id ?? null;

  // Update the setting in the database
  await prisma.appSettings.upsert({
    where: { tenantId },
    update: { locale },
    create: {
      tenantId,
      locale,
      timezone: "UTC",
    },
  });

  console.log(`[Action] Language set to ${locale} for tenant ${tenantId}`);

  // Force Next.js to re-render the entire app with new settings
  revalidatePath("/", "layout");
}