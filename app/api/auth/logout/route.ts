import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { sameOrigin } from "@/lib/auth/config";
import { errorResponse } from "@/lib/server/route";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return errorResponse("FORBIDDEN", "Cross-origin request blocked.", 403);
  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
