/** Returns the HMAC secret, or null when auth is not safely configured (fails closed in production). */
export function authSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const s = env.AUTH_SECRET;
  if (s && s.length >= 32) return s;
  if (env.NODE_ENV !== "production") return "dev-only-secret-do-not-use-in-production-0000";
  return null;
}

export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser or same-origin GET navigations
  try {
    return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  } catch {
    return false;
  }
}
