// lib/offline/offline-db.ts
"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type PendingBodyType = "json" | "text" | "formdata-base64";

export type PendingItem = {
  id?: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  bodyType: PendingBodyType;
  body: any;
  createdAt: number;
  retryCount: number;
};

interface HiveOfflineDB extends DBSchema {
  pending: {
    key: number;
    value: PendingItem;
    indexes: {
      "by-createdAt": number;
      "by-url": string;
    };
  };

  // later you can add more stores here (drafts, cachedEntities, etc)
}

let dbPromise: Promise<IDBPDatabase<HiveOfflineDB>> | null = null;

export function getOfflineDB() {
  if (!dbPromise) {
    dbPromise = openDB<HiveOfflineDB>("hive-db", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("pending")) {
          const store = db.createObjectStore("pending", {
            keyPath: "id",
            autoIncrement: true,
          });

          store.createIndex("by-createdAt", "createdAt");
          store.createIndex("by-url", "url");
        }
      },
    });
  }

  return dbPromise;
}
