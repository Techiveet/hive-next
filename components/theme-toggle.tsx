"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Laptop2, MoonStar, SunMedium } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // First render (SSR + first client render) – keep it simple to avoid mismatch
  if (!mounted) {
    return (
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 border-border bg-card/80 text-foreground/80 hover:bg-accent hover:text-accent-foreground"
      >
        <Laptop2 className="h-4 w-4" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  const currentTheme = resolvedTheme ?? theme;
  const Icon =
    currentTheme === "light"
      ? SunMedium
      : currentTheme === "dark"
      ? MoonStar
      : Laptop2;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 border-border bg-card/80 text-foreground/80 hover:bg-accent hover:text-accent-foreground"
        >
          <Icon className="h-4 w-4" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[160px] border-border bg-card text-foreground"
      >
        <DropdownMenuItem
          className="text-xs"
          onClick={() => setTheme("light")}
        >
          <SunMedium className="mr-2 h-3.5 w-3.5" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-xs"
          onClick={() => setTheme("dark")}
        >
          <MoonStar className="mr-2 h-3.5 w-3.5" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-xs"
          onClick={() => setTheme("system")}
        >
          <Laptop2 className="mr-2 h-3.5 w-3.5" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
