"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { verifyTwoFactorLoginAction } from "./_actions";

export default function TwoFactorClient({ callbackURL }: { callbackURL: string }) {
  const [code, setCode] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (trimmed.length !== 6) return;

    startTransition(async () => {
      try {
        await verifyTwoFactorLoginAction(trimmed);
        toast.success("Two-factor authentication verified");
        router.replace(callbackURL);
      } catch (e: any) {
        toast.error(e?.message ?? "Invalid code, please try again.");
      }
    });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <h1 className="text-base font-semibold">Two-Factor Verification</h1>
            <p className="text-xs text-muted-foreground">
              Enter the 6-digit code from your authenticator app.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp" className="text-xs">
              Authentication Code
            </Label>
            <Input
              id="otp"
              inputMode="numeric"
              autoFocus
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/[^0-9]/g, ""))
              }
              className="text-center text-lg tracking-[0.5em] font-mono"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-9 text-sm"
            disabled={isPending || code.trim().length !== 6}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verify & Continue
          </Button>
        </form>

        <p className="mt-3 text-[11px] text-muted-foreground text-center">
          If you lost access to your authenticator device, contact your
          administrator to reset your 2FA.
        </p>
      </div>
    </div>
  );
}
