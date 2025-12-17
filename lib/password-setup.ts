import { headers } from "next/headers";
import ipaddr from "ipaddr.js";
import { prisma } from "@/lib/prisma";

export async function checkIpRestriction(tenantId: string | null) {
  // 1. Get Settings
  const settings = await prisma.ipSettings.findFirst({
    where: { tenantId },
  });

  if (!settings || !settings.enabled) {
    return { allowed: true };
  }

  // 2. Get User IP
  const headersList = await headers();
  let ipString = headersList.get("x-forwarded-for") || "127.0.0.1";
  
  if (ipString.includes(",")) {
    ipString = ipString.split(",")[0].trim();
  }
  if (ipString === "::1") ipString = "127.0.0.1";

  // 3. Parse and Verify
  try {
    let clientIp = ipaddr.parse(ipString);

    // ✅ FIX: Convert "IPv4-mapped IPv6" (::ffff:127.0.0.1) to plain IPv4 (127.0.0.1)
    if (clientIp.kind() === 'ipv6' && (clientIp as ipaddr.IPv6).isIPv4MappedAddress()) {
        clientIp = (clientIp as ipaddr.IPv6).toIPv4Address();
    }

    const allowList = settings.allowList as { ip: string }[];

    const isAllowed = allowList.some((entry) => {
      try {
        if (entry.ip.includes("/")) {
          // CIDR Range Check
          const range = ipaddr.parseCIDR(entry.ip);
          return clientIp.match(range);
        } else {
          // Exact Match Check
          let allowedIp = ipaddr.parse(entry.ip);
          
          // Normalize allowed IP too just in case
          if (allowedIp.kind() === 'ipv6' && (allowedIp as ipaddr.IPv6).isIPv4MappedAddress()) {
             allowedIp = (allowedIp as ipaddr.IPv6).toIPv4Address();
          }

          // Compare normalized strings
          return clientIp.toNormalizedString() === allowedIp.toNormalizedString();
        }
      } catch (e) {
        return false; 
      }
    });

    if (isAllowed) {
      return { allowed: true };
    }

    console.warn(`[IP Guard] Blocked access from ${clientIp.toString()} (Raw: ${ipString})`);
    return { allowed: false, ip: clientIp.toString() };

  } catch (e) {
    console.error("[IP Guard] Error parsing IP:", e);
    return { allowed: false, ip: "Invalid IP" };
  }
}