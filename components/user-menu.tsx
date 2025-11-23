"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User2 } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type UserMenuProps = {
  user: {
    name: string | null;
    email: string;
  };
};

export function UserMenu({ user }: UserMenuProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const initials =
    user.name?.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase() ??
    user.email[0].toUpperCase();

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            router.push("/sign-in?callbackURL=/");
          },
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-2 py-1 text-left text-xs hover:bg-slate-800 focus:outline-none">
        <Avatar className="h-7 w-7 border border-slate-600">
          <AvatarFallback className="bg-gradient-to-tr from-emerald-400 to-sky-500 text-xs font-semibold text-slate-950">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="hidden sm:flex flex-col leading-tight">
          <span className="max-w-[140px] truncate text-[11px] font-medium text-slate-100">
            {user.name ?? user.email}
          </span>
          <span className="max-w-[140px] truncate text-[10px] text-slate-400">
            {user.email}
          </span>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[220px] border-slate-800 bg-slate-900 text-slate-100"
      >
        <DropdownMenuLabel className="flex items-center gap-2">
          <Avatar className="h-8 w-8 border border-slate-600">
            <AvatarFallback className="bg-gradient-to-tr from-emerald-400 to-sky-500 text-xs font-semibold text-slate-950">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col leading-tight">
            <span className="truncate text-xs font-semibold">
              {user.name ?? "User"}
            </span>
            <span className="truncate text-[11px] text-slate-400">
              {user.email}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-800" />
        <DropdownMenuItem className="text-xs">
          <User2 className="mr-2 h-3.5 w-3.5" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-slate-800" />
        <DropdownMenuItem
          className="text-xs text-red-300 focus:bg-red-950/60 focus:text-red-200"
          onClick={handleSignOut}
          disabled={loading}
        >
          <LogOut className="mr-2 h-3.5 w-3.5" />
          {loading ? "Signing out..." : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
