import { headers } from "next/headers";
import ipaddr from "ipaddr.js";
import { prisma } from "@/lib/prisma";

type Rule = { ip: string; action: "ALLOW" | "BLOCK" };

export async function checkIpRestriction(tenantId: string | null) {
  const settings = await prisma.ipSettings.findFirst({ where: { tenantId } });

  // 1. If disabled, everyone enters
  if (!settings || !settings.enabled) return { allowed: true };

  const headersList = await headers();
  let ipString = headersList.get("x-forwarded-for") || "127.0.0.1";
  if (ipString.includes(",")) ipString = ipString.split(",")[0].trim();
  if (ipString === "::1") ipString = "127.0.0.1";

  try {
    let clientIp = ipaddr.parse(ipString);
    if (clientIp.kind() === 'ipv6' && (clientIp as ipaddr.IPv6).isIPv4MappedAddress()) {
        clientIp = (clientIp as ipaddr.IPv6).toIPv4Address();
    }

    const rules = settings.allowList as Rule[];
    
    // 2. Check Specific Rules (First Match Wins)
    // We search the list to see if this IP is explicitly listed
    const matchedRule = rules.find((entry) => {
      try {
        if (entry.ip.includes("/")) {
          return clientIp.match(ipaddr.parseCIDR(entry.ip));
        } else {
          let ruleIp = ipaddr.parse(entry.ip);
          if (ruleIp.kind() === 'ipv6' && (ruleIp as ipaddr.IPv6).isIPv4MappedAddress()) {
             ruleIp = (ruleIp as ipaddr.IPv6).toIPv4Address();
          }
          return clientIp.toNormalizedString() === ruleIp.toNormalizedString();
        }
      } catch { return false; }
    });

    // ✅ Rule Found: Obey the rule
    if (matchedRule) {
        if (matchedRule.action === "BLOCK") {
            console.warn(`[IP Guard] ⛔ Explicitly Blocked: ${clientIp}`);
            return { allowed: false, ip: clientIp.toString() };
        }
        return { allowed: true }; // Explicitly Allowed
    }

    // 3. No Rule Found: Fallback to Global Strategy
    // If Strategy is "BLOCK" (Whitelist Mode), block unknown IPs.
    // If Strategy is "ALLOW" (Blacklist Mode), allow unknown IPs.
    if (settings.strategy === "BLOCK") {
        console.warn(`[IP Guard] 🔒 Default Block applied to: ${clientIp}`);
        return { allowed: false, ip: clientIp.toString() };
    }

    return { allowed: true }; // Default Allow

  } catch (e) {
    console.error("[IP Guard] Error:", e);
    return { allowed: false, ip: "Invalid IP" };
  }
}