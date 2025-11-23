// lib/auth-server.ts

import { auth } from "./auth";
import { headers } from "next/headers";

export async function getCurrentSession() {
  // Next 16: headers() is async-like
  const h = await headers();

  // Convert to a plain object for safety
  const headerObj: Record<string, string> = {};
  h.forEach((value, key) => {
    headerObj[key] = value;
  });

  // Better Auth returns either `null` or a `session` object
  const session = await auth.api.getSession({
    headers: headerObj,
  });

  if (!session) {
    return { session: null, user: null as any };
  }

  return { session, user: session.user };
}
