"use client";

import { Loader2, Lock, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { authClient } from "@/lib/auth-client";

/* -------------------------------------------------------------------------- */
/*  Rate-limit helpers                                                        */
/* -------------------------------------------------------------------------- */

const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 60;

type LoginLimiterState = {
  attempts: number;
  lockUntil: number | null;
};

const STORAGE_KEY = "hive_login_limiter";

function loadLimiterState(): LoginLimiterState {
  if (typeof window === "undefined") return { attempts: 0, lockUntil: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { attempts: 0, lockUntil: null };
    return JSON.parse(raw) as LoginLimiterState;
  } catch {
    return { attempts: 0, lockUntil: null };
  }
}

function saveLimiterState(state: LoginLimiterState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

type SignInClientProps = {
  brand?: {
    titleText?: string | null;
    logoLightUrl?: string | null;
    logoDarkUrl?: string | null;
    faviconUrl?: string | null;
  } | null;
};

export function SignInClient({ brand }: SignInClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  /* ------------------------------------------------------------------------ */
  /*  Branding                                                                */
  /* ------------------------------------------------------------------------ */

  const appTitle = brand?.titleText?.trim() || "Hive";
  const logoLight = brand?.logoLightUrl || null;
  const logoDark = brand?.logoDarkUrl || null;
  const hasLight = !!logoLight;
  const hasDark = !!logoDark;

  const rawCallback = searchParams.get("callbackURL")?.toString() ?? null;
  const callbackURL =
    !rawCallback || rawCallback === "/" ? "/dashboard" : rawCallback;

  /* ------------------------------------------------------------------------ */
  /*  State                                                                   */
  /* ------------------------------------------------------------------------ */

  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [limiter, setLimiter] = useState<LoginLimiterState>({
    attempts: 0,
    lockUntil: null,
  });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const initial = loadLimiterState();
    setLimiter(initial);

    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // sign-out + limiter reset when ?switch=1
  useEffect(() => {
    if (searchParams.get("switch") === "1") {
      (async () => {
        try {
          await authClient.signOut();
        } catch (e) {
          console.error(e);
        } finally {
          const reset = { attempts: 0, lockUntil: null };
          setLimiter(reset);
          saveLimiterState(reset);
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.delete("switch");
            window.history.replaceState(null, "", url.toString());
          }
        }
      })();
    }
  }, [searchParams]);

  /* ------------------------------------------------------------------------ */
  /*  Limiter + validation                                                    */
  /* ------------------------------------------------------------------------ */

  const isLocked = useMemo(
    () => (limiter.lockUntil ? limiter.lockUntil > now : false),
    [limiter.lockUntil, now]
  );

  const remainingSeconds = useMemo(() => {
    if (!limiter.lockUntil) return 0;
    return Math.max(0, Math.floor((limiter.lockUntil - now) / 1000));
  }, [limiter.lockUntil, now]);

  const emailValid = useMemo(
    () => /^\S+@\S+\.\S+$/.test(form.email.trim()),
    [form.email]
  );

  const passwordValid = useMemo(
    () => form.password.trim().length >= 8,
    [form.password]
  );

  const formValid = emailValid && passwordValid && !isLocked;

  function updateLimiterOnFailure() {
    setLimiter((prev) => {
      const attempts = prev.attempts + 1;
      const willLock = attempts >= MAX_ATTEMPTS;
      const next: LoginLimiterState = {
        attempts,
        lockUntil: willLock
          ? Date.now() + LOCK_SECONDS * 1000
          : prev.lockUntil,
      };
      saveLimiterState(next);
      return next;
    });
  }

  function resetLimiterOnSuccess() {
    const reset = { attempts: 0, lockUntil: null };
    setLimiter(reset);
    saveLimiterState(reset);
  }

  /* ------------------------------------------------------------------------ */
  /*  Submit                                                                  */
  /* ------------------------------------------------------------------------ */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (isLocked) {
      setError(
        `Too many login attempts. Please try again in ${remainingSeconds}s.`
      );
      return;
    }

    if (!formValid) {
      setError("Please provide a valid email and password.");
      return;
    }

    setLoading(true);

    const { error } = await authClient.signIn.email({
      email: form.email.trim(),
      password: form.password,
      callbackURL,
    });

    setLoading(false);

    if (error) {
      const msg = (error.message || "").toUpperCase();

      if (msg.includes("USER_INACTIVE")) {
        setError(
          "Your account is currently disabled. Please contact your administrator."
        );
      } else if (msg.includes("USER_DELETED") || msg.includes("NOT_FOUND")) {
        setError("Account not found.");
      } else if (
        msg.includes("INVALID_CREDENTIALS") ||
        msg.includes("CREDENTIALS")
      ) {
        setError("Invalid email or password.");
      } else if (msg.includes("TOO_MANY_ATTEMPTS")) {
        setError("Too many login attempts.");
      } else {
        setError("Unable to sign in. Please try again.");
      }

      updateLimiterOnFailure();
      return;
    }

    resetLimiterOnSuccess();
    router.replace(callbackURL);
  }

  /* ------------------------------------------------------------------------ */
  /*  UI                                                                      */
  /* ------------------------------------------------------------------------ */

  return (
    // 🔥 Full viewport, ignore parent max-widths
    <div className="fixed inset-0 z-0 grid min-h-screen w-screen overflow-hidden bg-background text-foreground lg:grid-cols-2">
      {/* subtle gradient blobs */}
      <div className="pointer-events-none absolute inset-0 opacity-60 mix-blend-soft-light">
        <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute bottom-0 right-[-4rem] h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
      </div>

      {/* theme toggle */}
      <div className="absolute right-4 top-4 z-40 md:right-8 md:top-8">
        <ThemeToggle />
      </div>

      {/* LEFT – brand / hero */}
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
              Trusted workspace access
            </div>

            <p className="text-sm text-slate-200">
              Sign in once and securely manage all your tenants, users, and
              files from a single dashboard. Roles, permissions, and security
              rules are applied automatically.
            </p>

            <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-slate-300">
              <div className="rounded-2xl bg-slate-800/70 p-3">
                <div className="text-[10px] text-slate-400">Latency</div>
                <div className="mt-1 text-sm font-semibold text-emerald-400">
                  &lt; 80 ms
                </div>
                <div className="mt-1 text-[10px] text-slate-500">
                  Across regions
                </div>
              </div>
              <div className="rounded-2xl bg-slate-800/70 p-3">
                <div className="text-[10px] text-slate-400">Tenants</div>
                <div className="mt-1 text-sm font-semibold">10k+</div>
                <div className="mt-1 text-[10px] text-slate-500">
                  Isolated workspaces
                </div>
              </div>
              <div className="rounded-2xl bg-slate-800/70 p-3">
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <ShieldCheck className="h-3 w-3 text-emerald-400" />
                  Security
                </div>
                <div className="mt-1 text-sm font-semibold">RBAC first</div>
                <div className="mt-1 text-[10px] text-slate-500">
                  Fine-grained access
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-auto max-w-md">
          <blockquote className="space-y-2">
            <p className="text-sm text-slate-200">
              &ldquo;Hive centralizes everything for our teams. One login,
              multiple tenants, full audit trail.&rdquo;
            </p>
            <footer className="text-xs text-slate-500">
              Sofia Davis • CTO, TechFlow
            </footer>
          </blockquote>
        </div>
      </div>

      {/* RIGHT – auth card */}
      <div className="relative flex h-full items-center justify-center px-4 py-8 lg:px-10">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-slate-900/5 to-transparent dark:from-slate-900/40" />

        {/* 🔥 wider card: max-w-md instead of max-w-sm */}
        <div className="relative z-10 mx-auto flex w-full max-w-md flex-col space-y-6">
          {/* mobile brand */}
          <div className="flex flex-col items-center space-y-2 text-center lg:hidden">
            {hasLight || hasDark ? (
              <>
                {hasLight && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoLight!}
                    alt={appTitle}
                    className="h-9 w-auto dark:hidden"
                  />
                )}
                {hasDark && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoDark!}
                    alt={appTitle}
                    className="hidden h-9 w-auto dark:block"
                  />
                )}
              </>
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500 text-sm font-bold text-white shadow-md shadow-indigo-500/40">
                {appTitle.charAt(0)}
              </div>
            )}

            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">
                Welcome back
              </h1>
              <p className="text-xs text-muted-foreground">
                Sign in to continue to {appTitle}
              </p>
            </div>
          </div>

          {/* desktop heading */}
          <div className="hidden flex-col space-y-1 text-left lg:flex">
            <span className="inline-flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                <ShieldCheck className="h-3 w-3" />
              </span>
              Secure sign-in • Role-aware access
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">
              Sign in to your workspace
            </h1>
            <p className="text-xs text-muted-foreground">
              Use your email and password to access your tenants and files.
            </p>
          </div>

          {/* main card */}
          <div className="rounded-3xl border bg-card/95 p-5 shadow-lg shadow-black/5 backdrop-blur">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-xs">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    placeholder="you@company.com"
                    type="email"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect="off"
                    disabled={loading || isLocked}
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    className="h-10 bg-background pl-9 text-sm"
                  />
                </div>
                {!emailValid && form.email.length > 0 && (
                  <p className="text-[11px] text-destructive">
                    Please enter a valid email address.
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between text-xs">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-[11px] text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    placeholder="••••••••"
                    type="password"
                    autoComplete="current-password"
                    disabled={loading || isLocked}
                    value={form.password}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, password: e.target.value }))
                    }
                    className="h-10 bg-background pl-9 text-sm"
                  />
                </div>
                {form.password.length > 0 && !passwordValid && (
                  <p className="text-[11px] text-destructive">
                    Password must be at least 8 characters.
                  </p>
                )}
              </div>

              {isLocked && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-700 dark:text-amber-300">
                  Too many attempts. Please wait{" "}
                  <span className="font-semibold">{remainingSeconds}s</span>{" "}
                  before trying again.
                </div>
              )}

              {error && !isLocked && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-[11px] text-destructive">
                  {error}
                </div>
              )}

              <Button
                disabled={loading || !formValid || isLocked}
                className="mt-1 h-10 w-full text-sm font-medium"
              >
                {loading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Sign in
              </Button>
            </form>

            <div className="mt-5 space-y-2 text-center text-xs text-muted-foreground">
              <div>
                Don&apos;t have an account?{" "}
                <Link
                  href="/sign-up"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Request access
                </Link>
              </div>
              <div className="mt-1 text-[11px] leading-relaxed">
                By continuing, you agree to our{" "}
                <Link
                  href="/terms"
                  className="underline underline-offset-2 hover:text-primary"
                >
                  Terms
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  className="underline underline-offset-2 hover:text-primary"
                >
                  Privacy Policy
                </Link>
                .
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
