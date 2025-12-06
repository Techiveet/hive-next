"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Ban,
  CheckCircle,
  Copy,
  QrCode,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Upload,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  changePasswordAction,
  disableTwoFactorAction,
  enableTwoFactorAction,
  generateTwoFactorSecretAction,
  regenerateRecoveryCodesAction,
  updateProfileAction,
  verifyPasswordAction,
} from "./_actions";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type UserProfile = {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
  twoFactorEnabled?: boolean | null;
  twoFactorRecoveryCodes?: string | null;
};

type QrData = { secret: string; qrCodeUrl: string };

type PasswordModalMode = "ENABLE" | "DISABLE" | "REGEN" | "SHOW_QR" | null;
type TabValue = "general" | "password" | "security";

export default function ProfileClient({ user }: { user: UserProfile }) {
  const [isPending, startTransition] = useTransition();

  const router = useRouter();
  const searchParams = useSearchParams();

  // ======== TAB PERSISTENCE =========
  const initialTab = (searchParams.get("tab") as TabValue | null) ?? "general";
  const [tab, setTab] = useState<TabValue>(initialTab);

  const handleTabChange = (value: string) => {
    const next = (value as TabValue) || "general";
    setTab(next);

    const params = new URLSearchParams(searchParams.toString());
    if (next === "general") {
      // Optional: keep URL clean by removing tab when default
      params.delete("tab");
    } else {
      params.set("tab", next);
    }

    router.replace(`/profile?${params.toString()}`, { scroll: false });
  };

  // --- GENERAL STATE ---
  const [name, setName] = useState(user?.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string>(user?.image ?? "");
  const avatarPreview = avatarUrl || user?.image || "";

  const [pass, setPass] = useState({ current: "", new: "", confirm: "" });

  // --- 2FA STATE ---
  const [is2faEnabled, setIs2faEnabled] = useState(!!user?.twoFactorEnabled);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>(
    user?.twoFactorRecoveryCodes
      ? user.twoFactorRecoveryCodes.split(",")
      : []
  );

  const [passwordModalMode, setPasswordModalMode] =
    useState<PasswordModalMode>(null);
  const [passwordInput, setPasswordInput] = useState("");

  const [qrData, setQrData] = useState<QrData | null>(null);
  const [otpCode, setOtpCode] = useState("");

  const hasQrOpen = !!qrData;

  // ========= GENERAL HANDLERS =========

  // Use File Manager like in the Users modal
  const handlePickAvatar = () => {
    if (typeof window === "undefined") return;

    window.dispatchEvent(
      new CustomEvent("open-file-manager", {
        detail: {
          filter: "images" as const,
          onSelect: (file: { url: string; id?: string; name?: string }) => {
            setAvatarUrl(file.url);
          },
        },
      })
    );
  };

  const handleUpdateProfile = () => {
    const formData = new FormData();
    formData.append("name", name);
    if (avatarUrl) {
      formData.append("avatarUrl", avatarUrl);
    }

    startTransition(async () => {
      try {
        await updateProfileAction(formData);
        toast.success("Profile updated");
      } catch {
        toast.error("Failed to update profile");
      }
    });
  };

  const handleChangePassword = () => {
    if (pass.new !== pass.confirm) {
      toast.error("New passwords do not match");
      return;
    }

    startTransition(async () => {
      try {
        await changePasswordAction(pass.current, pass.new);
        toast.success("Password changed successfully");
        setPass({ current: "", new: "", confirm: "" });
      } catch (e: any) {
        toast.error(e.message ?? "Failed to change password");
      }
    });
  };

  // ========= 2FA FLOW =========

  const openPasswordModal = (mode: Exclude<PasswordModalMode, null>) => {
    setPasswordInput("");
    setPasswordModalMode(mode);
  };

  const handlePasswordSubmit = () => {
    if (!passwordInput || !passwordModalMode) return;

    startTransition(async () => {
      const isValid = await verifyPasswordAction(passwordInput);
      if (!isValid) {
        toast.error("Incorrect password");
        return;
      }

      const mode = passwordModalMode;
      setPasswordModalMode(null);

      try {
        switch (mode) {
          case "ENABLE":
          case "SHOW_QR": {
            const data = await generateTwoFactorSecretAction();
            setQrData(data);
            break;
          }
          case "DISABLE": {
            await disableTwoFactorAction();
            setIs2faEnabled(false);
            setRecoveryCodes([]);
            setQrData(null);
            toast.success("2FA disabled");
            break;
          }
          case "REGEN": {
            const res = await regenerateRecoveryCodesAction();
            setRecoveryCodes(res.recoveryCodes);
            toast.success("Recovery codes regenerated");
            break;
          }
        }
      } catch (e: any) {
        toast.error(e.message ?? "Action failed");
      }
    });
  };

  const handleVerifyAndEnable = () => {
    if (!qrData || otpCode.length !== 6) return;

    startTransition(async () => {
      try {
        const res = await enableTwoFactorAction(qrData.secret, otpCode);
        setIs2faEnabled(true);
        setRecoveryCodes(res.recoveryCodes);
        setQrData(null);
        setOtpCode("");
        toast.success("2FA enabled successfully");
      } catch (e: any) {
        toast.error(e.message ?? "Failed to enable 2FA");
      }
    });
  };

  const copyCodes = () => {
    if (!recoveryCodes.length) return;
    navigator.clipboard.writeText(recoveryCodes.join("\n"));
    toast.success("Codes copied to clipboard");
  };

  // ========= RENDER =========

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-8">
      {/* HEADER */}
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16 border-2 border-white shadow-md">
          {avatarPreview ? (
            <AvatarImage src={avatarPreview} className="object-cover" />
          ) : null}
          <AvatarFallback className="text-lg font-bold bg-indigo-100 text-indigo-700">
            {user.name?.substring(0, 2).toUpperCase() || "US"}
          </AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {user.name ?? user.email}
          </h2>
          <p className="text-muted-foreground">{user.email}</p>
        </div>
      </div>

      {/* TABS */}
      <Tabs
        value={tab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="password">Password</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        {/* GENERAL */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Information</CardTitle>
              <CardDescription>
                Update your profile details and public avatar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar + Change button */}
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20">
                  {avatarPreview ? (
                    <AvatarImage src={avatarPreview} />
                  ) : null}
                  <AvatarFallback>
                    {user.name?.substring(0, 2).toUpperCase() || "US"}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Profile Photo
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handlePickAvatar}
                    className="inline-flex items-center"
                  >
                    <Upload className="mr-2 h-4 w-4" /> Choose from File Manager
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    Recommended: square image, at least 256×256.
                  </p>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Display Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div className="grid gap-2">
                <Label>Email Address</Label>
                <Input
                  value={user.email}
                  disabled
                  className="bg-muted text-muted-foreground"
                />
              </div>
            </CardContent>
            <CardFooter className="border-t bg-muted/10 px-6 py-4">
              <Button onClick={handleUpdateProfile} disabled={isPending}>
                Save Changes
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* PASSWORD */}
        <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Ensure your account is using a strong password.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Current Password</Label>
                <Input
                  type="password"
                  value={pass.current}
                  onChange={(e) =>
                    setPass((prev) => ({ ...prev, current: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>New Password</Label>
                <Input
                  type="password"
                  value={pass.new}
                  onChange={(e) =>
                    setPass((prev) => ({ ...prev, new: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Confirm New Password</Label>
                <Input
                  type="password"
                  value={pass.confirm}
                  onChange={(e) =>
                    setPass((prev) => ({ ...prev, confirm: e.target.value }))
                  }
                />
              </div>
            </CardContent>
            <CardFooter className="border-t bg-muted/10 px-6 py-4">
              <Button
                onClick={handleChangePassword}
                disabled={isPending || !pass.current || !pass.new}
              >
                Update Password
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* SECURITY / 2FA */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-indigo-600" />
                Two-Factor Authentication
              </CardTitle>
              <CardDescription>
                Secure your account with TOTP (Google Authenticator, Authy).
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {is2faEnabled ? (
                <div className="space-y-6">
                  {/* status */}
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-full">
                      <CheckCircle className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-emerald-800">
                        2FA is Active
                      </h4>
                      <p className="text-xs text-emerald-700">
                        Your account is protected.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* recovery codes */}
                    <div className="p-4 border rounded-lg space-y-3">
                      <h4 className="font-medium text-sm">Recovery Codes</h4>

                      {recoveryCodes.length ? (
                        <div className="space-y-3">
                          <p className="text-xs text-amber-800 flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-amber-600" />
                            Store these codes safely.
                          </p>
                          <div className="grid grid-cols-2 gap-2 font-mono text-xs bg-slate-50 p-3 rounded border">
                            {recoveryCodes.map((code) => (
                              <div
                                key={code}
                                className="bg-white border rounded px-2 py-1 text-center text-slate-700 select-all"
                              >
                                {code}
                              </div>
                            ))}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={copyCodes}
                            className="w-full"
                          >
                            <Copy className="mr-2 h-3.5 w-3.5" /> Copy All Codes
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Codes are not currently available.
                        </p>
                      )}

                      <div className="pt-2 border-t mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPasswordModal("REGEN")}
                          className="w-full"
                        >
                          <RefreshCw className="mr-2 h-3.5 w-3.5" /> Regenerate
                          Codes
                        </Button>
                      </div>
                    </div>

                    {/* disable / view qr */}
                    <div className="p-4 border rounded-lg border-red-100 bg-red-50/30 space-y-3">
                      <h4 className="font-medium text-sm text-red-900">
                        Disable 2FA / New Device
                      </h4>

                      <div className="flex flex-col items-center gap-2 pt-2 pb-3">
                        <p className="text-[10px] text-red-700 text-center">
                          Need to set up a new phone? This generates a new
                          secret and QR code.
                        </p>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openPasswordModal("SHOW_QR")}
                          className="w-full"
                        >
                          <QrCode className="mr-2 h-3.5 w-3.5" /> View Setup QR
                        </Button>
                      </div>

                      <p className="text-xs text-red-700 mb-4">
                        Turning off 2FA reduces your security significantly.
                      </p>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => openPasswordModal("DISABLE")}
                        className="w-full"
                      >
                        <Ban className="mr-2 h-3.5 w-3.5" /> Disable 2FA
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                !hasQrOpen && (
                  <div className="flex flex-col items-center justify-center py-8 text-center space-y-4 bg-slate-50 rounded-lg border border-dashed">
                    <ShieldAlert className="h-8 w-8 text-slate-400 mb-2" />
                    <h3 className="font-medium text-slate-900">
                      2FA is not enabled
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Protect your account with a secondary factor.
                    </p>
                    <Button onClick={() => openPasswordModal("ENABLE")}>
                      Setup Two-Factor Authentication
                    </Button>
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* PASSWORD CONFIRMATION DIALOG */}
      <Dialog
        open={!!passwordModalMode}
        onOpenChange={(open) => {
          if (!open) setPasswordModalMode(null);
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Password</DialogTitle>
            <DialogDescription>
              For your security, please confirm your password to continue.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="mb-2 block">Password</Label>
            <Input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setPasswordModalMode(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePasswordSubmit}
              disabled={isPending || !passwordInput}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR CODE / SETUP DIALOG */}
      <Dialog
        open={hasQrOpen}
        onOpenChange={(open) => {
          if (!open) {
            setQrData(null);
            setOtpCode("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {is2faEnabled
                ? "Re-scan Authenticator App"
                : "Setup Authenticator App"}
            </DialogTitle>
            <DialogDescription>
              {is2faEnabled
                ? "Scan this code on your new device."
                : "Scan the QR code below and verify."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrData && (
              <div className="p-2 bg-white border rounded shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrData.qrCodeUrl}
                  alt="QR Code"
                  width={192}
                  height={192}
                />
              </div>
            )}
            <div className="text-center w-full">
              <p className="text-xs text-muted-foreground mb-2">Manual Key:</p>
              <code className="bg-muted px-2 py-1 rounded text-xs font-mono block w-full text-center break-all">
                {qrData?.secret}
              </code>
            </div>

            {!is2faEnabled && (
              <div className="w-full space-y-2">
                <Label>Verify Code</Label>
                <Input
                  placeholder="000000"
                  className="text-center text-lg tracking-[0.5em] font-mono"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) =>
                    setOtpCode(e.target.value.replace(/[^0-9]/g, ""))
                  }
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setQrData(null);
                setOtpCode("");
              }}
            >
              {is2faEnabled ? "Close" : "Cancel Setup"}
            </Button>
            {!is2faEnabled && (
              <Button
                onClick={handleVerifyAndEnable}
                disabled={isPending || otpCode.length !== 6}
              >
                Verify &amp; Enable
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
