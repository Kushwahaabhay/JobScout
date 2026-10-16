import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Users come from the JOBSCOUT_USERS env var (no database):
 *   email|salthex:hashhex;email2|salthex:hashhex
 * Generate entries with `npm run auth:hash -- you@example.com 'password'`.
 */
const KEYLEN = 32;

export function hashPassword(password: string, saltHex = randomBytes(16).toString("hex")): string {
  return `${saltHex}:${scryptSync(password, Buffer.from(saltHex, "hex"), KEYLEN).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, Buffer.from(salt, "hex"), expected.length || KEYLEN);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function parseUsers(raw: string | undefined): Map<string, string> {
  const users = new Map<string, string>();
  for (const entry of (raw ?? "").split(";")) {
    const i = entry.indexOf("|");
    if (i < 1) continue;
    users.set(entry.slice(0, i).trim().toLowerCase(), entry.slice(i + 1).trim());
  }
  return users;
}

export const DEV_DEMO = { email: "demo@jobscout.dev", password: "jobscout-demo" };

/** Configured users; in non-production with nothing configured, a documented demo account is enabled. */
export function loadUsers(env: NodeJS.ProcessEnv = process.env): Map<string, string> {
  const users = parseUsers(env.JOBSCOUT_USERS);
  if (users.size === 0 && env.NODE_ENV !== "production") {
    users.set(DEV_DEMO.email, hashPassword(DEV_DEMO.password, "6a6f6273636f75742d646576"));
  }
  return users;
}

const DUMMY = hashPassword("not-a-real-password", "00".repeat(16));

/** Always does one scrypt so unknown emails and wrong passwords take similar time. */
export function authenticate(email: string, password: string, users = loadUsers()): boolean {
  const stored = users.get(email.trim().toLowerCase());
  const ok = verifyPassword(password, stored ?? DUMMY);
  return Boolean(stored) && ok;
}
