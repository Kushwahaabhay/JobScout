import { describe, expect, it, vi } from "vitest";
import type { SearchCriteria } from "@/lib/types";
import { tinyfishSearch } from "@/lib/tinyfish/search";
import { tinyfishFetch } from "@/lib/tinyfish/fetch";
import { tinyfishAgentExtract } from "@/lib/tinyfish/agent";
import { TinyFishError } from "@/lib/tinyfish/http";

const crit: SearchCriteria = { role: "Dev", location: "", seniority: "any", employment: "any", keywords: [] };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("TinyFish clients (mocked transport)", () => {
  it("search: GET with X-API-Key and query string", async () => {
    const f = vi.fn().mockResolvedValue(json({ results: [{ url: "https://a.com", title: "t" }] }));
    const r = await tinyfishSearch("secret-key-123", { query: "x y", include_domains: ["a.com"] }, f as never);
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toContain("https://api.search.tinyfish.ai?query=x+y");
    expect(String(url)).toContain("include_domains=a.com");
    expect(init.headers["X-API-Key"]).toBe("secret-key-123");
    expect(String(url)).not.toContain("secret-key-123");
    expect(r).toHaveLength(1);
  });

  it("maps 401/429 to friendly typed errors that never contain the key", async () => {
    const f401 = vi.fn().mockResolvedValue(json({ error: { code: "INVALID_API_KEY", message: "bad" } }, 401));
    const e1 = await tinyfishSearch("secret-key-123", { query: "x" }, f401 as never).catch((e) => e);
    expect(e1).toBeInstanceOf(TinyFishError);
    expect(e1.code).toBe("INVALID_API_KEY");
    expect(e1.message).not.toContain("secret-key-123");
    const f429 = vi.fn().mockResolvedValue(json({}, 429));
    expect((await tinyfishSearch("k-12345678", { query: "x" }, f429 as never).catch((e) => e)).code).toBe("RATE_LIMIT_EXCEEDED");
  });

  it("rejects malformed search output", async () => {
    const f = vi.fn().mockResolvedValue(json({ nope: 1 }));
    await expect(tinyfishSearch("k-12345678", { query: "x" }, f as never)).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
  });

  it("fetch: POSTs urls as markdown and surfaces per-URL errors", async () => {
    const f = vi.fn().mockResolvedValue(json({ results: [], errors: [{ url: "https://a.com", error: "timeout" }] }));
    const r = await tinyfishFetch("k-12345678", ["https://a.com"], "p", f as never);
    expect(JSON.parse(f.mock.calls[0][1].body)).toMatchObject({ urls: ["https://a.com"], format: "markdown" });
    expect(r.errors[0].error).toBe("timeout");
    await expect(tinyfishFetch("k", Array(11).fill("https://a.com"), "p", f as never)).rejects.toThrow();
  });

  it("agent: FAILED runs throw; COMPLETED runs return parsed jobs", async () => {
    const bad = vi.fn().mockResolvedValue(json({ run_id: "r", status: "FAILED", error: { code: "SITE_BLOCKED", message: "x" } }));
    await expect(tinyfishAgentExtract("k-12345678", "https://a.com", crit, { fetchImpl: bad as never })).rejects.toMatchObject({ code: "SITE_BLOCKED" });
    const ok = vi.fn().mockResolvedValue(json({ run_id: "r", status: "COMPLETED", num_of_steps: 4, result: { jobs: [{ title: "A" }] } }));
    const r = await tinyfishAgentExtract("k-12345678", "https://a.com", crit, { fetchImpl: ok as never });
    expect(r.jobs).toHaveLength(1);
    expect(r.steps).toBe(4);
  });
});
