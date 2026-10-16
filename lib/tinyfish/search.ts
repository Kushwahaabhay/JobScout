import { z } from "zod";
import type { DiscoveredSource, SearchCriteria } from "../types";
import { TinyFishError, tinyfishRequest } from "./http";

export const SEARCH_URL = "https://api.search.tinyfish.ai";

const SearchResult = z.object({
  position: z.number().optional(),
  site_name: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  snippet: z.string().optional().nullable(),
  url: z.string(),
});
const SearchResponse = z.object({ results: z.array(SearchResult) });

export type SearchHit = z.infer<typeof SearchResult>;

export interface SearchParams {
  query: string;
  purpose?: string;
  include_domains?: string[];
}

export async function tinyfishSearch(
  apiKey: string,
  p: SearchParams,
  fetchImpl?: typeof fetch,
): Promise<SearchHit[]> {
  const qs = new URLSearchParams({ query: p.query });
  if (p.purpose) qs.set("purpose", p.purpose.slice(0, 2000));
  if (p.include_domains?.length) qs.set("include_domains", p.include_domains.join(","));
  const raw = await tinyfishRequest<unknown>({
    url: `${SEARCH_URL}?${qs}`,
    method: "GET",
    apiKey,
    timeoutMs: 30_000,
    fetchImpl,
  });
  const parsed = SearchResponse.safeParse(raw);
  if (!parsed.success) {
    throw new TinyFishError("TinyFish Search returned an unexpected shape.", "MALFORMED_RESPONSE", 502);
  }
  return parsed.data.results;
}

const ATS_DOMAINS = [
  "boards.greenhouse.io",
  "job-boards.greenhouse.io",
  "jobs.lever.co",
  "jobs.ashbyhq.com",
  "apply.workable.com",
];

/** Pure: builds the discovery queries for the given criteria. */
export function buildQueries(c: SearchCriteria): Array<{ query: string; include_domains?: string[] }> {
  const kind = c.employment === "internship" ? "internship" : c.employment === "full-time" ? "full-time" : "";
  const base = [c.role, kind, c.location.trim()].filter(Boolean).join(" ");
  const kw = c.keywords.slice(0, 3).join(" ");
  return [
    { query: `${base} ${kw} careers open positions`.replace(/\s+/g, " ").trim() },
    { query: `${base} ${kw} jobs`.replace(/\s+/g, " ").trim(), include_domains: ATS_DOMAINS },
  ];
}

const AGGREGATOR_NOISE =
  /(linkedin\.com|indeed\.com|glassdoor\.com|ziprecruiter\.com|reddit\.com|youtube\.com|facebook\.com|instagram\.com|twitter\.com|x\.com|tiktok\.com|quora\.com|medium\.com|wikipedia\.org|amazon\.com|flipkart\.com|naukri\.com|monster\.com|shine\.com|timesjobs\.com)$/i;

export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Pure: dedupes hits per site, drops obvious non-career noise, caps the count. */
export function selectSources(hits: Array<SearchHit & { query: string }>, max: number): DiscoveredSource[] {
  const seen = new Set<string>();
  const out: DiscoveredSource[] = [];
  for (const h of hits) {
    if (!/^https?:\/\//i.test(h.url)) continue;
    const host = hostOf(h.url);
    if (!host || AGGREGATOR_NOISE.test(host)) continue;
    let key = host;
    // ATS boards host many companies: keep one source per company slug.
    if (ATS_DOMAINS.some((d) => host.endsWith(d))) {
      const slug = new URL(h.url).pathname.split("/").filter(Boolean)[0] ?? "";
      key = `${host}/${slug}`;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `src-${out.length + 1}`,
      name: h.site_name || host,
      url: h.url,
      snippet: h.snippet ?? "",
      query: h.query,
    });
    if (out.length >= max) break;
  }
  return out;
}
