// lib/password-setup.ts

import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const EXPIRY_HOURS = 24;

export async function issuePasswordSetupToken(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);

  // one active token per user (optional but nice)
  await prisma.passwordSetupToken.deleteMany({
    where: { userId },
  });

  const record = await prisma.passwordSetupToken.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  return { token: record.token, expiresAt };
}
