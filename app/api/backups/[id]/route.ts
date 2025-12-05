import { NextRequest, NextResponse } from "next/server";

import { Readable } from "stream";
import fs from "fs";
import { getCurrentSession } from "@/lib/auth-server";
import { getSignedDownloadUrl } from "@/lib/s3-service";
import { google } from "googleapis";
import path from "path";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Await params (Next.js 15 requirement)
    const { id } = await params;

    const { user } = await getCurrentSession();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    const backup = await prisma.backupHistory.findUnique({ where: { id } });
    if (!backup) return new NextResponse("Backup record not found", { status: 404 });

    // --- A. GOOGLE DRIVE DOWNLOAD ---
    if (backup.path.startsWith("gdrive://")) {
        const fileId = backup.path.replace("gdrive://", "");
        
        // Fetch credentials
        const settings = await prisma.storageSettings.findFirst({ where: { tenantId: backup.tenantId ?? null }});
        
        if (!settings?.gdriveJson) {
             return new NextResponse("Storage settings missing. Cannot access Drive.", { status: 500 });
        }

        const auth = new google.auth.GoogleAuth({
            credentials: JSON.parse(settings.gdriveJson),
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });
        const drive = google.drive({ version: 'v3', auth });

        try {
            // Get stream
            const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });

            // Convert Node Stream to Web Stream for Next.js Response
            const stream = new ReadableStream({
                start(controller) {
                    response.data.on('data', (chunk) => controller.enqueue(chunk));
                    response.data.on('end', () => controller.close());
                    response.data.on('error', (err) => controller.error(err));
                }
            });

            return new NextResponse(stream, {
                headers: {
                    "Content-Disposition": `attachment; filename="${backup.filename}"`,
                    "Content-Type": "application/zip",
                },
            });
        } catch (e) {
            console.error("[Download] Drive Error:", e);
            return new NextResponse("Failed to download from Google Drive", { status: 500 });
        }
    }

    // --- B. S3 DOWNLOAD ---
    if (backup.path.startsWith("s3://")) {
        const secureUrl = await getSignedDownloadUrl(backup.filename);
        if (!secureUrl) return new NextResponse("Cloud file unavailable", { status: 500 });
        return NextResponse.redirect(secureUrl);
    }

    // --- C. LOCAL DOWNLOAD ---
    // Resolve absolute path to be safe
    // If path starts with /uploads, prepend process.cwd() + public
    let absolutePath = backup.path;
    if (backup.path.startsWith("/uploads")) {
        absolutePath = path.join(process.cwd(), "public", backup.path);
    } else {
        absolutePath = path.resolve(backup.path);
    }

    if (!fs.existsSync(absolutePath)) {
      console.error(`[Download] File missing at: ${absolutePath}`);
      return new NextResponse("File missing on server disk", { status: 404 });
    }

    const fileBuffer = fs.readFileSync(absolutePath);
    const fileSize = fs.statSync(absolutePath).size;

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