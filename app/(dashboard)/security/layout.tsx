// app/(dashboard)/files/layout.tsx

import { DashboardShell } from "@/components/dashboard-shell";
import { FileManagerEventListener } from "@/components/file-manager/file-manager-event-listener";
import type { Metadata } from "next";
import { PermissionsProvider } from "@/components/providers/permissions-provider";
import { getCurrentSession } from "@/lib/auth-server";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Security Management", // -> "Security Management | <brand title>" via root template
};

 

export default function FilesLayout({ children }: { children: ReactNode }) {
  // ❌ NO DashboardShell here – parent (dashboard)/layout already has it
  return <>{children}</>;
}