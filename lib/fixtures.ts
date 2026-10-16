import type { Job, SourceReport } from "./types";

/** Development-only sample data. Gated in the UI by NEXT_PUBLIC_ENABLE_FIXTURES and never shown in production. */
export const FIXTURES_ENABLED =
  process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ENABLE_FIXTURES === "true";

export function fixtureJobs(): { jobs: Job[]; sources: SourceReport[] } {
  const now = new Date().toISOString();
  const src = { id: "fx-1", name: "FIXTURE · example.com/careers", url: "https://example.com/careers", snippet: "", query: "fixture" };
  const mk = (n: number, title: string, type: Job["employment_type"], score: number): Job => ({
    id: `fx-${n}`, title, company: "Example Co (fixture)", location: "Bengaluru, India", employment_type: type,
    seniority: "entry", description: "Fixture record for UI development. Not a real opening.",
    source_name: src.name, source_url: src.url, apply_url: `https://example.com/careers/${n}`, posted_date: null,
    matched_keywords: ["React"], match_score: score, match_reasons: ["Fixture"], inferred_fields: [],
    verification: "not_checked", fetched_at: now, fixture: true,
  });
  return {
    jobs: [mk(1, "Software Engineer Intern", "internship", 82), mk(2, "Frontend Engineer", "full-time", 61)],
    sources: [{ ...src, status: "ok", jobs_found: 2 }],
  };
}
