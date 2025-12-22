// app/icon.tsx

import { ImageResponse } from "next/og";
import { getBrandForRequest } from "@/lib/brand-server";
import { headers } from "next/headers";

// ✅ FIX: Prisma-based brand lookup requires Node runtime
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
  try {
    const brand = await getBrandForRequest();

    // Prefer faviconUrl, fallback to sidebarIconUrl
    const iconSource = brand?.faviconUrl || brand?.sidebarIconUrl || null;

    // 1) Base64 data URI
    if (iconSource?.startsWith("data:")) {
      const [, base64Data] = iconSource.split(",");
      if (base64Data) {
        const buffer = Buffer.from(base64Data, "base64");
        return new Response(buffer, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "no-store",
          },
        });
      }
    }

    // 2) Normal URL (/storage/...png or https://...)
    if (iconSource && (iconSource.startsWith("/") || iconSource.startsWith("http"))) {
      const h = await headers();
      const host = h.get("host") ?? "localhost:3000";
      const proto = h.get("x-forwarded-proto") ?? "http";

      const absoluteUrl = iconSource.startsWith("http")
        ? iconSource
        : `${proto}://${host}${iconSource}`;

      const res = await fetch(absoluteUrl, { cache: "no-store" });

      if (res.ok) {
        const ct = res.headers.get("content-type") ?? "image/png";
        const arrayBuffer = await res.arrayBuffer();

        return new Response(Buffer.from(arrayBuffer), {
          headers: {
            "Content-Type": ct,
            "Cache-Control": "no-store",
          },
        });
      }
    }

    // 3) Fallback: generated gradient icon
    const letter = (brand?.titleText || "H").charAt(0).toUpperCase();

    return new ImageResponse(
      (
        <div
          style={{
            fontSize: 20,
            background: "linear-gradient(to bottom right, #4f46e5, #9333ea)",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            borderRadius: 8,
            fontWeight: 700,
          }}
        >
          {letter}
        </div>
      ),
      size
    );
  } catch (error) {
    console.error("[Icon Generation Error]", error);

    return new ImageResponse(
      (
        <div
          style={{
            background: "linear-gradient(to bottom right, #4f46e5, #9333ea)",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: 16, color: "white", fontWeight: 700 }}>H</div>
        </div>
      ),
      size
    );
  }
}
