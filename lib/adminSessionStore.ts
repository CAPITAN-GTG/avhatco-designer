import { createHmac, timingSafeEqual } from "crypto";

export type AdminSession = {
  username: string;
  createdAt: number;
  expiresAt: number;
  ip?: string;
  userAgent?: string;
};

type SessionPayload = {
  u: string;
  iat: number;
  exp: number;
};

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

function getSessionSecret(): string | null {
  const fromEnv =
    process.env.ADMIN_SESSION_SECRET?.trim() || process.env.ADMIN_SESSION_TOKEN?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (username && password) {
    return `admin-session:${username}:${password}`;
  }

  return null;
}

export function isAdminSessionConfigured(): boolean {
  return getSessionSecret() !== null;
}

export const ADMIN_SESSION_CONFIG_ERROR =
  "Admin sessions are not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD (or ADMIN_SESSION_SECRET) in production.";

function signPayload(payload: SessionPayload): string {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error(ADMIN_SESSION_CONFIG_ERROR);
  }

  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifyPayload(token: string): SessionPayload | null {
  const secret = getSessionSecret();
  if (!secret) {
    return null;
  }

  const separator = token.lastIndexOf(".");
  if (separator <= 0) {
    return null;
  }

  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = createHmac("sha256", secret).update(body).digest("base64url");

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as SessionPayload;

    if (
      typeof payload.u !== "string" ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }

    if (payload.exp <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
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
  const now = Date.now();
  const maxAgeSeconds = getSessionMaxAgeSeconds();

  return signPayload({
    u: input.username,
    iat: now,
    exp: now + maxAgeSeconds * 1000,
  });
}

export async function getAdminSession(
  sessionToken: string | undefined
): Promise<AdminSession | null> {
  if (!sessionToken) {
    return null;
  }

  const payload = verifyPayload(sessionToken);
  if (!payload) {
    return null;
  }

  return {
    username: payload.u,
    createdAt: payload.iat,
    expiresAt: payload.exp,
  };
}

export async function revokeAdminSession(_sessionToken: string | undefined): Promise<void> {
  // Stateless sessions are revoked by clearing the cookie on logout.
}
