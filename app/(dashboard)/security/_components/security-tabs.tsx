// app/(dashboard)/security/_components/security-tabs.tsx
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Tabs } from "@/components/ui/tabs";

interface SecurityTabsProps {
  defaultTab: string;
  children: React.ReactNode;
  className?: string;
}

export function SecurityTabs({ defaultTab, children, className }: SecurityTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onTabChange(value: string) {
    // Create a new URLSearchParams object to avoid mutating the read-only hook result
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);

    // Update the URL without scrolling to the top
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <Tabs
      defaultValue={defaultTab}
      onValueChange={onTabChange}
      className={className}
    >
      {children}
    </Tabs>
  );
}