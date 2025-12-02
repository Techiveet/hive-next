// app/(dashboard)/security/layout.tsx  (or /files/layout.tsx – whatever path you’re using)

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Security Management", // -> "Security Management | <brand title>" via root template
};

export default function FilesLayout({
  children,
}: {
  children: ReactNode;
}) {
  // ❌ NO DashboardShell here – parent (dashboard)/layout already has it
  return <>{children}</>;
}
