"use server";

import { getTenantAndUser } from "@/lib/get-tenant-and-user";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ✅ 1. GET ALL JOBS
export async function getCronJobsAction() {
  const { tenant } = await getTenantAndUser();
  // Security: Only Central Admin
  if (tenant && tenant.slug !== "central-hive") throw new Error("Unauthorized");

  return await prisma.systemCron.findMany({
    orderBy: { key: 'asc' }
  });
}

// ✅ 2. TOGGLE JOB (Enable/Disable)
export async function toggleCronJobAction(id: string, enabled: boolean) {
  const { tenant } = await getTenantAndUser();
  if (tenant && tenant.slug !== "central-hive") throw new Error("Unauthorized");

  await prisma.systemCron.update({
    where: { id },
    data: { enabled }
  });

  revalidatePath("/settings");
}

// ✅ 3. RUN MANUALLY
export async function runCronJobManuallyAction(url: string) {
  const { tenant } = await getTenantAndUser();
  if (tenant && tenant.slug !== "central-hive") throw new Error("Unauthorized");

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const fullUrl = `${baseUrl}${url}`;
    
    console.log(`[Manual Trigger] Hitting: ${fullUrl}`);
    
    const res = await fetch(fullUrl, { cache: 'no-store' });
    const data = await res.json();
    
    revalidatePath("/settings");
    return data;
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

// ✅ 4. DELETE JOB
export async function deleteCronJobAction(id: string) {
  const { tenant } = await getTenantAndUser();
  if (tenant && tenant.slug !== "central-hive") throw new Error("Unauthorized");

  await prisma.systemCron.delete({
    where: { id }
  });

  revalidatePath("/settings");
}