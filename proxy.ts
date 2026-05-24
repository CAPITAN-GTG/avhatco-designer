import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminSessionIdFromRequest } from "@/lib/adminAuth";
import { getAdminSession } from "@/lib/adminSessionStore";

function isPublicAdminPath(pathname: string): boolean {
  return pathname === "/admin/login" || pathname.startsWith("/admin/login/");
}

function isPublicAdminApiPath(pathname: string): boolean {
  return pathname === "/api/admin/login" || pathname === "/api/admin/logout";
}

function unauthorizedApiResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicAdminPath(pathname) || isPublicAdminApiPath(pathname)) {
    return NextResponse.next();
  }

  const sessionId = getAdminSessionIdFromRequest(request);
  const session = await getAdminSession(sessionId);
  if (session) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/admin")) {
    return unauthorizedApiResponse();
  }

  const loginUrl = new URL("/admin/login", request.url);
  if (pathname !== "/admin") {
    loginUrl.searchParams.set("from", pathname);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
