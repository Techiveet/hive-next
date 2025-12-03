// lib/auth.ts

import { compare, hash } from "bcryptjs"; // ✅ Import bcryptjs

import { betterAuth } from "better-auth";
import { prisma } from "./prisma";
import { prismaAdapter } from "better-auth/adapters/prisma";

const BASE_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "mysql",
  }),

  baseURL: BASE_URL,
  secret: process.env.BETTER_AUTH_SECRET!,

  emailAndPassword: {
    enabled: true,
    // autoSignIn: true is not needed for admin-created users
    minPasswordLength: 8,
    
    // ✅ ADDED: Configure Better Auth to use Bcrypt
    password: {
      hash: async (password) => {
        return await hash(password, 10);
      },
      verify: async ({ password, hash: storedHash }) => {
        return await compare(password, storedHash);
      },
    },
  },

  /**
   * Allow:
   * - the main app origin (BASE_URL)
   * - in dev: any *.localhost:3000 origin
   * - in prod: any origin whose hostname exists in TenantDomain.domain
   */
  trustedOrigins: async (request: Request) => {
    const origins: string[] = [BASE_URL];

    const origin = request.headers.get("origin");
    if (!origin) {
      return origins;
    }

    try {
      const url = new URL(origin);
      const hostname = url.hostname;

      // 1) DEV: allow any *.localhost (e.g. acme.localhost:3000)
      if (
        process.env.NODE_ENV !== "production" &&
        (hostname === "localhost" || hostname.endsWith(".localhost"))
      ) {
        origins.push(origin);
        return origins;
      }

      // 2) PROD (and can also work in dev): check TenantDomain table
      const tenantDomain = await prisma.tenantDomain.findUnique({
        where: { domain: hostname }, // e.g. "acme.hive.com" or "acme.localhost"
      });

      if (tenantDomain) {
        origins.push(origin);
      }

      return origins;
    } catch {
      // If origin is malformed, just fall back to BASE_URL only
      return origins;
    }
  },
});