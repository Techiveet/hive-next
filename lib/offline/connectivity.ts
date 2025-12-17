// lib/offline/connectivity.ts
export async function hasInternet(timeoutMs = 3500): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // external connectivity probe
    await fetch("https://www.gstatic.com/generate_204", {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export async function hasServer(timeoutMs = 3500): Promise<boolean> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`/api/health?ts=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      credentials: "include",
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
      },
    });

    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}
