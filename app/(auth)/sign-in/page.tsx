"use client";

import { Loader2, Lock, Mail } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

// Simple client-side limiter: 5 attempts → 60s lock
const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 60;

type LoginLimiterState = {
  attempts: number;
  lockUntil: number | null; // timestamp (ms)
};

const STORAGE_KEY = "hive_login_limiter";

function loadLimiterState(): LoginLimiterState {
  if (typeof window === "undefined") return { attempts: 0, lockUntil: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { attempts: 0, lockUntil: null };
    const parsed = JSON.parse(raw) as LoginLimiterState;
    return {
      attempts: parsed.attempts ?? 0,
      lockUntil: parsed.lockUntil ?? null,
    };
  } catch {
    return { attempts: 0, lockUntil: null };
  }
}

function saveLimiterState(state: LoginLimiterState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackURL = searchParams.get("callbackURL") || "/";

  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // limiter state
  const [limiter, setLimiter] = useState<LoginLimiterState>({
    attempts: 0,
    lockUntil: null,
  });
  const [now, setNow] = useState(Date.now());

  // Load limiter state from localStorage on mount
  useEffect(() => {
    const initial = loadLimiterState();
    setLimiter(initial);

    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const isLocked = useMemo(() => {
    if (!limiter.lockUntil) return false;
    return limiter.lockUntil > now;
  }, [limiter.lockUntil, now]);

  const remainingSeconds = useMemo(() => {
    if (!limiter.lockUntil) return 0;
    const diff = Math.max(0, Math.floor((limiter.lockUntil - now) / 1000));
    return diff;
  }, [limiter.lockUntil, now]);

  // basic validation
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
        lockUntil: willLock ? Date.now() + LOCK_SECONDS * 1000 : prev.lockUntil,
      };
      saveLimiterState(next);
      return next;
    });
  }

  function resetLimiterOnSuccess() {
    const reset: LoginLimiterState = { attempts: 0, lockUntil: null };
    setLimiter(reset);
    saveLimiterState(reset);
  }

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
      setError("Please provide a valid email and password (min 8 characters).");
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

      // map backend error codes/messages to user-friendly text
      if (msg.includes("USER_INACTIVE")) {
        setError(
          "Your account is currently disabled. Please contact your administrator."
        );
      } else if (msg.includes("USER_DELETED") || msg.includes("NOT_FOUND")) {
        setError("This account no longer exists.");
      } else if (msg.includes("INVALID_CREDENTIALS") || msg.includes("CREDENTIALS")) {
        setError("Invalid email or password.");
      } else if (msg.includes("TOO_MANY_ATTEMPTS")) {
        setError(
          "Too many login attempts. Please wait a moment before trying again."
        );
      } else {
        setError("Unable to sign in right now. Please try again.");
      }

      updateLimiterOnFailure();
      return;
    }

    // success → reset limiter and redirect
    resetLimiterOnSuccess();
    router.push(callbackURL);
  }

  return (
    <Card className="border border-slate-800/80 bg-slate-900/80 px-6 py-7 shadow-xl shadow-slate-950/40 backdrop-blur">
      <div className="mb-5 space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-slate-50">
          Sign in to your account
        </h1>
        <p className="text-sm text-slate-400">
          Use your Hive admin credentials to access your workspace.
        </p>
      </div>

      {isLocked && (
        <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Too many failed attempts. Please wait{" "}
          <span className="font-semibold">{remainingSeconds}s</span> before
          trying again.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-medium text-slate-200">
            Email address
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
              required
              className="h-10 border-slate-700 bg-slate-900 pl-9 text-sm text-slate-50 placeholder:text-slate-500 focus-visible:ring-slate-400"
              placeholder="you@example.com"
            />
          </div>
          {!emailValid && form.email.length > 0 && (
            <p className="text-[11px] text-amber-300">
              Please enter a valid email address.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="password"
            className="text-xs font-medium text-slate-200"
          >
            Password
          </Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
              required
              className="h-10 border-slate-700 bg-slate-900 pl-9 text-sm text-slate-50 placeholder:text-slate-500 focus-visible:ring-slate-400"
              placeholder="••••••••"
            />
          </div>
          {form.password.length > 0 && !passwordValid && (
            <p className="text-[11px] text-amber-300">
              Password must be at least 8 characters.
            </p>
          )}
        </div>

        {error && (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between text-xs text-slate-400">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-slate-200"
              // Frontend only “remember me”. For real persistent sessions,
              // wire this into your auth config.
              onChange={() => {
                /* placeholder if you want to use later */
              }}
            />
            <span>Remember this device</span>
          </label>
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-sky-300 hover:text-sky-200"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          className="mt-1 flex w-full items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading || !formValid}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Signing you in..." : "Sign in"}
        </Button>

        <p className="mt-2 text-center text-xs text-slate-400">
          Don&apos;t have an account?{" "}
          <Link
            href="/sign-up"
            className="font-medium text-sky-300 hover:text-sky-200"
          >
            Request access
          </Link>
        </p>
      </form>
    </Card>
  );
}
