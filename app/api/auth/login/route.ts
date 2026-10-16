import { NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from "@/lib/auth/session";
import { authSecret, sameOrigin } from "@/lib/auth/config";
import { authenticate, loadUsers } from "@/lib/auth/users";
import { errorResponse } from "@/lib/server/route";

const body = z.object({ email: z.string().trim().min(3).max(254), password: z.string().min(1).max(200) });

// Best-effort throttle (per server instance). Use an edge/WAF rate limit for stronger guarantees.
const attempts = new Map<string, { n: number; reset: number }>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 8;

function throttled(ip: string): number {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || rec.reset < now) {
    attempts.set(ip, { n: 1, reset: now + WINDOW_MS });
    return 0;
  }
  rec.n++;
  return rec.n > MAX_ATTEMPTS ? Math.ceil((rec.reset - now) / 1000) : 0;
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return errorResponse("FORBIDDEN", "Cross-origin request blocked.", 403);
  const secret = authSecret();
  if (!secret) {
    return errorResponse("AUTH_NOT_CONFIGURED", "Sign-in is not configured on this deployment (AUTH_SECRET missing).", 503);
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const wait = throttled(ip);
  if (wait) return errorResponse("RATE_LIMITED", `Too many attempts. Try again in ${wait}s.`, 429, wait);

  let parsed;
  try {
    parsed = body.safeParse(await req.json());
  } catch {
    parsed = null;
  }
  if (!parsed?.success) return errorResponse("INVALID_INPUT", "Enter your email and password.", 400);

  const users = loadUsers();
  if (users.size === 0) {
    return errorResponse("AUTH_NOT_CONFIGURED", "No users are configured (JOBSCOUT_USERS).", 503);
  }
  if (!authenticate(parsed.data.email, parsed.data.password, users)) {
    return errorResponse("INVALID_CREDENTIALS", "Incorrect email or password.", 401);
  }

  const token = await signSession(parsed.data.email.trim().toLowerCase(), secret);
  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
