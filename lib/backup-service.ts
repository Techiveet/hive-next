import archiver from "archiver";
import { exec } from "child_process";
import fs from "fs";
import path from "path";

// New type definition
type BackupScope = "database" | "files" | "full";

export async function generateBackup(tenantId: string | null = "central", scope: BackupScope = "full") {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `backup-${scope}-${tenantId}-${timestamp}.zip`;
  
  // Ensure we use the absolute path for storage to avoid Windows relative path issues
  const backupDir = path.join(process.cwd(), "storage", "backups");
  const outputPath = path.join(backupDir, fileName);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // Parse Database URL
  const dbUrl = process.env.DATABASE_URL || "";
  const match = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  
  // Create Output Stream
  const output = fs.createWriteStream(outputPath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  return new Promise<{ filename: string; path: string; size: number }>((resolve, reject) => {
    output.on("close", () => {
      resolve({
        filename: fileName,
        path: outputPath,
        size: archive.pointer(),
      });
    });

    archive.on("error", (err) => reject(err));
    archive.pipe(output);

    // --- 1. FILES BACKUP LOGIC ---
    if (scope === "files" || scope === "full") {
      // ✅ CHANGE: Point to the root 'public' directory
      const publicDir = path.join(process.cwd(), "public");
      const storageDir = path.join(process.cwd(), "storage", "uploads"); // Keep specific storage just in case

      let foundFiles = false;

      // Check and Archive ENTIRE Public Directory
      if (fs.existsSync(publicDir)) {
        console.log(`[Backup] Backing up entire public folder: ${publicDir}`);
        // The second argument "public" creates a folder inside the zip named "public"
        archive.directory(publicDir, "public"); 
        foundFiles = true;
      } 
      
      // Check external storage (if you use it)
      if (fs.existsSync(storageDir)) {
        console.log(`[Backup] Backing up storage folder: ${storageDir}`);
        archive.directory(storageDir, "storage_uploads");
        foundFiles = true;
      }

      if (!foundFiles) {
        console.warn(`[Backup] Warning: Public folder not found at ${publicDir}`);
        archive.append("No public folder found.", { name: "readme.txt" }); 
      }
    }

    // --- 2. DATABASE BACKUP LOGIC ---
    if (scope === "database" || scope === "full") {
      if (!match) {
        reject("Invalid Database URL");
        return;
      }
      const [_, user, password, host, port, database] = match;

      // WINDOWS FIX: Use Env Variable or default to 'mysqldump'
      const dumpTool = process.env.MYSQL_DUMP_PATH || 'mysqldump';
      
      const dumpCommand = `"${dumpTool}" -h ${host} -P ${port} -u ${user} -p"${password}" --single-transaction --quick --lock-tables=false ${database}`;

      console.log(`[Backup] Dumping DB with: ${dumpTool}`);

      exec(dumpCommand, { maxBuffer: 1024 * 1024 * 500 }, (error, stdout, stderr) => {
        if (error) {
          console.error("Dump Error:", stderr);
          reject(`Database dump failed: ${stderr || error.message}`);
          return;
        }
        archive.append(stdout, { name: "database.sql" });
        archive.finalize(); 
      });
    } else {
      // If Files ONLY, finalize immediately
      archive.finalize();
    }
  });
}