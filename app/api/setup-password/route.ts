// app/api/setup-password/route.ts

import { NextResponse } from "next/server";
import { changeUserPasswordInternal } from "@/app/(dashboard)/security/users/users-actions";
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

    // Look up our own setup token
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

    if (record.expiresAt < new Date()) {
      await prisma.passwordSetupToken.delete({ where: { id: record.id } });
      return NextResponse.json(
        { error: "TOKEN_EXPIRED", message: "This link has expired." },
        { status: 400 }
      );
    }

    // ✅ Use the same Better Auth flow as user updates
    await changeUserPasswordInternal(record.userId, password);

    // One-shot token – remove after success
    await prisma.passwordSetupToken.delete({
      where: { id: record.id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[setup-password] unexpected error", err);
    return NextResponse.json(
      { error: "UNKNOWN", message: "Unable to set password." },
      { status: 500 }
    );
  }
}
