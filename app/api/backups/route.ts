// app/api/backups/schedule/route.ts

import { NextRequest, NextResponse } from "next/server";

import { triggerBackupNow } from "@/lib/backup-scheduler";

// This should be called by a cron job service (like Vercel Cron, GitHub Actions, etc.)
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    console.log(`[API] Triggering scheduled backups via API`);
    await triggerBackupNow();
    return NextResponse.json({ 
      success: true, 
      message: "Scheduled backups completed" 
    });
  } catch (error: any) {
    console.error(`[API] Backup error:`, error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}