// app/(dashboard)/files/layout.tsx

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Tenant Management",
};

export default function FilesLayout({
  children,
}: {
  children: ReactNode;
}) {
  // parent (dashboard)/layout already wraps with DashboardShell
  return <>{children}</>;
}
