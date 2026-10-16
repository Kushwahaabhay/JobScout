/** Stateless signed session cookie (HMAC-SHA256 via Web Crypto; works in proxy and route handlers). */

export const SESSION_COOKIE = "jobscout_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

export interface SessionPayload {
  sub: string;
  exp: number; // unix seconds
}

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signSession(sub: string, secret: string, now = Date.now()): Promise<string> {
  const payload: SessionPayload = { sub, exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body));
  return `${body}.${b64url(sig)}`;
}

export async function verifySession(token: string | undefined, secret: string, now = Date.now()): Promise<SessionPayload | null> {
  if (!token || !secret) return null;
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  try {
    // crypto.subtle.verify compares in constant time.
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), fromB64url(sig) as BufferSource, enc.encode(body));
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body))) as SessionPayload;
    if (typeof p.sub !== "string" || typeof p.exp !== "number" || p.exp * 1000 < now) return null;
    return p;
  } catch {
    return null;
  }
}
