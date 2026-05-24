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
  return checkMemoryLoginRateLimit(key);
}
