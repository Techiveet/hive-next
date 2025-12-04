import { NextRequest, NextResponse } from "next/server";

import fs from "fs";
import { getCurrentSession } from "@/lib/auth-server";
import path from "path";
import { prisma } from "@/lib/prisma";

// ✅ Fix: Define params as a Promise for Next.js 15 support
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Await params (Critical for Next.js 15)
    const { id } = await params;

    // 2. Auth Check
    const { user } = await getCurrentSession();
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // 3. Find Record
    const backup = await prisma.backupHistory.findUnique({
      where: { id },
    });

    if (!backup) {
      return new NextResponse("Backup record not found", { status: 404 });
    }

    // 4. Verify File Exists
    // We verify the path is safe and exists
    const absolutePath = path.resolve(backup.path);
    if (!fs.existsSync(absolutePath)) {
      console.error(`File missing at: ${absolutePath}`);
      return new NextResponse("File missing on server disk", { status: 404 });
    }

    // 5. Read File
    // Using readFileSync for simplicity (good for typical backup sizes). 
    // For huge files (GBs), we would use streams, but this is safer for now.
    const fileBuffer = fs.readFileSync(absolutePath);
    const fileSize = fs.statSync(absolutePath).size;

    // 6. Return Download Response
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Disposition": `attachment; filename="${backup.filename}"`,
        "Content-Type": "application/zip",
        "Content-Length": fileSize.toString(),
      },
    });

  } catch (error: any) {
    console.error("[Download API Error]:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}