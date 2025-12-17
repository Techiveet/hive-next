import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Cache interface
interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[];
}

// Enhanced cache function with Redis fallback
export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const { ttl = 300, tags = [] } = options;
  
  try {
    // Try to get from Redis first
    const cached = await redis.get<T>(key);
    if (cached !== null) {
      return cached;
    }
  } catch (error) {
    console.warn('Redis cache miss, falling back to in-memory:', error);
  }
  
  // Execute function and cache result
  const result = await fn();
  
  try {
    await redis.set(key, result, { ex: ttl });
    
    // Store tags for invalidation
    if (tags.length > 0) {
      await Promise.all(
        tags.map(tag => redis.sadd(`tag:${tag}`, key))
      );
    }
  } catch (error) {
    console.warn('Failed to cache in Redis:', error);
  }
  
  return result;
}

// Invalidate cache by tags
export async function invalidateCacheByTag(tag: string): Promise<void> {
  try {
    const keys = await redis.smembers(`tag:${tag}`);
    if (keys.length > 0) {
      await redis.del(...keys);
      await redis.del(`tag:${tag}`);
    }
  } catch (error) {
    console.error('Failed to invalidate cache:', error);
  }
}

// Use in email queries
export const getCachedEmailsWithRedis = (
  userId: string,
  folder: string,
  cursor: string | null = null,
  pageSize: number = 10
) => {
  const cacheKey = `emails:${userId}:${folder}:${cursor}:${pageSize}`;
  
  return cached(cacheKey, () => {
    // Your existing getCachedEmails logic
    return getCachedEmails(userId, folder, cursor, pageSize);
  }, {
    ttl: 60, // 1 minute
    tags: ['emails', `user:${userId}`],
  });
};