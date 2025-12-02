// app/(auth)/setup-password/setup-password-client.tsx
"use client";

import { Loader2, Lock, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { useRouter } from "next/navigation";
import { useState } from "react";

type SetupPasswordClientProps = {
  token: string;
  brand?: {
    titleText?: string | null;
    logoLightUrl?: string | null;
    logoDarkUrl?: string | null;
    faviconUrl?: string | null;
  } | null;
};

export function SetupPasswordClient({ token, brand }: SetupPasswordClientProps) {
  const router = useRouter();

  const appTitle = brand?.titleText?.trim() || "Hive";
  const logoLight = brand?.logoLightUrl || null;
  const logoDark = brand?.logoDarkUrl || null;
  const hasLight = !!logoLight;
  const hasDark = !!logoDark;

  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordValid = form.password.trim().length >= 8;
  const passwordsMatch =
    form.password.trim().length > 0 &&
    form.password.trim() === form.confirmPassword.trim();
  const formValid = !!token && passwordValid && passwordsMatch;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!formValid) {
      setError("Please enter a valid password and confirm it.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/setup-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password: form.password.trim(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(
          body?.message ||
            "Unable to set password. Please try again."
        );
        setLoading(false);
        return;
      }

      // success → redirect to sign in
      router.replace("/sign-in?firstTime=1");
    } catch (err) {
      console.error(err);
      setError("Unable to set password. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-0 grid min-h-screen w-screen overflow-hidden bg-background text-foreground lg:grid-cols-2">
      {/* gradient blobs */}
      <div className="pointer-events-none absolute inset-0 opacity-60 mix-blend-soft-light">
        <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute bottom-0 right-[-4rem] h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
      </div>

      {/* theme toggle */}
      <div className="absolute right-4 top-4 z-40 md:right-8 md:top-8">
        <ThemeToggle />
      </div>

      {/* LEFT – info card (can keep same as sign-in hero) */}
      <div className="relative hidden h-full flex-col border-r bg-slate-950 px-10 py-10 text-slate-50 lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_#4f46e510,_transparent_60%),radial-gradient(circle_at_bottom,_#22c55e10,_transparent_55%)]" />

        <div className="relative z-10 flex items-center gap-3 text-lg font-medium">
          {hasLight || hasDark ? (
            <>
              {hasDark && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoDark!}
                  alt={appTitle}
                  className="h-9 w-auto object-contain"
                />
              )}
              {!hasDark && hasLight && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoLight!}
                  alt={appTitle}
                  className="h-9 w-auto object-contain"
                />
              )}
            </>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500 text-sm font-bold text-white shadow-lg shadow-indigo-500/40">
              {appTitle.charAt(0)}
            </div>
          )}
          <div className="flex flex-col leading-tight">
            <span className="text-base font-semibold tracking-tight">
              {appTitle}
            </span>
            <span className="text-[11px] uppercase text-slate-400">
              Multi-tenant control hub
            </span>
          </div>
        </div>

        <div className="relative z-10 mt-10 flex flex-1 items-center">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/60 p-5 shadow-xl shadow-black/40 backdrop-blur">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-200">
              <Sparkles className="h-3 w-3" />
              First-time secure access
            </div>

            <p className="text-sm text-slate-200">
              Before you sign in for the first time, choose a strong password
              for your Hive workspace. This helps keep your tenant and files
              safe.
            </p>

            <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-slate-300">
              <div className="rounded-2xl bg-slate-800/70 p-3">
                <div className="text-[10px] text-slate-400">Security</div>
                <div className="mt-1 text-sm font-semibold text-emerald-400">
                  RBAC first
                </div>
                <div className="mt-1 text-[10px] text-slate-500">
                  Per-tenant isolation
                </div>
              </div>
              <div className="rounded-2xl bg-slate-800/70 p-3">
                <div className="text-[10px] text-slate-400">Passwords</div>
                <div className="mt-1 text-sm font-semibold">
                  Strong by default
                </div>
                <div className="mt-1 text-[10px] text-slate-500">
                  Enforced minimum length
                </div>
              </div>
              <div className="rounded-2xl bg-slate-800/70 p-3">
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <ShieldCheck className="h-3 w-3 text-emerald-400" />
                  Access
                </div>
                <div className="mt-1 text-sm font-semibold">
                  Invite-based
                </div>
                <div className="mt-1 text-[10px] text-slate-500">
                  Admin-controlled onboarding
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-auto max-w-md">
          <blockquote className="space-y-2">
            <p className="text-sm text-slate-200">
              &ldquo;New admins get a guided password setup before we allow
              access – it&apos;s a huge win for security.&rdquo;
            </p>
            <footer className="text-xs text-slate-500">
              Sofia Davis • CTO, TechFlow
            </footer>
          </blockquote>
        </div>
      </div>

      {/* RIGHT – set password card */}
      <div className="relative flex h-full items-center justify-center px-4 py-8 lg:px-10">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-slate-900/5 to-transparent dark:from-slate-900/40" />

        <div className="relative z-10 mx-auto flex w-full max-w-md flex-col space-y-6">
          <div className="hidden flex-col space-y-1 text-left lg:flex">
            <span className="inline-flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                <ShieldCheck className="h-3 w-3" />
              </span>
              First-time setup • Choose a strong password
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">
              Set your password
            </h1>
            <p className="text-xs text-muted-foreground">
              This link lets you create a password for your account. After
              saving, you&apos;ll be redirected to the sign-in page.
            </p>
          </div>

          <div className="rounded-3xl border bg-card/95 p-5 shadow-lg shadow-black/5 backdrop-blur">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="password" className="text-xs">
                  New password
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    disabled={loading}
                    value={form.password}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, password: e.target.value }))
                    }
                    className="h-10 bg-background pl-9 text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="confirmPassword" className="text-xs">
                  Confirm password
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    disabled={loading}
                    value={form.confirmPassword}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, confirmPassword: e.target.value }))
                    }
                    className="h-10 bg-background pl-9 text-sm"
                  />
                </div>
              </div>

              {form.password.length > 0 && !passwordValid && (
                <p className="text-[11px] text-destructive">
                  Password must be at least 8 characters.
                </p>
              )}

              {form.confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-[11px] text-destructive">
                  Passwords do not match.
                </p>
              )}

              {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-[11px] text-destructive">
                  {error}
                </div>
              )}

              <Button
                disabled={loading || !formValid}
                className="mt-1 h-10 w-full text-sm font-medium"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save password
              </Button>
            </form>

            <p className="mt-4 text-[11px] text-muted-foreground">
              This link can usually be used only once. If it&apos;s expired or
              already used, request a new invite or password reset from your
              administrator.
            </p>

            <div className="mt-3 text-center text-[11px] text-muted-foreground">
              Already have a password?{" "}
              <Link
                href="/sign-in"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Go to sign-in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
