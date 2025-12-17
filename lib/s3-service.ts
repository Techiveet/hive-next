import { DeleteObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Shared S3 Client Configuration
const s3Client = new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "",
    secretAccessKey: process.env.S3_SECRET_KEY || "",
  },
  forcePathStyle: true, // Required for MinIO/Spaces
});

const BUCKET = process.env.S3_BUCKET_NAME || "";

// 1. Generate a temporary download link (Presigned URL)
export async function getSignedDownloadUrl(fileName: string) {
  if (!BUCKET || !process.env.S3_ACCESS_KEY) return null;

  try {
    // Remove "s3://bucket-name/" prefix if it exists in the DB record
    // (The key in S3 is just "backups/filename.zip")
    const key = fileName.replace(/^s3:\/\/[^/]+\//, "");

    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    
    // URL is valid for 1 hour (3600 seconds)
    return await getSignedUrl(s3Client, command, { expiresIn: 3600 }); 
  } catch (e) {
    console.error("[S3] Sign URL failed:", e);
    return null;
  }
}

// 2. Delete Helper (Used by actions if needed)
export async function deleteFromS3(fileName: string) {
   if (!BUCKET) return;
   const key = fileName.replace(/^s3:\/\/[^/]+\//, "");
   try {
       await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
   } catch(e) {
       console.error("[S3] Delete error:", e);
   }
}