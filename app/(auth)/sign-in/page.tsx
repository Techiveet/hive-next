import type { Metadata } from "next";
import { SignInClient } from "./sign-in-client";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Sign In",
};

async function getBrandSettings() {
  const h = await headers();
  const host = (h.get("host") || "").toLowerCase();
  const bareHost = host.split(":")[0];

  let tenantId: string | null = null;

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

  const brand = await prisma.brandSettings.findFirst({
    where: { tenantId },
  });

  return brand;
}

export default async function SignInPage() {
  const brand = await getBrandSettings();

  return (
    <SignInClient
      brand={{
        titleText: brand?.titleText,
        logoLightUrl: brand?.logoLightUrl,
        logoDarkUrl: brand?.logoDarkUrl,
        faviconUrl: brand?.faviconUrl,
      }}
    />
  );
}
