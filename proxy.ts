import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { authSecret, sameOrigin } from "@/lib/auth/config";

/** Guards the workbench and the TinyFish proxy routes; also blocks cross-origin state-changing API calls. */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (isApi && req.method !== "GET" && !sameOrigin(req)) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Cross-origin request blocked." } }, { status: 403 });
  }

  const secret = authSecret();
  const session = secret ? await verifySession(req.cookies.get(SESSION_COOKIE)?.value, secret) : null;

  if (pathname === "/login") {
    return session ? NextResponse.redirect(new URL("/app", req.url)) : NextResponse.next();
  }
  if (session) return NextResponse.next();

  if (isApi) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Please sign in to use JobScout." } },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  const url = new URL("/login", req.url);
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/app/:path*", "/login", "/api/connect", "/api/search", "/api/extract", "/api/enrich", "/api/auth/me"],
};
