// src/app/(auth)/layout.tsx

import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Gradient background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_60%),radial-gradient(circle_at_bottom,_rgba(129,140,248,0.18),_transparent_55%)]" />
      </div>

      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Mini brand header */}
          <div className="mb-6 flex items-center gap-3 text-slate-200">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900/80 ring-1 ring-slate-700">
              <span className="text-lg font-semibold tracking-tight">H</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Hive Admin
              </p>
              <p className="text-sm text-slate-300">
                Secure, multi-tenant workspace access
              </p>
            </div>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
