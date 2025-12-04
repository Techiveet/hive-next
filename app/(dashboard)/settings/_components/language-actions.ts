"use server";

import fs from "fs/promises";
import { getCurrentSession } from "@/lib/auth-server";
import { getTenantAndUser } from "@/lib/get-tenant-and-user";
import path from "path";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// --- HELPER: Write to File ---
async function writeLanguageFile(code: string, translations: any) {
  try {
    // Use process.cwd() to find the root directory
    const dirPath = path.join(process.cwd(), "messages");
    
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }

    const filePath = path.join(dirPath, `${code}.json`);
    
    // Sort keys
    const sorted = Object.keys(translations).sort().reduce((acc: any, key) => {
      acc[key] = translations[key];
      return acc;
    }, {});

    await fs.writeFile(filePath, JSON.stringify(sorted, null, 2));
    console.log(`✅ Wrote to messages/${code}.json`);
  } catch (error) {
    console.error("Publish file error:", error);
  }
}

// 1. CREATE LANGUAGE
export async function createLanguageAction(code: string, name: string) {
  const { tenant } = await getTenantAndUser();
  if (!tenant) throw new Error("Tenant required");

  const existing = await prisma.language.findFirst({
    where: { tenantId: tenant.id, code },
  });

  if (existing) throw new Error("Language code already exists");

  // If 'en' is created, make it default automatically
  const isDefault = code === "en";

  await prisma.language.create({
    data: {
      tenantId: tenant.id,
      code,
      name,
      translations: {},
      isDefault,
      isEnabled: true,
    },
  });

  // Initialize file
  await writeLanguageFile(code, {});

  revalidatePath("/settings");
}

// 2. ADD MASTER KEY (To Source/Default Language)
export async function addMasterKeyAction(group: string, key: string, value: string) {
  const { tenant } = await getTenantAndUser();
  if (!tenant) throw new Error("Unauthorized");

  // Find Default Language
  let sourceLang = await prisma.language.findFirst({
    where: { tenantId: tenant.id, isDefault: true },
  });

  if (!sourceLang) {
    sourceLang = await prisma.language.findFirst({
      where: { tenantId: tenant.id, code: "en" },
    });
  }

  if (!sourceLang) {
    // Auto-create English
    sourceLang = await prisma.language.create({
      data: {
        tenantId: tenant.id,
        code: "en",
        name: "English",
        isDefault: true,
        translations: {},
      },
    });
  }

  const finalKey = group?.trim() ? `${group.trim()}.${key.trim()}` : key.trim();
  
  const currentTranslations = (sourceLang.translations as Record<string, string>) || {};
  const updated = { ...currentTranslations, [finalKey]: value };

  await prisma.language.update({
    where: { id: sourceLang.id },
    data: { translations: updated },
  });

  await writeLanguageFile(sourceLang.code, updated);

  revalidatePath("/settings");
  revalidatePath("/", "layout"); 
}

// 3. UPDATE TRANSLATIONS
export async function updateTranslationAction(
  languageId: string,
  translations: Record<string, string>
) {
  const { tenant } = await getTenantAndUser();
  if (!tenant) throw new Error("Unauthorized");

  const lang = await prisma.language.findUnique({ where: { id: languageId } });
  if (!lang) throw new Error("Language not found");

  const current = (lang.translations as Record<string, string>) || {};
  const updated = { ...current, ...translations };

  await prisma.language.update({
    where: { id: languageId },
    data: { translations: updated },
  });

  await writeLanguageFile(lang.code, updated);

  revalidatePath("/settings");
  revalidatePath("/", "layout");
}

// 4. PUBLISH ALL (The missing export from your error logs)
export async function publishAllLanguagesAction () {
  const { tenant } = await getTenantAndUser();
  if (!tenant) throw new Error("Unauthorized");

  const languages = await prisma.language.findMany({
    where: { tenantId: tenant.id },
  });

  let count = 0;
  for (const lang of languages) {
    await writeLanguageFile(lang.code, lang.translations);
    count++;
  }

  revalidatePath("/"); 
  return { count };
}



// 5. DELETE LANGUAGE
export async function deleteLanguageAction(languageId: string) {
  const { tenant } = await getTenantAndUser();
  if (!tenant) throw new Error("Unauthorized");

  await prisma.language.delete({
    where: { id: languageId, tenantId: tenant.id },
  });

  revalidatePath("/settings");
}

// 6. SET DEFAULT LANGUAGE
export async function setLanguageAsDefaultAction(languageId: string) {
  const { tenant } = await getTenantAndUser();
  if (!tenant) throw new Error("Unauthorized");

  // Use a transaction to ensure only one language is default at a time
  await prisma.$transaction([
    // 1. Unset ANY existing default for this tenant
    prisma.language.updateMany({
      where: { tenantId: tenant.id, isDefault: true },
      data: { isDefault: false },
    }),
    // 2. Set the specific language as default
    prisma.language.update({
      where: { id: languageId, tenantId: tenant.id },
      data: { isDefault: true },
    }),
  ]);

  revalidatePath("/settings");
  revalidatePath("/", "layout"); // Update app context
}

// 7. IMPORT LANGUAGE (Bulk Upsert)
export async function importLanguageAction(languageId: string, jsonContent: string) {
  const { tenant } = await getTenantAndUser();
  if (!tenant) throw new Error("Unauthorized");

  let parsed;
  try {
    parsed = JSON.parse(jsonContent);
  } catch (e) {
    throw new Error("Invalid JSON format");
  }

  const lang = await prisma.language.findUnique({ where: { id: languageId } });
  if (!lang) throw new Error("Language not found");

  // Merge with existing
  const current = (lang.translations as Record<string, string>) || {};
  const updated = { ...current, ...parsed };

  await prisma.language.update({
    where: { id: languageId },
    data: { translations: updated },
  });

  // Publish file to disk (for backup)
  // Note: We need to import writeLanguageFile or copy the helper here if it's not exported
  // Assuming you keep the writeLanguageFile helper in this file
  // await writeLanguageFile(lang.code, updated); 

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  
  return { count: Object.keys(parsed).length };
}