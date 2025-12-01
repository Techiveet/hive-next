import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

const FALLBACK_FAVICON = null; 

function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  // ✅ Keep Base64 data as is
  if (url.startsWith("data:")) return url;
  
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return url;
  
  return `/${url}`;
}

export async function getBrandForRequest() {
  const h = await headers();
  const host = (h.get("host") || "").toLowerCase();
  const bareHost = host.split(":")[0];

  let tenantId: string | null = null;

  // 1. Resolve Tenant
  if (bareHost === "localhost") {
    const centralTenant = await prisma.tenant.findUnique({
      where: { slug: "central-hive" },
      select: { id: true },
    });
    tenantId = centralTenant?.id ?? null;
  } else {
    const domain = await prisma.tenantDomain.findFirst({
      where: { domain: bareHost },
      select: { tenantId: true },
    });
    tenantId = domain?.tenantId ?? null;
  }

  // 2. Fetch Brand
  let brand = await prisma.brandSettings.findFirst({
    where: { tenantId },
  });

  // 3. Fallback to Central
  if (!brand) {
    brand = await prisma.brandSettings.findFirst({
      where: { tenantId: null },
    });
  }

  // 4. Default
  if (!brand) {
    return {
      titleText: "Hive",
      logoLightUrl: null,
      logoDarkUrl: null,
      faviconUrl: FALLBACK_FAVICON,
      sidebarIconUrl: null,
    };
  }

  return {
    ...brand,
    titleText: brand.titleText ?? "Hive",
    logoLightUrl: normalizeUrl(brand.logoLightUrl),
    logoDarkUrl: normalizeUrl(brand.logoDarkUrl),
    // ✅ Fix: Ensure faviconUrl is included and normalized
    faviconUrl: normalizeUrl(brand.faviconUrl) ?? FALLBACK_FAVICON,
    sidebarIconUrl: normalizeUrl(brand.sidebarIconUrl),
  };
}