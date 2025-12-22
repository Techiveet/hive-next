// app/(dashboard)/dashboard/offline-test/offline-test-client.tsx
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, Server, Wifi } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NetworkTestPanel } from "@/components/offline/network-test-panel";
import { OfflineTestSuite } from "@/components/offline/offline-test-suite";
import { offlineFetch } from "@/lib/offline/offline-api";
import { toast } from "sonner";
import { useOffline } from "@/lib/offline/use-offline";

type Item = { id: string; name: string; email: string; createdAt: string };

const SYNC_TOAST_ID = "offline-test-sync";
const STATUS_TOAST_ID = "offline-status";

// Helper to safely format dates (avoiding hydration mismatch)
function formatDateSafe(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

export function OfflineTestClient() {
  const { isOnline, pending, isSyncing, syncOfflineData, hasInternet, hasServer } = useOffline();

  const [isClient, setIsClient] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showTestSuite, setShowTestSuite] = useState(false);

  const prevIsOnlineRef = useRef<boolean | undefined>(undefined);
  const autoSyncLockRef = useRef(false);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const offlineReason = useMemo(() => {
    if (isOnline === undefined) return null;
    if (isOnline) return null;
    if (hasInternet === false) return "No internet";
    if (hasServer === false) return "Server unreachable";
    return "Offline";
  }, [isOnline, hasInternet, hasServer]);

  async function loadList() {
    setLoadingList(true);
    try {
      const res = await fetch("/api/offline-test", {
        cache: "no-store",
        credentials: "include",
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
        },
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const json = await res.json();
      setItems(json?.items || []);
      hasLoadedRef.current = true;
    } catch (err) {
      console.error("[OfflineTest] loadList error:", err);
      toast.error("Failed to load DB list");
    } finally {
      setLoadingList(false);
    }
  }

  // list only when online AND mounted (client-side only)
  useEffect(() => {
    if (!isClient) return;
    if (isOnline === undefined) return; // Wait until we know online status
    
    if (isOnline && !hasLoadedRef.current) {
      void loadList();
    } else if (isOnline === false) {
      setItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, isClient]);

  // offline/online transition toasts (NO LOOP)
  useEffect(() => {
    // Skip during initial render or if not mounted or still hydrating
    if (!isClient || isOnline === undefined) return;
    
    const prev = prevIsOnlineRef.current;
    if (prev === undefined) {
      prevIsOnlineRef.current = isOnline;
      return;
    }

    if (prev === true && isOnline === false) {
      toast.error("You're offline", {
        id: STATUS_TOAST_ID,
        description: `${offlineReason || "Offline"}. Changes will be saved locally.`,
        duration: 3500,
      });
    }

    if (prev === false && isOnline === true) {
      toast.success("Back online", {
        id: STATUS_TOAST_ID,
        description: pending > 0 ? `Found ${pending} queued item(s). Syncing…` : "All set.",
        duration: 2500,
      });
    }

    prevIsOnlineRef.current = isOnline;
  }, [isOnline, offlineReason, pending, isClient]);

  // auto sync ONLY on OFFLINE -> ONLINE
  useEffect(() => {
    // Skip if not mounted or still hydrating
    if (!isClient || isOnline === undefined) return;
    
    const prev = prevIsOnlineRef.current;
    if (prev !== false || isOnline !== true) return; // only transition
    if (pending <= 0) return;
    if (isSyncing) return;
    if (autoSyncLockRef.current) return;

    autoSyncLockRef.current = true;

    (async () => {
      toast.loading(`Syncing ${pending} item${pending > 1 ? "s" : ""}…`, {
        id: SYNC_TOAST_ID,
        duration: Infinity,
      });

      try {
        const result: any = await syncOfflineData(true);
        const synced = Number(result?.synced || 0);
        const failed = Number(result?.failed || 0);

        if (synced > 0 && failed === 0) {
          toast.success("Saved to database", {
            id: SYNC_TOAST_ID,
            description: `Synced ${synced} item${synced > 1 ? "s" : ""}.`,
            duration: 3000,
          });
          await loadList();
          return;
        }

        if (synced > 0 && failed > 0) {
          toast.warning("Partial sync", {
            id: SYNC_TOAST_ID,
            description: `Synced ${synced}, failed ${failed}.`,
            duration: 4000,
          });
          await loadList();
          return;
        }

        if (failed > 0) {
          toast.error("Sync failed", {
            id: SYNC_TOAST_ID,
            description: `Failed ${failed} item${failed > 1 ? "s" : ""}.`,
            duration: 4000,
          });
          return;
        }

        toast.message("Nothing to sync", { id: SYNC_TOAST_ID, duration: 2000 });
      } catch (e: any) {
        toast.error("Sync failed", {
          id: SYNC_TOAST_ID,
          description: e?.message || "Unknown",
          duration: 4000,
        });
      } finally {
        autoSyncLockRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, isClient]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    const t = toast.loading(isOnline ? "Saving…" : "Saving locally…");
    setSubmitting(true);

    try {
      const res = await offlineFetch("/api/offline-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, email: trimmedEmail }),
      });

      if (res.status === 202) {
        toast.success("Saved locally", { id: t, description: "Queued for sync." });
        setName("");
        setEmail("");
        return;
      }

      if (res.ok) {
        toast.success("Saved to database", { id: t });
        setName("");
        setEmail("");
        await loadList();
        return;
      }

      toast.error("Failed", { id: t, description: `Status ${res.status}` });
    } catch (err: any) {
      console.error("[OfflineTest] submit error:", err);
      toast.error("Submit crashed", { id: t, description: err?.message || "Unknown" });
    } finally {
      setSubmitting(false);
    }
  }

  async function manualSync() {
    toast.loading("Syncing…", { id: SYNC_TOAST_ID, duration: Infinity });

    try {
      const result: any = await syncOfflineData(true);
      const synced = Number(result?.synced || 0);
      const failed = Number(result?.failed || 0);

      if (synced > 0 && failed === 0) {
        toast.success("Saved to database", {
          id: SYNC_TOAST_ID,
          description: `Synced ${synced} item${synced > 1 ? "s" : ""}.`,
        });
        if (isOnline) await loadList();
        return;
      }

      if (synced > 0 && failed > 0) {
        toast.warning("Partial sync", {
          id: SYNC_TOAST_ID,
          description: `Synced ${synced}, failed ${failed}.`,
        });
        if (isOnline) await loadList();
        return;
      }

      if (failed > 0) {
        toast.error("Sync failed", {
          id: SYNC_TOAST_ID,
          description: `Failed ${failed} item${failed > 1 ? "s" : ""}.`,
        });
        return;
      }

      toast.message("Nothing to sync", { id: SYNC_TOAST_ID, duration: 2000 });
    } catch (e: any) {
      toast.error("Sync failed", { id: SYNC_TOAST_ID, description: e?.message || "Unknown" });
    }
  }

  // During SSR, render the actual Button component but disabled/inert
  // This ensures the HTML structure matches exactly
  const ShowTestSuiteButton = ({ isClient }: { isClient: boolean }) => {
    if (!isClient) {
      return (
        <Button variant="outline" disabled className="opacity-0 pointer-events-none">
          &nbsp;
        </Button>
      );
    }
    
    return (
      <Button variant="outline" onClick={() => setShowTestSuite((v) => !v)}>
        {showTestSuite ? "Hide Test Suite" : "Show Test Suite"}
      </Button>
    );
  };

  // Status indicator that works during SSR
  const StatusIndicator = ({ isClient, isOnline }: { isClient: boolean; isOnline: boolean | undefined }) => {
    if (!isClient) {
      return <div className="h-2 w-2 rounded-full" />;
    }
    
    if (isOnline === undefined) {
      return <div className="h-2 w-2 rounded-full bg-gray-300" />;
    }
    
    return <div className={`h-2 w-2 rounded-full ${isOnline ? "bg-green-500" : "bg-red-500"}`} />;
  };

  // Status text that works during SSR
  const StatusText = ({ isClient, isOnline }: { isClient: boolean; isOnline: boolean | undefined }) => {
    if (!isClient) {
      return <span className="text-sm font-medium">&nbsp;</span>;
    }
    
    if (isOnline === undefined) {
      return <span className="text-sm font-medium">Checking...</span>;
    }
    
    return <span className="text-sm font-medium">Status</span>;
  };

  // Status value text
  const StatusValue = ({ isClient, isOnline }: { isClient: boolean; isOnline: boolean | undefined }) => {
    if (!isClient) {
      return <div className="text-lg font-semibold">&nbsp;</div>;
    }
    
    if (isOnline === undefined) {
      return <div className="text-lg font-semibold">Checking...</div>;
    }
    
    return <div className="text-lg font-semibold">{isOnline ? "Online" : "Offline"}</div>;
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Offline-First Testing</h1>
        <p className="text-muted-foreground">Test and validate your offline capabilities</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Connection Status
          </CardTitle>
          <CardDescription>Real-time monitoring of your connection state</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2 p-4 rounded-lg border">
              <div className="flex items-center gap-2">
                <StatusIndicator isClient={isClient} isOnline={isOnline} />
                <StatusText isClient={isClient} isOnline={isOnline} />
              </div>
              <StatusValue isClient={isClient} isOnline={isOnline} />
              {isClient && !isOnline ? (
                <div className="text-xs text-muted-foreground">{offlineReason}</div>
              ) : null}
            </div>

            <div className="space-y-2 p-4 rounded-lg border">
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4" />
                <span className="text-sm font-medium">Internet</span>
              </div>
              <div className={`text-lg font-semibold ${
                !isClient || hasInternet === undefined 
                  ? "text-gray-400" 
                  : hasInternet 
                    ? "text-green-600" 
                    : "text-red-600"
              }`}>
                {!isClient || hasInternet === undefined 
                  ? "—" 
                  : hasInternet 
                    ? "Connected" 
                    : "Disconnected"}
              </div>
            </div>

            <div className="space-y-2 p-4 rounded-lg border">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4" />
                <span className="text-sm font-medium">Server</span>
              </div>
              <div className={`text-lg font-semibold ${
                !isClient || hasServer === undefined 
                  ? "text-gray-400" 
                  : hasServer 
                    ? "text-green-600" 
                    : "text-red-600"
              }`}>
                {!isClient || hasServer === undefined 
                  ? "—" 
                  : hasServer 
                    ? "Reachable" 
                    : "Unreachable"}
              </div>
            </div>

            <div className="space-y-2 p-4 rounded-lg border">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-sm font-medium">Pending</span>
              </div>
              <div className="text-lg font-semibold">{pending} items</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <div className="rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">Offline Test Module</div>
              <div className="text-sm text-muted-foreground">
                Status:{" "}
                <span className={
                  !isClient || isOnline === undefined 
                    ? "text-gray-400" 
                    : isOnline 
                      ? "text-emerald-600" 
                      : "text-red-600"
                }>
                  {!isClient || isOnline === undefined 
                    ? "—" 
                    : isOnline 
                      ? "Online" 
                      : "Offline"}
                </span>
                {isClient && !isOnline ? <span className="ml-2 text-xs">• {offlineReason}</span> : null}
                {" "}• Pending queue: <span className="font-medium">{pending}</span>{" "}
                {isSyncing ? <span className="ml-1">• Syncing…</span> : null}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={loadList} 
                disabled={!isClient || !isOnline || loadingList || isOnline === undefined} 
                type="button"
              >
                {loadingList ? "Refreshing…" : "Refresh DB List"}
              </Button>

              <Button 
                onClick={manualSync} 
                disabled={!isClient || !isOnline || isSyncing || pending === 0 || isOnline === undefined} 
                type="button"
              >
                {isSyncing ? "Syncing…" : "Sync Now"}
              </Button>
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="rounded-xl border p-4 space-y-3 max-w-xl">
          <div className="text-sm font-medium">Create item</div>

          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />

          <Button type="submit" className="w-full" disabled={submitting || !isClient}>
            {submitting 
              ? "Saving…" 
              : !isClient || isOnline === undefined 
                ? "Save" 
                : isOnline 
                  ? "Save" 
                  : "Save locally (offline)"}
          </Button>

          {isClient && !isOnline ? (
            <div className="text-xs text-muted-foreground">
              You are offline. This will be stored locally and synced automatically when back online.
            </div>
          ) : null}
        </form>

        <div className="rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Database items (latest 30)</div>
            {isClient && !isOnline ? <div className="text-xs text-muted-foreground">(DB list loads only online)</div> : null}
          </div>

          <div className="mt-3 space-y-2 text-sm">
            {items.length === 0 ? (
              <div className="text-muted-foreground">
                {!isClient 
                  ? "—" 
                  : isOnline === undefined 
                    ? "Checking connection..." 
                    : isOnline 
                      ? "No items yet." 
                      : "Offline (DB list unavailable)."}
              </div>
            ) : (
              items.map((it) => (
                <div key={it.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="font-medium">{it.name}</div>
                    <div className="text-xs text-muted-foreground">{it.email}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateSafe(it.createdAt)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Advanced Testing Tools</CardTitle>
              <CardDescription>Run automated tests and network simulations</CardDescription>
            </div>
            <ShowTestSuiteButton isClient={isClient} />
          </div>
        </CardHeader>

        {showTestSuite ? (
          <CardContent className="space-y-8">
            <OfflineTestSuite />
            <NetworkTestPanel />
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}