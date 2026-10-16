import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { authSecret } from "@/lib/auth/config";

/** The proxy already requires a session for this route; this returns who it is. */
export async function GET(req: Request) {
  const secret = authSecret();
  const cookie = req.headers.get("cookie")?.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  const s = secret ? await verifySession(cookie?.slice(SESSION_COOKIE.length + 1), secret) : null;
  return NextResponse.json({ email: s?.sub ?? null }, { headers: { "Cache-Control": "no-store" } });
}
