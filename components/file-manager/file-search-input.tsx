// components/file-manager/file-search-input.tsx
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import React from "react";
import { Search } from "lucide-react";

type FileSearchInputProps = {
  placeholder?: string;
  searchParamKey?: string; // default "q"
  resetPageKeys?: string[]; // default ["recentsPage"]
};

export function FileSearchInput({
  placeholder = "Search files",
  searchParamKey = "q",
  resetPageKeys = ["recentsPage"],
}: FileSearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const defaultValue = searchParams.get(searchParamKey) ?? "";
  const [value, setValue] = React.useState(defaultValue);

  React.useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const updateUrl = React.useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (next.trim()) {
        params.set(searchParamKey, next.trim());
      } else {
        params.delete(searchParamKey);
      }

      resetPageKeys.forEach((key) => params.delete(key));

      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname);
    },
    [pathname, router, searchParams, searchParamKey, resetPageKeys]
  );

  React.useEffect(() => {
    const handle = setTimeout(() => {
      if (value !== defaultValue) {
        updateUrl(value);
      }
    }, 300);

    return () => clearTimeout(handle);
  }, [value, defaultValue, updateUrl]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-full border bg-background pl-8 pr-3 text-xs outline-none ring-0 transition focus:border-primary focus:ring-1 focus:ring-primary/40"
      />
    </div>
  );
}
