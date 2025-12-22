"use client";

export function browserOnlineFlag(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

async function fallbackPing(timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`/api/offline-test?ts=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
      },
    });

    clearTimeout(t);
    return res.ok;
  } catch {
    clearTimeout(t);
    return false;
  }
}

export async function hasServer(timeoutMs = 1200): Promise<boolean> {
  if (typeof window === "undefined") return true;

  // If browser says offline, treat as offline (fast)
  if (!browserOnlineFlag()) return false;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`/api/health?ts=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
      },
    });

    clearTimeout(t);

    if (res.ok) return true;
    if (res.status === 404) return await fallbackPing(timeoutMs);

    return false;
  } catch {
    clearTimeout(t);
    return await fallbackPing(timeoutMs);
  }
}

export async function hasInternet(): Promise<boolean> {
  return browserOnlineFlag();
}
