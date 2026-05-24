import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

type MemoryBucket = {
  count: number;
  resetAt: number;
};

const globalForRateLimit = globalThis as typeof globalThis & {
  adminLoginRateLimit?: Map<string, MemoryBucket>;
};

function getMemoryBuckets(): Map<string, MemoryBucket> {
  if (!globalForRateLimit.adminLoginRateLimit) {
    globalForRateLimit.adminLoginRateLimit = new Map();
  }
  return globalForRateLimit.adminLoginRateLimit;
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return null;
  }
  return new Redis({ url, token });
}

let loginRateLimiter: Ratelimit | null | undefined;

function getLoginRateLimiter(): Ratelimit | null {
  if (loginRateLimiter !== undefined) {
    return loginRateLimiter;
  }

  const redis = getRedis();
  if (!redis) {
    loginRateLimiter = null;
    return loginRateLimiter;
  }

  loginRateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(LOGIN_LIMIT, "15 m"),
    prefix: "admin:login:ratelimit",
    analytics: true,
  });
  return loginRateLimiter;
}

export type LoginRateLimitResult = {
  success: boolean;
  retryAfterSeconds?: number;
};

function checkMemoryLoginRateLimit(key: string): LoginRateLimitResult {
  const now = Date.now();
  const buckets = getMemoryBuckets();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return { success: true };
  }

  if (bucket.count >= LOGIN_LIMIT) {
    return {
      success: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { success: true };
}

export async function checkLoginRateLimit(
  key: string
): Promise<LoginRateLimitResult> {
  const limiter = getLoginRateLimiter();
  if (!limiter) {
    return checkMemoryLoginRateLimit(key);
  }

  const result = await limiter.limit(key);
  if (result.success) {
    return { success: true };
  }

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((result.reset - Date.now()) / 1000)
  );
  return { success: false, retryAfterSeconds };
}
