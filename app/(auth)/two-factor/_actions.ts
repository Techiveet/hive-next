"use server";

import { authenticator } from "otplib";
import { getCurrentSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export async function verifyTwoFactorLoginAction(code: string) {
  const { user } = await getCurrentSession();
  if (!user) throw new Error("Unauthorized");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { twoFactorSecret: true },
  });

  if (!dbUser?.twoFactorSecret) {
    throw new Error("Two-factor authentication is not enabled for this account.");
  }

  const ok = authenticator.verify({
    token: code,
    secret: dbUser.twoFactorSecret,
  });

  if (!ok) {
    throw new Error("Invalid authentication code.");
  }

  // Later you can mark session as "2FA-verified" here if you want.

  return { success: true };
}
