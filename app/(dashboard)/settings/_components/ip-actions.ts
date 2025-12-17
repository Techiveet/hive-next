"use server";

import { getTenantAndUser } from "@/lib/get-tenant-and-user";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

type AllowedIp = {
  ip: string;
  label: string;
  action: "ALLOW" | "BLOCK";
  addedAt: string;
};

// 1. GET SETTINGS
export async function getIpSettingsAction() {
  const { tenant } = await getTenantAndUser();
  const tenantId = tenant?.id ?? null;

  const settings = await prisma.ipSettings.findFirst({
    where: { tenantId }
  });

  return settings || { enabled: false, strategy: "ALLOW", allowList: [] };
}

// 2. SAVE SETTINGS (Global Toggle & Strategy)
export async function saveIpSettingsAction(enabled: boolean, strategy: "ALLOW" | "BLOCK") {
  const { tenant } = await getTenantAndUser();
  const tenantId = tenant?.id ?? null;

  const settings = await prisma.ipSettings.findFirst({ where: { tenantId } });
  let allowList = (settings?.allowList as AllowedIp[]) || [];

  // Safety: If switching to "Whitelist Mode" (Strategy = ALLOW) and enabling,
  // ensure current IP is allowed to prevent lockout.
  if (enabled && strategy === "ALLOW") {
      const h = await headers();
      let currentIp = h.get("x-forwarded-for") || "127.0.0.1";
      
      // Normalize IP
      if (currentIp.includes(",")) currentIp = currentIp.split(",")[0].trim();
      if (currentIp.startsWith("::ffff:")) currentIp = currentIp.replace("::ffff:", "");
      if (currentIp === "::1") currentIp = "127.0.0.1";

      // Check if current IP is explicitly allowed
      const isExplicitlyAllowed = allowList.some(item => item.ip === currentIp && item.action === "ALLOW");
      
      if (!isExplicitlyAllowed) {
          console.log(`[IP Guard] Safety Trigger: Auto-allowing current IP (${currentIp}).`);
          allowList.push({
              ip: currentIp,
              label: "Admin Session (Auto-Added)",
              action: "ALLOW",
              addedAt: new Date().toISOString()
          });
      }
  }

  if (settings) {
    await prisma.ipSettings.update({
      where: { id: settings.id },
      data: { enabled, strategy, allowList },
    });
  } else {
    await prisma.ipSettings.create({
      data: { tenantId, enabled, strategy, allowList },
    });
  }
  revalidatePath("/settings");
}

// 3. ADD IP ADDRESS
export async function addIpAddressAction(ip: string, label: string, action: "ALLOW" | "BLOCK") {
  const { tenant } = await getTenantAndUser();
  const tenantId = tenant?.id ?? null;

  // Basic Validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
  if (!ipv4Regex.test(ip) && ip !== "::1" && ip !== "127.0.0.1") { 
    throw new Error("Invalid IP Address format");
  }

  const settings = await prisma.ipSettings.findFirst({ where: { tenantId } });
  
  let currentList = (settings?.allowList as AllowedIp[]) || [];
  
  // Remove duplicates if re-adding same IP (overwrite logic)
  currentList = currentList.filter(item => item.ip !== ip);

  const newEntry: AllowedIp = { ip, label, action, addedAt: new Date().toISOString() };
  const updatedList = [...currentList, newEntry];

  if (settings) {
      await prisma.ipSettings.update({
          where: { id: settings.id },
          data: { allowList: updatedList }
      });
  } else {
      await prisma.ipSettings.create({
          data: { 
              tenantId, 
              allowList: updatedList, 
              enabled: false // Default disabled to prevent accidental lockout
          }
      });
  }

  revalidatePath("/settings");
}

// 4. UPDATE IP RULE (Toggle Allow/Block for specific IP)
export async function updateIpRuleAction(ipToUpdate: string, newAction: "ALLOW" | "BLOCK") {
  const { tenant } = await getTenantAndUser();
  const tenantId = tenant?.id ?? null;

  const settings = await prisma.ipSettings.findFirst({ where: { tenantId } });
  if (!settings) return;

  const currentList = (settings.allowList as AllowedIp[]) || [];

  // Find and update
  const updatedList = currentList.map((item) => {
    if (item.ip === ipToUpdate) {
      return { ...item, action: newAction };
    }
    return item;
  });

  await prisma.ipSettings.update({
    where: { id: settings.id },
    data: { allowList: updatedList },
  });

  revalidatePath("/settings");
}

// 5. REMOVE IP ADDRESS
export async function removeIpAddressAction(ip: string) {
  const { tenant } = await getTenantAndUser();
  const tenantId = tenant?.id ?? null;

  const settings = await prisma.ipSettings.findFirst({ where: { tenantId } });
  if (!settings) return;

  const currentList = (settings.allowList as AllowedIp[]) || [];
  const updatedList = currentList.filter((item) => item.ip !== ip);

  await prisma.ipSettings.update({
    where: { id: settings.id },
    data: { allowList: updatedList },
  });

  revalidatePath("/settings");
}