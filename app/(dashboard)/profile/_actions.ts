"use server";

import { authenticator } from "otplib";
import bcrypt from "bcryptjs";
import { getCurrentSession } from "@/lib/auth-server";
import { getStorageProvider } from "@/lib/storage-factory";
import { prisma } from "@/lib/prisma";
import qrcode from "qrcode";
import { revalidatePath } from "next/cache";

// ❌ REMOVED: import crypto from "crypto"; // Relying on global Web Crypto API

// --- Helper for generating random hex (Web Crypto API compliant) ---
const generateRandomHex = (length: number) => {
    // Uses the global window.crypto API, which is available in Next.js Server Actions
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Buffer.from(array).toString('hex');
}
// ------------------------------------------------------------------


// --- 1. PROFILE UPDATE (Name & Avatar) ---
export async function updateProfileAction(formData: FormData) {
const { user } = await getCurrentSession();
if (!user) throw new Error("Unauthorized");

const name = formData.get("name") as string;
const avatarUrl = (formData.get("avatarUrl") as string | null) || undefined;
const imageFile = formData.get("image") as File | null;

let imageToSave: string | undefined = undefined;

// 1) If avatarUrl is provided (from File Manager) → use it
if (avatarUrl && avatarUrl.trim().length > 0) {
imageToSave = avatarUrl.trim();
}
// 2) Else fall back to direct upload (if you still want to support it)
else if (imageFile && imageFile.size > 0) {
try {
const storage = await getStorageProvider(null); // central storage
const buffer = Buffer.from(await imageFile.arrayBuffer());
const fileName = `avatars/${user.id}-${Date.now()}-${imageFile.name}`;
imageToSave = await storage.upload(buffer, fileName, imageFile.type);
} catch (error) {
console.error("Avatar upload failed:", error);
throw new Error("Failed to upload image");
}
}

await prisma.user.update({
where: { id: user.id },
data: {
name,
...(imageToSave && { image: imageToSave }),
},
});

revalidatePath("/profile");
return { success: true };
}
/* ------------------------------------------------------------------
 * CHANGE PASSWORD (self-service, using same model as changeUserPasswordInternal)
 * ------------------------------------------------------------------ */
export async function changePasswordAction(currentPass: string, newPass: string) {
const { user } = await getCurrentSession();
if (!user) throw new Error("Unauthorized");

const dbUser = await prisma.user.findUnique({
where: { id: user.id },
include: { accounts: true },
});

if (!dbUser) throw new Error("User not found in database.");

// Prefer the account that actually holds a password (like the admin helper)
const credentialAccount =
dbUser.accounts.find((a) => a.password) ?? null;

// Check against the hash in the credential account
const existingHash = credentialAccount?.password ?? null;

// --- CASE 1: user already has a password -> verify current one first ---
if (existingHash) {
const isValid = await bcrypt.compare(currentPass, existingHash);
if (!isValid) throw new Error("Incorrect current password");
} else if (currentPass && currentPass.length > 0) {
    // Current password provided but no existing hash to check against
    throw new Error("Current password cannot be validated.");
  }


// --- CASE 2 + 1: always set new password in the Account table (Better Auth compatible) ---
const newHashedPassword = await bcrypt.hash(newPass, 10);

if (credentialAccount) {
// Update existing account password
await prisma.account.update({
where: { id: credentialAccount.id },
data: { password: newHashedPassword },
});
} else {
// No account with password yet: create a 'credential' account
await prisma.account.create({
data: {
id: crypto.randomUUID(),
userId: user.id,
providerId: "credential", // ⚠️ match your schema
accountId: user.id,
password: newHashedPassword,
// FIX: Use Web Crypto compatible function
accessToken: generateRandomHex(32), // required dummy
},
});
}

// Optional: also mirror the hash to user.password if you want
// await prisma.user.update({ where: { id: user.id }, data: { password: newHashedPassword } });

revalidatePath("/profile");
return { success: true };
}
// --- 3. VERIFY PASSWORD (Helper for Modals) ---
export async function verifyPasswordAction(password: string) {
const { user } = await getCurrentSession();
if (!user) return false;

const dbUser = await prisma.user.findUnique({ 
where: { id: user.id },
include: { accounts: true } 
});

if (!dbUser) return false;

  const credentialAccount = dbUser.accounts.find(a => a.password);
  let verifyHash = credentialAccount?.password ?? null;

  if (!verifyHash) {
      return false; // No password set
  }

return await bcrypt.compare(password, verifyHash);
}

// --- 4. GENERATE 2FA SECRET ---
export async function generateTwoFactorSecretAction() {
const { user } = await getCurrentSession();
if (!user) throw new Error("Unauthorized");

const secret = authenticator.generateSecret();
const otpauth = authenticator.keyuri(user.email, "Hive Platform", secret);
const qrCodeUrl = await qrcode.toDataURL(otpauth);

return { secret, qrCodeUrl };
}

// --- 5. ENABLE 2FA ---
export async function enableTwoFactorAction(secret: string, token: string) {
const { user } = await getCurrentSession();
if (!user) throw new Error("Unauthorized");

const isValid = authenticator.verify({ token, secret });
if (!isValid) throw new Error("Invalid verification code");

const recoveryCodes = Array.from({ length: 10 }, () =>
Math.random().toString(36).substring(2, 10).toUpperCase()
);

await prisma.user.update({
where: { id: user.id },
data: {
twoFactorEnabled: true,
twoFactorSecret: secret,
twoFactorRecoveryCodes: recoveryCodes.join(","),
},
});

revalidatePath("/profile");
return { success: true, recoveryCodes };
}

// --- 6. DISABLE 2FA ---
export async function disableTwoFactorAction() {
const { user } = await getCurrentSession();
if (!user) throw new Error("Unauthorized");

await prisma.user.update({
where: { id: user.id },
data: {
twoFactorEnabled: false,
twoFactorSecret: null,
twoFactorRecoveryCodes: null,
},
});

revalidatePath("/profile");
return { success: true };
}

// --- 7. REGENERATE CODES ---
export async function regenerateRecoveryCodesAction() {
const { user } = await getCurrentSession();
if (!user) throw new Error("Unauthorized");

const recoveryCodes = Array.from({ length: 10 }, () =>
Math.random().toString(36).substring(2, 10).toUpperCase()
);

await prisma.user.update({
where: { id: user.id },
data: { twoFactorRecoveryCodes: recoveryCodes.join(",") },
});

revalidatePath("/profile");
return { success: true, recoveryCodes };
}

// --- 8. GET PERSISTENT QR CODE (NEW) ---
export async function getPersistentQrAction() {
const { user } = await getCurrentSession();
if (!user) throw new Error("Unauthorized");

const dbUser = await prisma.user.findUnique({ 
where: { id: user.id },
select: { twoFactorSecret: true, email: true } 
});

if (!dbUser?.twoFactorSecret) return null;

// Use saved secret to regenerate the QR data URL
const otpauth = authenticator.keyuri(dbUser.email, "Hive Platform", dbUser.twoFactorSecret);
const qrCodeUrl = await qrcode.toDataURL(otpauth);

return { qrCodeUrl };
}