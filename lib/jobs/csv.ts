import type { Job } from "../types";

const COLUMNS: Array<[string, (j: Job) => string | number | null]> = [
  ["title", (j) => j.title],
  ["company", (j) => j.company],
  ["location", (j) => j.location],
  ["employment_type", (j) => j.employment_type],
  ["seniority", (j) => j.seniority],
  ["match_score", (j) => j.match_score],
  ["matched_keywords", (j) => j.matched_keywords.join("; ")],
  ["posted_date", (j) => j.posted_date],
  ["source_name", (j) => j.source_name],
  ["source_url", (j) => j.source_url],
  ["apply_url", (j) => j.apply_url],
  ["verification", (j) => j.verification],
  ["fetched_at", (j) => j.fetched_at],
];

function cell(v: string | number | null): string {
  let s = v === null ? "" : String(v);
  // Neutralize spreadsheet formula injection from scraped text.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function jobsToCsv(jobs: Job[]): string {
  const head = COLUMNS.map(([n]) => n).join(",");
  const rows = jobs.map((j) => COLUMNS.map(([, f]) => cell(f(j))).join(","));
  return [head, ...rows].join("\r\n");
}
