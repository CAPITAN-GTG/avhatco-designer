import { NextResponse } from "next/server";
import {
  clearAdminSessionCookie,
  revokeAdminSessionFromRequest,
} from "@/lib/adminAuth";

export async function POST(request: Request) {
  await revokeAdminSessionFromRequest(request);

  const response = NextResponse.json({ ok: true });
  clearAdminSessionCookie(response);
  return response;
}
