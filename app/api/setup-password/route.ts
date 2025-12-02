// app/api/setup-password/route.ts

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const bodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { token, password } = bodySchema.parse(json);

    // 1) Look up our local password-setup token
    const record = await prisma.passwordSetupToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!record) {
      return NextResponse.json(
        { error: "TOKEN_INVALID", message: "Invalid or used link." },
        { status: 400 }
      );
    }

    // 2) Check expiry
    if (record.expiresAt < new Date()) {
      await prisma.passwordSetupToken.delete({ where: { id: record.id } });

      return NextResponse.json(
        { error: "TOKEN_EXPIRED", message: "This link has expired." },
        { status: 400 }
      );
    }

    // 3) Tell Better Auth to reset the password **using the token**
    //    If your version expects `password` instead of `newPassword`,
    //    swap the property name.
    const res = await auth.api.resetPassword({
      body: {
        token,
        newPassword: password,
      },
      asResponse: false,
    });

    if (res?.error) {
      console.error("[setup-password] resetPassword error", res.error);
      return NextResponse.json(
        {
          error: "RESET_PASSWORD_FAILED",
          message: "Unable to set password.",
        },
        { status: 400 }
      );
    }

    // 4) Cleanup: token is one-time use
    await prisma.passwordSetupToken.delete({ where: { id: record.id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[setup-password] unexpected error", err);
    return NextResponse.json(
      { error: "UNKNOWN", message: "Unable to set password." },
      { status: 500 }
    );
  }
}
