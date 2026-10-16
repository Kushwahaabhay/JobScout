import { describe, expect, it } from "vitest";
import { canonicalUrl, normalizeJob, parseDate, parseEmploymentType, parseSeniority } from "@/lib/jobs/normalize";
import { parseKeywords, rankJobs, scoreJob } from "@/lib/jobs/match";
import { dedupeJobs } from "@/lib/jobs/dedupe";
import { jobsToCsv } from "@/lib/jobs/csv";
import { buildEnrichItems } from "@/lib/jobs/enrich";
import { parseAgentResult, JOB_OUTPUT_SCHEMA } from "@/lib/tinyfish/agent";
import { buildQueries, selectSources } from "@/lib/tinyfish/search";
import type { DiscoveredSource, Job, SearchCriteria } from "@/lib/types";

const src: DiscoveredSource = { id: "s1", name: "Acme", url: "https://acme.com/careers", snippet: "", query: "q" };
const NOW = "2026-10-17T00:00:00.000Z";
const criteria: SearchCriteria = {
  role: "Software Engineer", location: "Bengaluru", seniority: "any", employment: "internship", keywords: ["React", "Python"],
};
const mk = (o: Partial<Job> = {}): Job => ({
  ...(normalizeJob({ title: "Software Engineer Intern", company: "Acme", location: "Bengaluru, India", apply_url: "https://acme.com/jobs/1" }, src, NOW) as Job),
  ...o,
});

describe("normalization", () => {
  it("canonicalizes URLs (tracking params, hash, trailing slash, www, host case)", () => {
    expect(canonicalUrl("https://WWW.Acme.com/jobs/1/?utm_source=x&gh_src=y&id=2#apply")).toBe("https://acme.com/jobs/1?id=2");
    expect(canonicalUrl("javascript:alert(1)")).toBeNull();
    expect(canonicalUrl("not a url")).toBeNull();
  });

  it("resolves relative apply links against the source", () => {
    const j = normalizeJob({ title: "Dev", apply_url: "/jobs/9" }, src, NOW)!;
    expect(j.apply_url).toBe("https://acme.com/jobs/9");
  });

  it("falls back to the source URL when no apply link is given", () => {
    expect(normalizeJob({ title: "Dev" }, src, NOW)!.apply_url).toBe(src.url);
  });

  it("rejects javascript: apply links", () => {
    expect(normalizeJob({ title: "Dev", apply_url: "javascript:x" }, src, NOW)!.apply_url).toBe(src.url);
  });

  it("returns null without a title", () => {
    expect(normalizeJob({ title: "  " }, src, NOW)).toBeNull();
  });

  it("parses employment type and seniority", () => {
    expect(parseEmploymentType("Summer Internship")).toBe("internship");
    expect(parseEmploymentType("Full Time")).toBe("full-time");
    expect(parseEmploymentType("")).toBe("unknown");
    expect(parseSeniority("Senior Engineer")).toBe("senior");
    expect(parseSeniority("Graduate Software Engineer")).toBe("entry");
    expect(parseSeniority("Engineer")).toBe("unknown");
  });

  it("flags inferred fields and keeps stated ones unflagged", () => {
    const inferred = normalizeJob({ title: "Software Engineer Intern" }, src, NOW)!;
    expect(inferred.employment_type).toBe("internship");
    expect(inferred.inferred_fields).toContain("employment_type");
    const stated = normalizeJob({ title: "Engineer", employment_type: "Full-time" }, src, NOW)!;
    expect(stated.inferred_fields).not.toContain("employment_type");
  });

  it("never invents dates: only absolute dates with a year are accepted", () => {
    expect(parseDate("3 days ago")).toBeNull();
    expect(parseDate("Oct 5")).toBeNull();
    expect(parseDate("2026-10-05")).toBe("2026-10-05");
    expect(parseDate("2099-01-01")).toBeNull();
    expect(normalizeJob({ title: "Dev" }, src, NOW)!.posted_date).toBeNull();
  });
});

describe("matching", () => {
  it("scores a strong match above a weak one", () => {
    const strong = mk({ description: "Build React and Python services" });
    const weak = mk({ title: "Chef", location: "Paris", employment_type: "full-time", description: "" });
    expect(scoreJob(strong, criteria).score).toBeGreaterThan(scoreJob(weak, criteria).score);
  });

  it("reports matched keywords on word boundaries only", () => {
    const j = mk({ description: "We use Reactive patterns and Python" });
    expect(scoreJob(j, criteria).matched_keywords).toEqual(["Python"]);
  });

  it("matches symbol keywords like C++ and .NET", () => {
    const j = mk({ description: "C++ and .NET experience" });
    const r = scoreJob(j, { ...criteria, keywords: ["C++", ".NET"] });
    expect(r.matched_keywords).toEqual(["C++", ".NET"]);
  });

  it("clamps score to 0..100 and ranks descending", () => {
    const a = mk({ id: "a", title: "Chef", location: "Paris", description: "" });
    const b = mk({ id: "b", description: "React Python" });
    const ranked = rankJobs([a, b], criteria);
    expect(ranked[0].id).toBe("b");
    for (const r of ranked) expect(r.match_score).toBeGreaterThanOrEqual(0);
    expect(ranked[0].match_score).toBeLessThanOrEqual(100);
  });

  it("parses comma separated keywords, deduped", () => {
    expect(parseKeywords(" React, python ,react,, ")).toEqual(["React", "python"]);
  });
});

describe("deduplication", () => {
  it("merges by canonical apply URL", () => {
    const a = mk({ apply_url: "https://acme.com/jobs/1?utm_source=a", title: "A" });
    const b = mk({ apply_url: "https://www.acme.com/jobs/1/#x", title: "B" });
    expect(dedupeJobs([a, b]).jobs).toHaveLength(1);
  });

  it("falls back to title/company/location when URLs differ", () => {
    const a = mk({ apply_url: "https://acme.com/jobs/1" });
    const b = mk({ apply_url: "https://boards.greenhouse.io/acme/jobs/99", title: "software  engineer INTERN!" });
    expect(dedupeJobs([a, b]).jobs).toHaveLength(1);
  });

  it("keeps genuinely different jobs", () => {
    const a = mk();
    const b = mk({ apply_url: "https://acme.com/jobs/2", title: "Data Analyst" });
    expect(dedupeJobs([a, b])).toMatchObject({ removed: 0 });
  });

  it("keeps the richer record", () => {
    const a = mk({ description: "" });
    const b = mk({ description: "Has details", posted_date: "2026-10-01" });
    expect(dedupeJobs([a, b]).jobs[0].description).toBe("Has details");
  });

  it("does not collapse distinct jobs that only share the source-page URL", () => {
    const a = mk({ apply_url: src.url, title: "Role One" });
    const b = mk({ apply_url: src.url, title: "Role Two" });
    expect(dedupeJobs([a, b]).jobs).toHaveLength(2);
  });
});

describe("agent output, search and fetch helpers", () => {
  it("parses valid agent output and drops malformed entries", () => {
    const r = parseAgentResult({ jobs: [{ title: "A" }, { company: "no title" }, 5] });
    expect(r.jobs).toHaveLength(1);
    expect(r.dropped).toBe(2);
  });

  it("accepts JSON strings and rejects unreadable output", () => {
    expect(parseAgentResult({ jobs: '[{"title":"A"}]' }).jobs).toHaveLength(1);
    expect(() => parseAgentResult({ foo: 1 })).toThrow(/could not read/);
    expect(() => parseAgentResult(null)).toThrow();
  });

  it("uses only supported output_schema keywords", () => {
    const s = JSON.stringify(JOB_OUTPUT_SCHEMA);
    expect(s).not.toMatch(/additionalProperties|oneOf|const|\["string","null"\]/);
  });

  it("builds queries and selects distinct sources within the cap", () => {
    const qs = buildQueries(criteria);
    expect(qs).toHaveLength(2);
    expect(qs[1].include_domains).toContain("jobs.lever.co");
    const hits = [
      { url: "https://acme.com/careers", site_name: "acme.com", query: "q" },
      { url: "https://acme.com/careers/2", site_name: "acme.com", query: "q" },
      { url: "https://www.linkedin.com/jobs/x", query: "q" },
      { url: "https://jobs.lever.co/foo/1", query: "q" },
      { url: "https://jobs.lever.co/foo/2", query: "q" },
      { url: "https://jobs.lever.co/bar/1", query: "q" },
    ];
    const out = selectSources(hits, 3);
    expect(out.map((s) => s.url)).toEqual(["https://acme.com/careers", "https://jobs.lever.co/foo/1", "https://jobs.lever.co/bar/1"]);
  });

  it("maps fetch results and errors to verification states without claiming 'open'", () => {
    const jobs = [
      { id: "1", title: "Software Engineer Intern", apply_url: "https://a.com/1" },
      { id: "2", title: "Data Analyst", apply_url: "https://a.com/2" },
      { id: "3", title: "Designer", apply_url: "https://a.com/3" },
      { id: "4", title: "Chef", apply_url: "https://a.com/4" },
    ];
    const items = buildEnrichItems(
      jobs,
      [
        { url: "https://a.com/1", title: "Software Engineer Intern", text: "About the role…", published_date: "2026-09-30" },
        { url: "https://a.com/2", title: "Careers", text: "all jobs list" },
      ],
      [{ url: "https://a.com/3", error: "page_not_found", status: 404 }],
    );
    expect(items.map((i) => i.verification)).toEqual(["page_loaded", "page_loaded_unmatched", "not_found", "fetch_failed"]);
    expect(items[0].posted_date).toBe("2026-09-30");
  });
});

describe("csv export", () => {
  it("escapes quotes/commas and neutralizes formulas", () => {
    const csv = jobsToCsv([mk({ title: '=HYPERLINK("x")', company: "A, B" })]);
    const row = csv.split("\r\n")[1];
    expect(row.startsWith("\"'=HYPERLINK(\"\"x\"\")\"")).toBe(true);
    expect(row).toContain('"A, B"');
    expect(csv.split("\r\n")[0]).toContain("apply_url");
  });
});
