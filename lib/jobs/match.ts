import type { Job, SearchCriteria } from "../types";

const STOP = new Set(["the", "a", "an", "and", "or", "of", "for", "in", "at", "to", "with", "intern", "internship"]);

export function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s/-]/g, " ")
    .split(/[\s/]+/)
    .map((t) => t.replace(/^[.-]+|[.-]+$/g, ""))
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function hasTerm(haystack: string, term: string): boolean {
  const t = term.toLowerCase().trim();
  if (!t) return false;
  const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, "i").test(haystack);
}

export function parseKeywords(input: string): string[] {
  const seen = new Set<string>();
  return input
    .split(",")
    .map((k) => k.trim())
    .filter((k) => {
      const key = k.toLowerCase();
      if (!k || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export interface MatchResult {
  score: number;
  matched_keywords: string[];
  reasons: string[];
}

/**
 * Deterministic relevance score 0–100:
 * role 40 · keywords 25 · location 20 · employment 10 · seniority 5.
 * Reasons are our inference, not source facts.
 */
export function scoreJob(job: Job, c: SearchCriteria): MatchResult {
  const reasons: string[] = [];
  let score = 0;

  // Role: share of role tokens found in the title (full weight) or description (half).
  const roleTokens = tokens(c.role);
  if (roleTokens.length) {
    const title = job.title.toLowerCase();
    const desc = job.description.toLowerCase();
    let pts = 0;
    for (const t of roleTokens) {
      if (hasTerm(title, t)) pts += 1;
      else if (hasTerm(desc, t)) pts += 0.5;
    }
    const part = pts / roleTokens.length;
    score += Math.round(40 * part);
    if (part >= 0.99) reasons.push("Title matches your role");
    else if (part > 0) reasons.push("Title or description partly matches your role");
  }

  // Keywords
  const text = `${job.title} ${job.description}`;
  const matched = c.keywords.filter((k) => hasTerm(text, k));
  if (c.keywords.length) {
    score += Math.round(25 * (matched.length / c.keywords.length));
    if (matched.length) reasons.push(`Mentions ${matched.join(", ")}`);
  }

  // Location
  const wantLoc = c.location.trim().toLowerCase();
  if (wantLoc) {
    const loc = job.location.toLowerCase();
    const locTokens = tokens(wantLoc);
    if (loc && locTokens.length && locTokens.every((t) => hasTerm(loc, t))) {
      score += 20;
      reasons.push("Location matches");
    } else if (loc && locTokens.some((t) => hasTerm(loc, t))) {
      score += 10;
      reasons.push("Location partly matches");
    } else if (/\bremote\b/.test(loc)) {
      score += 8;
      reasons.push("Listed as remote");
    }
  }

  // Employment preference
  if (c.employment !== "any" && job.employment_type === c.employment) {
    score += 10;
    reasons.push(job.inferred_fields.includes("employment_type") ? "Looks like " + c.employment + " (inferred)" : "Employment type matches");
  } else if (c.employment !== "any" && job.employment_type !== "unknown") {
    score -= 10;
  }

  // Seniority preference
  if (c.seniority !== "any" && job.seniority === c.seniority) {
    score += 5;
    reasons.push(job.inferred_fields.includes("seniority") ? "Seniority looks right (inferred)" : "Seniority matches");
  }

  return { score: Math.max(0, Math.min(100, score)), matched_keywords: matched, reasons };
}

export function rankJobs(jobs: Job[], c: SearchCriteria): Job[] {
  return jobs
    .map((j) => {
      const m = scoreJob(j, c);
      return { ...j, match_score: m.score, matched_keywords: m.matched_keywords, match_reasons: m.reasons };
    })
    .sort((a, b) => b.match_score - a.match_score || a.title.localeCompare(b.title));
}
