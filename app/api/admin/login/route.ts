import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  verifyCredentials,
} from "@/lib/adminAuth";
import { checkLoginRateLimit } from "@/lib/adminRateLimit";
import { getClientIp, getUserAgent } from "@/lib/adminRequest";
import {
  ADMIN_SESSION_CONFIG_ERROR,
  createAdminSession,
  isAdminSessionConfigured,
} from "@/lib/adminSessionStore";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = await checkLoginRateLimit(`login:${ip}`);

  if (!rateLimit.success) {
    const response = NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      { status: 429 }
    );
    if (rateLimit.retryAfterSeconds) {
      response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    }
    return response;
  }

  let body: { username?: string; password?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const username = body.username?.trim() ?? "";
  const password = body.password ?? "";

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  if (!verifyCredentials(username, password)) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  if (!isAdminSessionConfigured()) {
    console.error(ADMIN_SESSION_CONFIG_ERROR);
    return NextResponse.json({ error: ADMIN_SESSION_CONFIG_ERROR }, { status: 503 });
  }

  let sessionToken: string;

  try {
    sessionToken = await createAdminSession({
      username,
      ip,
      userAgent: getUserAgent(request),
    });
  } catch (error) {
    console.error("Failed to create admin session", error);
    return NextResponse.json({ error: ADMIN_SESSION_CONFIG_ERROR }, { status: 503 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, sessionToken, adminSessionCookieOptions);
  return response;
}
