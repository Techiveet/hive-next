import { NextRequest, NextResponse } from "next/server";

import DOMPurify from "isomorphic-dompurify";
import { autoDecryptAction } from "@/app/(dashboard)/email/server-decryption-action";
import { getCurrentSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { user } = await getCurrentSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const draft = await prisma.email.findFirst({
    where: {
      id,
      senderId: user.id,
      senderFolder: "drafts",
    },
    include: {
      attachments: {
        include: {
          file: { select: { id: true, url: true, name: true, mimeType: true, size: true } },
        },
      },
    },
  });

  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Draft might be encrypted if you ever allow that
  let subject = draft.subject || "";
  let body = draft.body || "";

  if ((draft as any).isE2EE) {
    try {
      const [decSub, decBody] = await Promise.all([
        autoDecryptAction(draft.subject || ""),
        autoDecryptAction(draft.body || ""),
      ]);

      subject = DOMPurify.sanitize(decSub || "", { ALLOWED_TAGS: [] });
      body = DOMPurify.sanitize(decBody || "", { ADD_TAGS: ["iframe"], ADD_ATTR: ["src"] });
    } catch {
      // fallback
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      id: draft.id,
      subject,
      body,
      isE2EE: draft.isE2EE ?? false,
      attachments: (draft.attachments ?? []).map((a: any) => ({
        id: a.file?.id,
        url: a.file?.url,
        name: a.file?.name,
        mimeType: a.file?.mimeType,
        size: a.file?.size ?? null,
        type: a.file?.mimeType?.startsWith("image/")
          ? "IMAGE"
          : a.file?.mimeType?.startsWith("video/")
          ? "VIDEO"
          : "FILE",
      })),
    },
  });
}
