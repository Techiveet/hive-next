import { PrismaClient } from "@prisma/client";
import fs from "fs/promises";
import path from "path";

const prisma = new PrismaClient();

// Helper to get a pretty name from a code (e.g., "am" -> "Amharic")
function getLanguageName(code: string) {
  try {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
    return displayNames.of(code) || code.toUpperCase();
  } catch (e) {
    return code.toUpperCase();
  }
}

async function main() {
  const tenantSlug = "central-hive"; // Ensure this matches your Central Tenant Slug
  
  // 1. Get the Tenant
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  });

  if (!tenant) {
    console.error(`❌ Tenant '${tenantSlug}' not found. Please check your database.`);
    process.exit(1);
  }

  console.log(`Using Tenant: ${tenant.name} (${tenant.id})`);

  // 2. Scan the 'messages' directory
  const messagesDir = path.join(process.cwd(), "messages");
  
  try {
    await fs.access(messagesDir);
  } catch {
    console.error("❌ 'messages' directory not found.");
    process.exit(1);
  }

  const files = await fs.readdir(messagesDir);
  const jsonFiles = files.filter(file => file.endsWith(".json"));

  if (jsonFiles.length === 0) {
    console.log("⚠️ No JSON files found in /messages");
    return;
  }

  console.log(`Found ${jsonFiles.length} language file(s): ${jsonFiles.join(", ")}`);

  // 3. Loop through each file and sync
  for (const file of jsonFiles) {
    const code = path.parse(file).name; // "am.json" -> "am"
    const filePath = path.join(messagesDir, file);
    const content = await fs.readFile(filePath, "utf-8");
    
    let translations = {};
    try {
      translations = JSON.parse(content);
    } catch (e) {
      console.error(`❌ Failed to parse JSON in ${file}. Skipping.`);
      continue;
    }

    const keyCount = Object.keys(translations).length;
    const isDefault = code === "en"; // Assuming 'en' is always default
    const name = getLanguageName(code);

    console.log(`🔄 Syncing ${code.toUpperCase()} (${name}) - ${keyCount} keys...`);

    // Upsert to Database
    await prisma.language.upsert({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code: code,
        },
      },
      update: {
        translations: translations,
        // Don't overwrite name if it exists in DB, unless you want to force it
      },
      create: {
        tenantId: tenant.id,
        code: code,
        name: name,
        isDefault: isDefault,
        isEnabled: true,
        translations: translations,
      },
    });
  }

  console.log("✅ All languages synced successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });