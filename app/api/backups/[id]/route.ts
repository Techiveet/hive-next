import { NextRequest, NextResponse } from "next/server";

import fs from "fs";
import { getCurrentSession } from "@/lib/auth-server";
import { getSignedDownloadUrl } from "@/lib/s3-service";
import { google } from "googleapis"; // ✅ Import Google
import path from "path";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user } = await getCurrentSession();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    const backup = await prisma.backupHistory.findUnique({ where: { id } });
    if (!backup) return new NextResponse("Not Found", { status: 404 });

    // --- 1. GOOGLE DRIVE DOWNLOAD ---
    if (backup.path.startsWith("gdrive://")) {
        const fileId = backup.path.replace("gdrive://", "");
        
        // Fetch credentials from DB to auth
        const settings = await prisma.storageSettings.findFirst({ where: { tenantId: backup.tenantId ?? null }});
        
        if (!settings?.gdriveJson) return new NextResponse("Drive Creds Missing", { status: 500 });

        const auth = new google.auth.GoogleAuth({
            credentials: JSON.parse(settings.gdriveJson),
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });
        const drive = google.drive({ version: 'v3', auth });

        // Get file stream from Google
        const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });

        // Pipe to response
        // Note: Next.js NextResponse with streams can be tricky.
        // We iterate the node stream to a web readable stream.
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
    }

    // --- 2. S3 DOWNLOAD ---
    if (backup.path.startsWith("s3://")) {
        const secureUrl = await getSignedDownloadUrl(backup.filename);
        if (!secureUrl) return new NextResponse("Cloud file unavailable", { status: 500 });
        return NextResponse.redirect(secureUrl);
    }

    // --- 3. LOCAL DOWNLOAD ---
    const absolutePath = path.resolve(backup.path);
    if (!fs.existsSync(absolutePath)) {
      return new NextResponse("File missing", { status: 404 });
    }
    const fileBuffer = fs.readFileSync(absolutePath);
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Disposition": `attachment; filename="${backup.filename}"`,
        "Content-Type": "application/zip",
      },
    });

  } catch (error: any) {
    console.error(error);
    return new NextResponse("Error", { status: 500 });
  }
}