"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { useState } from "react";

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackURL = searchParams.get("callbackURL") || "/";

  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await authClient.signIn.email({
      email: form.email,
      password: form.password,
      callbackURL,
    });

    setLoading(false);

    if (error) {
      setError(error.message ?? "Invalid email or password");
      return;
    }

    router.push(callbackURL);
  }

  return (
    <Card className="border-slate-800 bg-slate-900/80 p-6">
      <h1 className="text-xl font-semibold text-slate-50">Sign in</h1>
      <p className="mt-1 text-sm text-slate-400">Welcome back to Hive.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={form.password}
            onChange={(e) =>
              setForm((f) => ({ ...f, password: e.target.value }))
            }
            required
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </Button>

        <button
          type="button"
          onClick={() => router.push("/sign-up")}
          className="mt-2 w-full text-center text-sm text-slate-400 hover:text-slate-200"
        >
          Don&apos;t have an account? Sign up
        </button>
      </form>
    </Card>
  );
}
