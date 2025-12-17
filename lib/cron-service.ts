import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type CronResult = {
  success: boolean;
  message: string;
};

export async function runCronJob(
  key: string, 
  handler: () => Promise<CronResult>
) {
  // 1. Fetch Job Config
  const job = await prisma.systemCron.findUnique({ where: { key } });

  // Auto-register if missing
  if (!job) {
    await prisma.systemCron.create({
      data: {
        key,
        name: key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        url: `/api/cron/${key}`, // Matches key now
        schedule: "Manual / External",
      }
    });
  } else if (!job.enabled) {
    return NextResponse.json({ message: "Job is disabled in settings." }, { status: 200 });
  }
  
  try {
    console.log(`[Cron] Starting job: ${key}`);
    const result = await handler();

    await prisma.systemCron.update({
      where: { key },
      data: {
        lastRunAt: new Date(),
        lastStatus: result.success ? "SUCCESS" : "FAILED",
        lastMessage: result.message,
      }
    });

    return NextResponse.json(result);

  } catch (error: any) {
    console.error(`[Cron] Job ${key} Failed:`, error);
    
    // ✅ FIX: Handle both Error objects and Strings
    const errorMessage = error instanceof Error ? error.message : String(error);

    await prisma.systemCron.update({
      where: { key },
      data: {
        lastRunAt: new Date(),
        lastStatus: "FAILED",
        lastMessage: errorMessage,
      }
    });

    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}