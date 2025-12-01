// app/(dashboard)/files/layout.tsx

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security Management", // -> "Security Management | <brand title>" via root template
};

 

export default function FilesLayout({ children }: { children: ReactNode }) {
  // ❌ NO DashboardShell here – parent (dashboard)/layout already has it
  return <>{children}</>;
}