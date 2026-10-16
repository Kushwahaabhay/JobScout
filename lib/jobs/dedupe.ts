import type { Job } from "../types";
import { canonicalUrl } from "./normalize";

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function fallbackKey(j: Pick<Job, "title" | "company" | "location">): string {
  return `${norm(j.title)}|${norm(j.company)}|${norm(j.location)}`;
}

/** A job with only the source page as its URL has no real application URL; skip URL-key dedupe for it. */
function urlKey(j: Job): string | null {
  const a = canonicalUrl(j.apply_url);
  const s = canonicalUrl(j.source_url);
  return a && a !== s ? a : null;
}

function richness(j: Job): number {
  return (j.description ? 1 : 0) + (j.posted_date ? 1 : 0) + (j.location ? 1 : 0) + (urlKey(j) ? 2 : 0);
}

function pick(a: Job, b: Job): Job {
  return richness(b) > richness(a) ? b : a;
}

/** Primary key: canonical apply URL. Fallback: normalized title/company/location. */
export function dedupeJobs(jobs: Job[]): { jobs: Job[]; removed: number } {
  const byUrl = new Map<string, number>();
  const byFallback = new Map<string, number>();
  const out: Job[] = [];

  for (const j of jobs) {
    const uk = urlKey(j);
    const fk = fallbackKey(j);
    const idx = (uk !== null ? byUrl.get(uk) : undefined) ?? byFallback.get(fk);
    if (idx === undefined) {
      const i = out.push(j) - 1;
      if (uk) byUrl.set(uk, i);
      byFallback.set(fk, i);
    } else {
      const winner = pick(out[idx], j);
      out[idx] = winner;
      const wk = urlKey(winner);
      if (wk) byUrl.set(wk, idx);
    }
  }
  return { jobs: out, removed: jobs.length - out.length };
}
