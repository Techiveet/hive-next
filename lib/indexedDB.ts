// lib/indexedDB.ts
import { openDB } from "idb";

const DB_NAME = "hive-db";
const STORE_NAME = "pending";
const VERSION = 1;

export async function getDB() {
  return openDB(DB_NAME, VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    },
  });
}

/**
 * Save a pending request to IndexedDB
 * payload: any serializable object
 * url: endpoint to send to when online
 * method: HTTP method
 */
export async function savePending({ url, method = "POST", payload }: { url: string; method?: string; payload: any; }) {
  const db = await getDB();
  await db.add(STORE_NAME, { url, method, payload, createdAt: Date.now() });
}

export async function getAllPending() {
  const db = await getDB();
  return db.getAll(STORE_NAME);
}

export async function clearPendingById(id: number) {
  const db = await getDB();
  return db.delete(STORE_NAME, id);
}

export async function clearAllPending() {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.store.clear();
  await tx.done;
}
