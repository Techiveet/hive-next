// lib/security/rate-limiter.ts
"use server";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getCurrentSession } from "@/lib/auth-server";

// Initialize Redis client (optional - fallback to memory if not configured)
let redis: Redis | null = null;
let rateLimiters: any = {};

try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    rateLimiters = {
      sendEmail: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "60 s"), // 10 emails per minute
        prefix: "ratelimit:email:send",
      }),
      fetchEmails: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, "10 s"), // 30 requests per 10 seconds
        prefix: "ratelimit:email:fetch",
      }),
      attachments: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "60 s"), // 5 attachments per minute
        prefix: "ratelimit:email:attachments",
      }),
    };
  }
} catch (error) {
  console.warn("Redis rate limiter initialization failed:", error);
}

export async function checkRateLimit(
  identifier: string,
  action: keyof typeof rateLimiters
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  // Skip rate limiting if Redis is not configured
  if (!redis || !rateLimiters[action]) {
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }

  try {
    const result = await rateLimiters[action].limit(identifier);
    
    if (!result.success) {
      console.warn(`Rate limit exceeded for ${action}: ${identifier}`);
    }
    
    return result;
  } catch (error) {
    console.error("Rate limit check error:", error);
    return { success: true, limit: 0, remaining: 0, reset: 0 }; // Fail open
  }
}

export async function withRateLimit<T>(
  userId: string,
  action: keyof typeof rateLimiters,
  fn: () => Promise<T>
): Promise<T> {
  const { success } = await checkRateLimit(userId, action);
  
  if (!success) {
    throw new Error(`Rate limit exceeded. Please try again later.`);
  }
  
  return fn();
}