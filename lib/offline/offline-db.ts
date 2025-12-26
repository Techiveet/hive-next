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
const DB_VERSION = 5;

let dbPromise: Promise<IDBPDatabase<HiveOfflineDB>> | null = null;

// Clear existing database completely
async function clearDatabase() {
  try {
    const deleteReq = indexedDB.deleteDatabase(DB_NAME);
    await new Promise((resolve, reject) => {
      deleteReq.onsuccess = () => resolve(undefined);
      deleteReq.onerror = () => reject(deleteReq.error);
    });
  } catch (error) {
    console.warn("Failed to clear database:", error);
  }
}

function initDB() {
  return openDB<HiveOfflineDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Always recreate the store
      if (db.objectStoreNames.contains("pending")) {
        db.deleteObjectStore("pending");
      }
      
      const store = db.createObjectStore("pending", {
        keyPath: "id",
        autoIncrement: true,
      });
      store.createIndex("by-createdAt", "createdAt");
      store.createIndex("by-url", "url");
    },
    blocked() {
      // Force reload if blocked
      setTimeout(() => location.reload(), 100);
    },
  });
}

export async function getOfflineDB() {
  if (!dbPromise) {
    // Clear database first time
    await clearDatabase();
    dbPromise = initDB();
  }
  return dbPromise;
}
