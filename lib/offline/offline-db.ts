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
}

const DB_NAME = "hive-db";
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<HiveOfflineDB>> | null = null;

function initDB() {
  return openDB<HiveOfflineDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const store = db.createObjectStore("pending", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("by-createdAt", "createdAt");
        store.createIndex("by-url", "url");
      }

      if (oldVersion < 2) {
        // future migrations
      }
    },
  });
}

export async function getOfflineDB() {
  if (!dbPromise) dbPromise = initDB();
  return dbPromise;
}
