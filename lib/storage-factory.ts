import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { Readable } from "stream";
import fs from "fs";
import { google } from "googleapis";
import path from "path";
import { prisma } from "@/lib/prisma";

// 1. Interface
export interface IStorageProvider {
  upload(file: Buffer | string, fileName: string, mimeType: string): Promise<string>;
  delete(identifier: string): Promise<void>;
  name: string; 
}

// 2. LOCAL PROVIDER (Windows Fixed)
class LocalProvider implements IStorageProvider {
  name = "LOCAL";

  // ✅ FIX: Added mimeType argument to match the interface signature (IStorageProvider)
  async upload(file: Buffer | string, fileName: string, mimeType: string): Promise<string> {
    const rootUploads = path.join(process.cwd(), "public", "uploads");
    const destination = path.join(rootUploads, fileName);
    
    // Ensure folder exists (Recursive for Windows)
    const destFolder = path.dirname(destination);
    if (!fs.existsSync(destFolder)) {
        try { fs.mkdirSync(destFolder, { recursive: true }); } catch (e) {}
    }

    if (typeof file === "string") {
      await fs.promises.copyFile(file, destination);
    } else {
      await fs.promises.writeFile(destination, file);
    }
    // Return web-friendly path
    return `/uploads/${fileName.replace(/\\/g, "/")}`; 
  }

  async delete(fileName: string): Promise<void> {
    const cleanName = fileName.replace(/^\/uploads\//, "");
    const filePath = path.join(process.cwd(), "public", "uploads", cleanName);
    try { await fs.promises.unlink(filePath); } catch (e) {}
  }
}

// 3. S3 PROVIDER
class S3Provider implements IStorageProvider {
  name = "S3";
  private client: S3Client;
  private bucket: string;

  constructor(config: any) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region || "us-east-1",
      endpoint: config.endpoint, 
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true, 
    });
  }

  async upload(file: Buffer | string, fileName: string, mimeType: string): Promise<string> {
    const body = typeof file === "string" ? fs.readFileSync(file) : file;
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket, Key: fileName, Body: body, ContentType: mimeType, ACL: "private", 
    }));
    return `s3://${this.bucket}/${fileName}`;
  }

  async delete(fileName: string): Promise<void> {
    const cleanKey = fileName.replace(/^s3:\/\/[^/]+\//, "");
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: cleanKey }));
  }
}

// 4. GOOGLE DRIVE PROVIDER (With Auto-Fallback)
class GoogleDriveProvider implements IStorageProvider {
  name = "GDRIVE";
  private drive;

  constructor(jsonKey: string) {
    try {
        const credentials = JSON.parse(jsonKey);
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/drive'],
        });
        this.drive = google.drive({ version: 'v3', auth });
    } catch (e) {
        throw new Error("Invalid Google Drive JSON");
    }
  }

  private async getFolderId(): Promise<string> {
    // Using your specific Shared Folder
    return "1vJT_kym02q_ldg6TjkSLX9NV3VTAdYQK";
  }

  async upload(file: Buffer | string, fileName: string, mimeType: string): Promise<string> {
    const parentId = await this.getFolderId();
    
    // Create stream
    const media = {
      mimeType,
      body: typeof file === "string" ? fs.createReadStream(file) : Readable.from(file),
    };

    const actualName = path.basename(fileName);

    try {
        console.log(`[GDrive] Uploading '${actualName}'...`);
        const res = await this.drive.files.create({
            requestBody: { name: actualName, parents: [parentId] },
            media: media,
            fields: 'id',
            supportsAllDrives: true, 
        });

        console.log(`[GDrive] Success! File ID: ${res.data.id}`);
        return `gdrive://${res.data.id}`;

    } catch (e: any) {
        // ✅ CRITICAL FIX: Catch Quota Errors and Fallback
        if (e.message.includes("quota") || e.code === 403) {
            console.error(`[GDrive] ⚠️ Quota Error (Personal Account Limitation).`);
            console.log(`[GDrive] ↪️ Falling back to LOCAL storage...`);
            
            // FIX: Call upload with the correct number of arguments (3)
            const local = new LocalProvider();
            return await local.upload(file, fileName, mimeType);
        }
        throw e; // Re-throw other errors (auth, etc)
    }
  }

  async delete(identifier: string): Promise<void> {
    // If it fell back to local, the path will start with /uploads
    if (identifier.startsWith("/uploads")) {
        const local = new LocalProvider();
        return await local.delete(identifier);
    }

    const fileId = identifier.replace("gdrive://", "");
    try {
        await this.drive.files.delete({ fileId, supportsAllDrives: true });
    } catch (e) { console.warn("[GDrive] Delete failed:", e); }
  }
}

// 5. FACTORY
export async function getStorageProvider(tenantId: string | null = null): Promise<IStorageProvider> {
  let searchId = tenantId;
  if (tenantId === "central" || tenantId === "central-hive") searchId = null;

  const settings = await prisma.storageSettings.findFirst({ where: { tenantId: searchId } });

  console.log(`[Storage Factory] Provider: ${settings?.provider || "LOCAL"}`);

  if (settings) {
    if (settings.provider === "GDRIVE" && settings.gdriveJson) {
        return new GoogleDriveProvider(settings.gdriveJson);
    }
    if (settings.provider !== "LOCAL" && settings.accessKeyId) {
        return new S3Provider(settings);
    }
  }

  if (process.env.S3_ACCESS_KEY) {
    return new S3Provider({
      bucket: process.env.S3_BUCKET_NAME,
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY,
      region: process.env.S3_REGION,
      endpoint: process.env.S3_ENDPOINT,
    });
  }

  return new LocalProvider();
}