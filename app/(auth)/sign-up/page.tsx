"use client";

import { Loader2, Lock, Mail, User } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export default function SignUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackURL = searchParams.get("callbackURL") || "/";

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = useMemo(
    () => /^\S+@\S+\.\S+$/.test(form.email.trim()),
    [form.email]
  );
  const passwordValid = useMemo(
    () => form.password.trim().length >= 8,
    [form.password]
  );
  const passwordMatch = useMemo(
    () =>
      form.password.trim().length > 0 &&
      form.password.trim() === form.confirmPassword.trim(),
    [form.password, form.confirmPassword]
  );

  const formValid =
    form.name.trim().length > 1 &&
    emailValid &&
    passwordValid &&
    passwordMatch &&
    form.acceptTerms;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!formValid) {
      setError("Please fix the highlighted fields and try again.");
      return;
    }

    setLoading(true);

    const { error } = await authClient.signUp.email({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      callbackURL,
    });

    setLoading(false);

    if (error) {
      const msg = (error.message || "").toUpperCase();
      if (msg.includes("EMAIL_IN_USE")) {
        setError("An account with this email already exists.");
      } else if (msg.includes("WEAK_PASSWORD")) {
        setError("Password is too weak. Please use at least 8 characters.");
      } else {
        setError("Unable to create your account. Please try again.");
      }
      return;
    }

    router.push(callbackURL);
  }

  return (
    <Card className="border border-slate-800/80 bg-slate-900/80 px-6 py-7 shadow-xl shadow-slate-950/40 backdrop-blur">
      <div className="mb-5 space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-slate-50">
          Create your Hive account
        </h1>
        <p className="text-sm text-slate-400">
          Get access to your workspace and start managing your team.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-xs font-medium text-slate-200">
            Full name
          </Label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              id="name"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              required
              className="h-10 border-slate-700 bg-slate-900 pl-9 text-sm text-slate-50 placeholder:text-slate-500 focus-visible:ring-slate-400"
              placeholder="Jane Doe"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="email"
            className="text-xs font-medium text-slate-200"
          >
            Work email
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
              placeholder="you@company.com"
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
              autoComplete="new-password"
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
              required
              className="h-10 border-slate-700 bg-slate-900 pl-9 text-sm text-slate-50 placeholder:text-slate-500 focus-visible:ring-slate-400"
              placeholder="At least 8 characters"
            />
          </div>
          {form.password.length > 0 && !passwordValid && (
            <p className="text-[11px] text-amber-300">
              Password must be at least 8 characters.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="confirmPassword"
            className="text-xs font-medium text-slate-200"
          >
            Confirm password
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(e) =>
              setForm((f) => ({ ...f, confirmPassword: e.target.value }))
            }
            required
            className="h-10 border-slate-700 bg-slate-900 text-sm text-slate-50 placeholder:text-slate-500 focus-visible:ring-slate-400"
            placeholder="Re-type your password"
          />
          {form.confirmPassword.length > 0 && !passwordMatch && (
            <p className="text-[11px] text-amber-300">
              Passwords do not match.
            </p>
          )}
        </div>

        <div className="flex items-start gap-2 text-xs text-slate-400">
          <input
            id="terms"
            type="checkbox"
            className="mt-0.5 h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-slate-200"
            checked={form.acceptTerms}
            onChange={(e) =>
              setForm((f) => ({ ...f, acceptTerms: e.target.checked }))
            }
          />
          <label htmlFor="terms" className="cursor-pointer">
            I agree to the{" "}
            <Link
              href="/legal/terms"
              className="font-medium text-sky-300 hover:text-sky-200"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/legal/privacy"
              className="font-medium text-sky-300 hover:text-sky-200"
            >
              Privacy Policy
            </Link>
            .
          </label>
        </div>

        {error && (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="mt-1 flex w-full items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading || !formValid}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Creating your account..." : "Create account"}
        </Button>

        <p className="mt-2 text-center text-xs text-slate-400">
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="font-medium text-sky-300 hover:text-sky-200"
          >
            Sign in
          </Link>
        </p>
      </form>
    </Card>
  );
}
