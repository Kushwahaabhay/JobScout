import { NextResponse } from "next/server";
import { buildQueries, selectSources, tinyfishSearch, type SearchHit } from "@/lib/tinyfish/search";
import { TinyFishError } from "@/lib/tinyfish/http";
import { errorResponse, fromError, parseBody, readApiKey } from "@/lib/server/route";
import { searchRequestSchema } from "@/lib/server/schemas";
import { LIMITS } from "@/lib/server/config";
import type { SearchResponse } from "@/lib/types";

export const maxDuration = 60;

/** Stage 1 — TinyFish Search: discover careers pages / job portals. */
export async function POST(req: Request) {
  const key = readApiKey(req);
  if (!key) return errorResponse("MISSING_API_KEY", "Enter your TinyFish API key first.", 401);
  const parsed = await parseBody(req, searchRequestSchema);
  if ("response" in parsed) return parsed.response;
  const { criteria, limits } = parsed.data;
  const maxSources = Math.min(limits.maxSources, LIMITS.maxSourcesCap);

  const queries = buildQueries(criteria);
  const settled = await Promise.allSettled(
    queries.map((q) =>
      tinyfishSearch(key, {
        query: q.query,
        include_domains: q.include_domains,
        purpose: "Find company careers pages and job portals listing open roles",
      }),
    ),
  );

  const hits: Array<SearchHit & { query: string }> = [];
  const warnings: string[] = [];
  let firstError: unknown = null;
  // Interleave so each query contributes before the cap is applied.
  const lists = settled.map((s, i) => {
    if (s.status === "fulfilled") return s.value.map((h) => ({ ...h, query: queries[i].query }));
    firstError ??= s.reason;
    warnings.push(`Search query ${i + 1} failed: ${s.reason instanceof TinyFishError ? s.reason.message : "unknown error"}`);
    return [];
  });
  for (let i = 0; i < Math.max(...lists.map((l) => l.length), 0); i++) {
    for (const l of lists) if (l[i]) hits.push(l[i]);
  }

  if (hits.length === 0 && firstError) return fromError(firstError);

  const body: SearchResponse = {
    sources: selectSources(hits, maxSources),
    queries: queries.map((q) => q.query),
    warnings,
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
