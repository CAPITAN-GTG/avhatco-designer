import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  verifyCredentials,
} from "@/lib/adminAuth";
import { checkLoginRateLimit } from "@/lib/adminRateLimit";
import { getClientIp, getUserAgent } from "@/lib/adminRequest";
import { createAdminSession } from "@/lib/adminSessionStore";

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

  const sessionId = await createAdminSession({
    username,
    ip,
    userAgent: getUserAgent(request),
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, sessionId, adminSessionCookieOptions);
  return response;
}
