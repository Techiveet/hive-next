"use server";

import { prisma } from "@/lib/prisma";

/**
 * Check if a user (by email) has 2FA enabled.
 * Used by the sign-in page BEFORE redirecting.
 */
export async function userHasTwoFactorEnabled(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { twoFactorEnabled: true },
  });

  return !!user?.twoFactorEnabled;
}
