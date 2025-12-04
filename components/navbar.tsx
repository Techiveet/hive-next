"use client";

import { useEffect, useState } from "react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

type NavbarProps = {
  user?: {
    name: string | null;
    email: string;
  };
  currentLocale?: string;
  languages?: { code: string; name: string }[];
};

export function Navbar({ 
  user, 
  currentLocale = "en", 
  languages = [] 
}: NavbarProps) {
  const [host, setHost] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setHost(window.location.hostname);
    }
  }, []);

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur dark:bg-slate-950/80 dark:border-slate-800">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Dashboard</span>
        {host && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary dark:bg-emerald-500/10 dark:text-emerald-300">
            {host}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* LANGUAGE SWITCHER */}
        <LanguageSwitcher 
            currentLocale={currentLocale} 
            languages={languages} 
        />

        {/* THEME TOGGLE */}
        <ThemeToggle />
        
        {/* USER MENU */}
        {user && <UserMenu user={user} />}
      </div>
    </header>
  );
}