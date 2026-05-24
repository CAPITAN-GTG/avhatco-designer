import { timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/adminConstants";
import {
  getAdminSession,
  getAdminSessionMaxAgeSeconds,
  revokeAdminSession,
  type AdminSession,
} from "@/lib/adminSessionStore";

export { ADMIN_SESSION_COOKIE };

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export function verifyCredentials(username: string, password: string): boolean {
  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    return false;
  }

  return safeEqual(username, expectedUsername) && safeEqual(password, expectedPassword);
}

export function getAdminSessionIdFromRequest(
  request: Request | NextRequest
): string | undefined {
  if ("cookies" in request && typeof request.cookies?.get === "function") {
    return request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  }

  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return undefined;
  }

  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === ADMIN_SESSION_COOKIE) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return undefined;
}

export async function getAdminSessionFromRequest(
  request: Request | NextRequest
): Promise<AdminSession | null> {
  const sessionId = getAdminSessionIdFromRequest(request);
  return getAdminSession(sessionId);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const session = await getAdminSession(sessionId);
  return session !== null;
}

export async function requireAdminSession(
  request: Request | NextRequest
): Promise<AdminSession | NextResponse> {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session;
}

export async function revokeAdminSessionFromRequest(
  request: Request | NextRequest
): Promise<void> {
  const sessionId = getAdminSessionIdFromRequest(request);
  await revokeAdminSession(sessionId);
}

export const adminSessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: getAdminSessionMaxAgeSeconds(),
};

export function clearAdminSessionCookie(response: NextResponse): void {
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
