"use client";

import { Check, Languages } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Button } from "@/components/ui/button";
import { setLanguageAction } from "@/app/actions/set-language";
import { toast } from "sonner";
import { useRouter } from "next/navigation"; // <--- 1. Import useRouter
import { useTransition } from "react";

type Language = {
  code: string;
  name: string;
};

interface LanguageSwitcherProps {
  currentLocale: string;
  languages: Language[];
}

export function LanguageSwitcher({ currentLocale, languages }: LanguageSwitcherProps) {
  const router = useRouter(); // <--- 2. Initialize router
  const [isPending, startTransition] = useTransition();

  const handleLanguageChange = (code: string) => {
    startTransition(async () => {
      try {
        await setLanguageAction(code);
        toast.success("Language updated");
        router.refresh(); // <--- 3. CRITICAL: Forces the Layout to re-fetch the dictionary
      } catch (error) {
        toast.error("Failed to change language");
      }
    });
  };

  const activeLang = languages.find(l => l.code === currentLocale);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          disabled={isPending}
          className="h-8 w-8 border-border bg-card/80 text-foreground/80 hover:bg-accent hover:text-accent-foreground"
          title={`Current Language: ${activeLang?.name || currentLocale}`}
        >
          <Languages className="h-4 w-4" />
          <span className="sr-only">Switch Language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.length === 0 && (
            <div className="p-2 text-xs text-muted-foreground">No languages found</div>
        )}
        
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className="flex items-center justify-between gap-2 text-xs font-medium cursor-pointer"
          >
            <span>{lang.name}</span>
            {currentLocale === lang.code && (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}