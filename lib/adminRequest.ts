import type { NextRequest } from "next/server";

export function getClientIp(request: Request | NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

export function getUserAgent(request: Request | NextRequest): string {
  return request.headers.get("user-agent") ?? "unknown";
}
