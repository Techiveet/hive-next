// lib/auth.ts
import { compare, hash } from "bcryptjs";
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
    minPasswordLength: 8,
    password: {
      hash: async (password) => await hash(password, 10),
      verify: async ({ password, hash: storedHash }) => await compare(password, storedHash),
    },
  },

  /**
   * trustedOrigins now safely handles:
   * - Missing or undefined request
   * - Malformed origins
   * - DEV *.localhost
   * - PROD tenant domain checks
   */
  trustedOrigins: async (request?: Request) => {
    const origins: string[] = [BASE_URL];

    // ✅ Safety check: request may be undefined
    if (!request?.headers) return origins;

    const origin = request.headers.get("origin");
    if (!origin) return origins;

    try {
      const url = new URL(origin);
      const hostname = url.hostname;

      // DEV: allow any localhost or *.localhost
      if (
        process.env.NODE_ENV !== "production" &&
        (hostname === "localhost" || hostname.endsWith(".localhost"))
      ) {
        origins.push(origin);
        return origins;
      }

      // PROD: check tenant domains in DB
      const tenantDomain = await prisma.tenantDomain.findUnique({
        where: { domain: hostname },
      });

      if (tenantDomain) origins.push(origin);

      return origins;
    } catch {
      // Malformed origin, fallback to BASE_URL only
      return origins;
    }
  },
});
