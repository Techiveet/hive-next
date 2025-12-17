// lib/offline/offline-queue.ts
"use client";

import { getOfflineDB, type PendingItem } from "@/lib/offline/offline-db";

function isFormData(body: any): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function formDataToBase64Payload(fd: FormData, maxBytes = 3_000_000) {
  const fields: Record<string, string> = {};
  const files: Array<{
    field: string;
    name: string;
    type: string;
    base64: string;
    size: number;
  }> = [];

  for (const [key, value] of fd.entries()) {
    if (value instanceof File) {
      if (value.size > maxBytes) {
        throw new Error(
          `File too large for offline queue (${value.size} bytes). Limit: ${maxBytes}.`
        );
      }

      const base64 = await fileToBase64(value);
      files.push({
        field: key,
        name: value.name,
        type: value.type || "application/octet-stream",
        base64,
        size: value.size,
      });
    } else {
      fields[key] = String(value);
    }
  }

  return { fields, files };
}

export async function queueRequest(input: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
}) {
  const method = (input.method || "POST").toUpperCase();
  const headers = input.headers || {};

  let bodyType: PendingItem["bodyType"] = "json";
  let body: PendingItem["body"] = null;

  if (isFormData(input.body)) {
    bodyType = "formdata-base64";
    body = await formDataToBase64Payload(input.body);
  } else if (typeof input.body === "string") {
    bodyType = "text";
    body = input.body;
  } else {
    bodyType = "json";
    body = input.body ?? null;
  }

  const item: PendingItem = {
    url: input.url,
    method,
    headers,
    bodyType,
    body,
    createdAt: Date.now(),
    retryCount: 0,
  };

  const db = await getOfflineDB();
  await db.add("pending", item);
}

export async function listPending() {
  const db = await getOfflineDB();
  return db.getAllFromIndex("pending", "by-createdAt");
}

export async function removePending(id: number) {
  const db = await getOfflineDB();
  await db.delete("pending", id);
}

export async function pendingCount() {
  const db = await getOfflineDB();
  return db.count("pending");
}
