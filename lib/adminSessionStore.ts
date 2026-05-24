import { randomBytes } from "crypto";
import { Redis } from "@upstash/redis";

export type AdminSession = {
  username: string;
  createdAt: number;
  expiresAt: number;
  ip?: string;
  userAgent?: string;
};

const SESSION_PREFIX = "admin:session:";
const LOGIN_LOG_KEY = "admin:login:log";
const LOGIN_LOG_MAX = 100;

function sessionKey(id: string): string {
  return `${SESSION_PREFIX}${id}`;
}

function getSessionMaxAgeSeconds(): number {
  const fromEnv = Number(process.env.ADMIN_SESSION_MAX_AGE_SECONDS);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return fromEnv;
  }
  return 60 * 60 * 12;
}

export function getAdminSessionMaxAgeSeconds(): number {
  return getSessionMaxAgeSeconds();
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return null;
  }
  return new Redis({ url, token });
}

type MemoryStore = Map<string, AdminSession>;

const globalForSessions = globalThis as typeof globalThis & {
  adminSessionStore?: MemoryStore;
};

function getMemoryStore(): MemoryStore {
  if (!globalForSessions.adminSessionStore) {
    globalForSessions.adminSessionStore = new Map();
  }
  return globalForSessions.adminSessionStore;
}

function isExpired(session: AdminSession): boolean {
  return session.expiresAt <= Date.now();
}

function pruneExpiredMemorySessions(): void {
  const store = getMemoryStore();
  for (const [id, session] of store) {
    if (isExpired(session)) {
      store.delete(id);
    }
  }
}

export type CreateAdminSessionInput = {
  username: string;
  ip?: string;
  userAgent?: string;
};

export async function createAdminSession(
  input: CreateAdminSessionInput
): Promise<string> {
  const id = randomBytes(32).toString("hex");
  const now = Date.now();
  const maxAgeSeconds = getSessionMaxAgeSeconds();
  const session: AdminSession = {
    username: input.username,
    createdAt: now,
    expiresAt: now + maxAgeSeconds * 1000,
    ip: input.ip,
    userAgent: input.userAgent,
  };

  const redis = getRedis();
  if (redis) {
    await redis.set(sessionKey(id), session, { ex: maxAgeSeconds });
    await redis.lpush(LOGIN_LOG_KEY, {
      sessionId: id,
      username: input.username,
      ip: input.ip ?? "unknown",
      userAgent: input.userAgent ?? "unknown",
      at: now,
    });
    await redis.ltrim(LOGIN_LOG_KEY, 0, LOGIN_LOG_MAX - 1);
    return id;
  }

  pruneExpiredMemorySessions();
  getMemoryStore().set(id, session);
  return id;
}

export async function getAdminSession(
  sessionId: string | undefined
): Promise<AdminSession | null> {
  if (!sessionId) {
    return null;
  }

  const redis = getRedis();
  if (redis) {
    const session = await redis.get<AdminSession>(sessionKey(sessionId));
    if (!session || isExpired(session)) {
      if (session) {
        await redis.del(sessionKey(sessionId));
      }
      return null;
    }
    return session;
  }

  pruneExpiredMemorySessions();
  const session = getMemoryStore().get(sessionId);
  if (!session || isExpired(session)) {
    getMemoryStore().delete(sessionId);
    return null;
  }
  return session;
}

export async function revokeAdminSession(sessionId: string | undefined): Promise<void> {
  if (!sessionId) {
    return;
  }

  const redis = getRedis();
  if (redis) {
    await redis.del(sessionKey(sessionId));
    return;
  }

  getMemoryStore().delete(sessionId);
}

export function isUsingPersistentSessionStore(): boolean {
  return getRedis() !== null;
}

export function isProductionWithoutSessionStore(): boolean {
  return process.env.NODE_ENV === "production" && !isUsingPersistentSessionStore();
}

export const ADMIN_SESSION_STORE_ERROR =
  "Admin sessions require Upstash Redis in production. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, then redeploy.";
