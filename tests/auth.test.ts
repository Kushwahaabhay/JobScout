import { describe, expect, it } from "vitest";
import { signSession, verifySession, SESSION_TTL_SECONDS } from "@/lib/auth/session";
import { authenticate, hashPassword, parseUsers, verifyPassword } from "@/lib/auth/users";
import { authSecret } from "@/lib/auth/config";

const SECRET = "x".repeat(40);

describe("session cookie", () => {
  it("round-trips a valid token", async () => {
    const t = await signSession("a@b.co", SECRET);
    expect((await verifySession(t, SECRET))?.sub).toBe("a@b.co");
  });
  it("rejects tampering, wrong secret, expiry and junk", async () => {
    const t = await signSession("a@b.co", SECRET, 0);
    const [body, sig] = t.split(".");
    expect(await verifySession(`${body}x.${sig}`, SECRET, 0)).toBeNull();
    expect(await verifySession(t, "y".repeat(40), 0)).toBeNull();
    expect(await verifySession(t, SECRET, (SESSION_TTL_SECONDS + 5) * 1000)).toBeNull();
    expect(await verifySession("junk", SECRET)).toBeNull();
    expect(await verifySession(undefined, SECRET)).toBeNull();
  });
});

describe("users", () => {
  const entry = `Me@X.com|${hashPassword("pw-123")}`;
  const users = parseUsers(`${entry};bad-entry`);
  it("parses env users, lowercasing emails and skipping malformed entries", () => {
    expect([...users.keys()]).toEqual(["me@x.com"]);
  });
  it("authenticates only the right email+password", () => {
    expect(authenticate("me@x.com", "pw-123", users)).toBe(true);
    expect(authenticate(" ME@x.com ", "pw-123", users)).toBe(true);
    expect(authenticate("me@x.com", "nope", users)).toBe(false);
    expect(authenticate("who@x.com", "pw-123", users)).toBe(false);
  });
  it("hashes with unique salts and verifies", () => {
    const a = hashPassword("p"), b = hashPassword("p");
    expect(a).not.toBe(b);
    expect(verifyPassword("p", a)).toBe(true);
    expect(verifyPassword("q", a)).toBe(false);
    expect(verifyPassword("p", "garbage")).toBe(false);
  });
});

describe("auth secret", () => {
  it("fails closed in production without a strong secret", () => {
    expect(authSecret({ NODE_ENV: "production" } as never)).toBeNull();
    expect(authSecret({ NODE_ENV: "production", AUTH_SECRET: "short" } as never)).toBeNull();
    expect(authSecret({ NODE_ENV: "production", AUTH_SECRET: SECRET } as never)).toBe(SECRET);
  });
});
