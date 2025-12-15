"use client";

import { EmailMenu, type UnreadEmailData } from "@/components/email-menu"; 
import { useEffect, useState } from "react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

type NavbarProps = {
  user?: {
    name: string | null;
    email: string;
    image?: string | null;
    // ✅ Make sure 'id' is passed here if not already defined in your types!
    // But usually 'user' prop in navbar comes from the shell which has name/email/image.
    // If your user object DOES NOT have ID, we need to add it.
  } & { id?: string }; // Fallback type intersection
  
  currentLocale?: string;
  languages?: { code: string; name: string }[];
  
  emailData?: {
    count: number;
    items: UnreadEmailData[];
  };
};

export function Navbar({ 
  user, 
  currentLocale = "en", 
  languages = [],
  emailData 
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
<button
  data-tour="start-tour"
  type="button"
  onClick={() => window.dispatchEvent(new Event("start-app-tour"))}
>
  Start Tour
</button>


        <LanguageSwitcher 
            currentLocale={currentLocale} 
            languages={languages} 
        />

        <ThemeToggle />
        
        {/* ✅ Pass user.id here */}
        {emailData && user?.id && (
            <EmailMenu 
                unreadCount={emailData.count} 
                latestEmails={emailData.items} 
                userId={user.id} 
            />
        )}
        
        {user && <UserMenu user={user} />}
      </div>
    </header>
  );
}