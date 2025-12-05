import archiver from "archiver";
import { exec } from "child_process";
import fs from "fs";
import { getStorageProvider } from "@/lib/storage-factory";
import path from "path";

type BackupScope = "database" | "files" | "full";

export async function generateBackup(tenantId: string | null = "central", scope: BackupScope = "full") {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `backup-${scope}-${tenantId ?? "system"}-${timestamp}.zip`;
  
  // 1. Setup Local Staging Area (Temp)
  const stagingDir = path.join(process.cwd(), "storage", "temp");
  if (!fs.existsSync(stagingDir)) fs.mkdirSync(stagingDir, { recursive: true });
  const stagingPath = path.join(stagingDir, fileName);

  // 2. Parse Database Config
  const dbUrl = process.env.DATABASE_URL || "";
  const match = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  
  // 3. Start Archiving
  const output = fs.createWriteStream(stagingPath);
const archive = archiver("zip", { zlib: { level: 1 } });

  return new Promise<{ filename: string; path: string; size: number; isCloud: boolean }>((resolve, reject) => {
    
    output.on("close", async () => {
        const finalSize = archive.pointer();
        console.log(`[Backup] Zip created (${finalSize} bytes). Uploading...`);

        try {
            // ✅ FIX: Always use Central Admin (null) storage settings for backups
            // This ensures tenant backups go to the Admin's S3/Drive/Local folder
            const storage = await getStorageProvider(null); 
            
            console.log(`[Backup] Destination Provider: ${storage.name}`);

            // Upload
            const storedPath = await storage.upload(stagingPath, `backups/${fileName}`, "application/zip");
            console.log(`[Backup] Uploaded to: ${storedPath}`);

            // Cleanup Temp File
            try { fs.unlinkSync(stagingPath); } catch(e) {}

            resolve({
                filename: fileName,
                path: storedPath,
                size: finalSize,
                isCloud: storage.name !== "LOCAL"
            });

        } catch (e) {
            reject(e);
        }
    });

    archive.on("error", (err) => reject(err));
    archive.pipe(output);

    // --- ADD FILES ---
    if (scope === "files" || scope === "full") {
      const publicDir = path.join(process.cwd(), "public");
      if (fs.existsSync(publicDir)) {
        // Archive the whole public folder (uploads, etc)
        archive.directory(publicDir, "public"); 
      } else {
        archive.append("No public files found.", { name: "readme.txt" }); 
      }
    }

    // --- DUMP DB ---
    if (scope === "database" || scope === "full") {
      if (!match) {
        reject(new Error("Invalid Database URL"));
        return;
      }
      const [_, user, password, host, port, database] = match;
      
      // Windows Fix: Use .env path if available, else default
      const dumpTool = process.env.MYSQL_DUMP_PATH || 'mysqldump';
      const dumpCommand = `"${dumpTool}" -h ${host} -P ${port} -u ${user} -p"${password}" --single-transaction --quick --lock-tables=false ${database}`;

      exec(dumpCommand, { maxBuffer: 1024 * 1024 * 500 }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Database dump failed: ${stderr || error.message}`));
          return;
        }
        archive.append(stdout, { name: "database.sql" });
        archive.finalize(); 
      });
    } else {
      // Files only
      archive.finalize();
    }
  });
}