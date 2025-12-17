// lib/offline-manager.ts
"use client";

type Listener = (online: boolean) => void;

class OfflineManager {
  private online = true;
  private listeners = new Set<Listener>();

  constructor() {
    if (typeof window !== "undefined") {
      this.online = navigator.onLine;

      window.addEventListener("online", () => this.setOnline(true));
      window.addEventListener("offline", () => this.setOnline(false));
    }
  }

  private setOnline(value: boolean) {
    if (this.online === value) return;
    this.online = value;
    this.listeners.forEach((l) => l(value));
  }

  isOnline() {
    return this.online;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.online);
    return () => this.listeners.delete(listener);
  }
}

export const offlineManager = {
  init: () => Promise.resolve(),
  storeOfflineAction: (action: any) => Promise.resolve(),
  syncOfflineActions: () => Promise.resolve()
};
