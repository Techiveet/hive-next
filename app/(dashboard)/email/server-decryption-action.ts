// app/(dashboard)/email/server-decryption-action.ts
"use server";

import * as openpgp from "openpgp";

import { getCurrentSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

const SERVER_KEY_PASS = process.env.PGP_VAULT_MASTER_KEY || "";
const DEBUG = process.env.PGP_DEBUG === "true";

const E = {
  MASTER_KEY_MISSING: "E_EMAIL_MASTER_KEY_MISSING",
  UNAUTHORIZED: "E_EMAIL_UNAUTHORIZED",
  NO_PRIVATE_KEY: "E_EMAIL_NO_PRIVATE_KEY",
  INVALID_FORMAT: "E_EMAIL_INVALID_ENCRYPTED_FORMAT",
  DECRYPT_FAILED: "E_EMAIL_DECRYPT_FAILED",
  KEY_VERIFY_FAILED: "E_EMAIL_KEY_VERIFY_FAILED",
} as const;

function fail(code: (typeof E)[keyof typeof E]): never {
  throw new Error(code);
}

function dlog(...args: any[]) {
  if (DEBUG) console.log("[PGP]", ...args);
}

// ====================================================================
// AUTOMATIC DECRYPTION (safe errors + optional debug logs)
// ====================================================================

export async function autoDecryptAction(encryptedText: string) {
  if (!SERVER_KEY_PASS) fail(E.MASTER_KEY_MISSING);

  const { user } = await getCurrentSession();
  if (!user) fail(E.UNAUTHORIZED);

  // 1) fetch encrypted private key
  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      encryptedPrivateKey: true,
    },
  });

  const encryptedPrivateKey = userData?.encryptedPrivateKey;
  if (!encryptedPrivateKey) fail(E.NO_PRIVATE_KEY);

  // 2) decode base64 armored message
  let armoredMessage = "";
  try {
    armoredMessage = Buffer.from(String(encryptedText || "").trim(), "base64").toString("utf8");
  } catch {
    fail(E.INVALID_FORMAT);
  }

  // quick sanity check (optional, but helps catch garbage input)
  if (!armoredMessage.includes("BEGIN PGP MESSAGE")) {
    fail(E.INVALID_FORMAT);
  }

  try {
    dlog("Reading private key...");
    const privateKey = await openpgp.readPrivateKey({ armoredKey: encryptedPrivateKey });

    dlog("Decrypting private key with master passphrase...");
    const decryptedPrivateKey = await openpgp.decryptKey({
      privateKey,
      passphrase: SERVER_KEY_PASS,
    });

    dlog("Reading message...");
    const message = await openpgp.readMessage({ armoredMessage });

    // (optional debug)
    if (DEBUG) {
      const encKeyIDs = message.getEncryptionKeyIDs().map((id) => id.toHex());
      dlog("Message encrypted for key IDs:", encKeyIDs.join(", "));
      dlog("Our key ID:", decryptedPrivateKey.getKeyID().toHex());
    }

    dlog("Decrypting message...");
    const { data } = await openpgp.decrypt({
      message,
      decryptionKeys: [decryptedPrivateKey],
    });

    return data as string;
  } catch (err: any) {
    // log details only in debug mode
    dlog("Decrypt failed:", err?.message);
    fail(E.DECRYPT_FAILED);
  }
}

// ====================================================================
// UTILITY: Clear user keys (self only)
// ====================================================================

export async function clearUserKeysAction(userId: string) {
  const { user } = await getCurrentSession();
  if (!user) fail(E.UNAUTHORIZED);

  if (user.id !== userId) {
    // keep it generic to avoid leaking info
    fail(E.UNAUTHORIZED);
  }

  await prisma.user.update({
    where: { id: userId },
    data: { pgpPublicKey: null, encryptedPrivateKey: null },
  });

  return { success: true };
}

// ====================================================================
// UTILITY: Verify key pair integrity (returns diagnostics, not localized)
// ====================================================================

export async function verifyUserKeysAction() {
  if (!SERVER_KEY_PASS) {
    return {
      valid: false,
      code: E.MASTER_KEY_MISSING,
    };
  }

  const { user } = await getCurrentSession();
  if (!user) {
    return {
      valid: false,
      code: E.UNAUTHORIZED,
    };
  }

  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    select: { encryptedPrivateKey: true, pgpPublicKey: true },
  });

  if (!userData?.pgpPublicKey || !userData?.encryptedPrivateKey) {
    return {
      valid: false,
      code: "E_EMAIL_NO_KEYS",
      hasPublicKey: !!userData?.pgpPublicKey,
      hasPrivateKey: !!userData?.encryptedPrivateKey,
    };
  }

  try {
    const publicKey = await openpgp.readKey({ armoredKey: userData.pgpPublicKey });
    const privateKey = await openpgp.readPrivateKey({ armoredKey: userData.encryptedPrivateKey });

    const decryptedPrivateKey = await openpgp.decryptKey({
      privateKey,
      passphrase: SERVER_KEY_PASS,
    });

    const publicKeyID = publicKey.getKeyID().toHex();
    const privateKeyID = decryptedPrivateKey.getKeyID().toHex();

    return {
      valid: publicKeyID === privateKeyID,
      code: publicKeyID === privateKeyID ? "OK" : "E_EMAIL_KEY_MISMATCH",
      publicKeyID,
      privateKeyID,
    };
  } catch (err: any) {
    dlog("Verify keys failed:", err?.message);
    return {
      valid: false,
      code: E.KEY_VERIFY_FAILED,
    };
  }
}
