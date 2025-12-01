// app/icon.tsx

import { ImageResponse } from "next/og";
import { getBrandForRequest } from "@/lib/brand-server";
import { headers } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const size = {
  width: 32,
  height: 32,
};

export const contentType = "image/png";

export default async function Icon() {
  try {
    const brand = await getBrandForRequest();

    // 🔑 Prefer faviconUrl, fallback to sidebarIconUrl
    const iconSource =
      brand?.faviconUrl || brand?.sidebarIconUrl || null;

    // 1️⃣ Base64 data URI (e.g. data:image/png;base64,...)
    if (iconSource && iconSource.startsWith("data:")) {
      const [, base64Data] = iconSource.split(",");
      if (base64Data) {
        const buffer = Buffer.from(base64Data, "base64");

        return new Response(buffer, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }
    }

    // 2️⃣ Normal URL (/storage/...png or https://...)
    if (iconSource && (iconSource.startsWith("/") || iconSource.startsWith("http"))) {
      const h = await headers();
      const host = h.get("host") ?? "localhost:3000";

      const absoluteUrl = iconSource.startsWith("http")
        ? iconSource
        : `http://${host}${iconSource}`;

      const res = await fetch(absoluteUrl);

      if (res.ok) {
        const contentTypeHeader =
          res.headers.get("content-type") ?? "image/png";
        const arrayBuffer = await res.arrayBuffer();

        return new Response(Buffer.from(arrayBuffer), {
          headers: {
            "Content-Type": contentTypeHeader,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }
    }

    // 3️⃣ Fallback: generated gradient icon with first letter of title
    const letter = (brand?.titleText || "H").charAt(0).toUpperCase();

    return new ImageResponse(
      (
        <div
          style={{
            fontSize: 20,
            background:
              "linear-gradient(to bottom right, #4f46e5, #9333ea)",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            borderRadius: "8px",
            fontWeight: 700,
          }}
        >
          {letter}
        </div>
      ),
      { ...size }
    );
  } catch (error) {
    console.error("[Icon Generation Error]", error);

    // Emergency black circle
    return new ImageResponse(
      (
        <div
          style={{
            background: "#000",
            width: "100%",
            height: "100%",
            borderRadius: "50%",
          }}
        />
      ),
      { ...size }
    );
  }
}
