import type { DiscoveredSource, EmploymentType, Job, RawJob, Seniority } from "../types";

const TRACKING_PARAMS = /^(utm_.+|gh_src|gh_jid_src|lever-source|lever-origin|ref|referrer|source|src|fbclid|gclid|trk|mc_.+)$/i;

/** Canonical form of an application URL, used as the primary dedupe key. */
export function canonicalUrl(input: string): string | null {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  u.hash = "";
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  for (const k of [...u.searchParams.keys()]) if (TRACKING_PARAMS.test(k)) u.searchParams.delete(k);
  u.searchParams.sort();
  let path = u.pathname.replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  const qs = u.searchParams.toString();
  return `${u.protocol}//${u.host}${path}${qs ? `?${qs}` : ""}`;
}

export function resolveUrl(candidate: string | null | undefined, base: string): string | null {
  if (!candidate) return null;
  try {
    const u = new URL(candidate.trim(), base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function parseEmploymentType(text: string | null | undefined): EmploymentType {
  const t = (text ?? "").toLowerCase();
  if (/\b(intern|internship|co-?op|trainee)\b/.test(t)) return "internship";
  if (/\bpart[\s-]?time\b/.test(t)) return "part-time";
  if (/\b(contract|contractor|freelance|temporary)\b/.test(t)) return "contract";
  if (/\bfull[\s-]?time\b|\bpermanent\b/.test(t)) return "full-time";
  return "unknown";
}

export function parseSeniority(text: string | null | undefined): Seniority {
  const t = (text ?? "").toLowerCase();
  if (/\b(intern|internship|trainee|co-?op)\b/.test(t)) return "intern";
  if (/\b(lead|principal|staff|head of|director|manager)\b/.test(t)) return "lead";
  if (/\b(senior|sr\.?|iii|iv)\b/.test(t)) return "senior";
  if (/\b(junior|jr\.?|entry|graduate|new grad|associate|early career)\b/.test(t)) return "entry";
  if (/\b(mid|intermediate|ii)\b/.test(t)) return "mid";
  return "unknown";
}

/** Returns YYYY-MM-DD only when the string is an unambiguous absolute date; otherwise null. */
export function parseDate(text: string | null | undefined): string | null {
  if (!text) return null;
  const s = text.trim();
  if (!/\d{4}/.test(s)) return null; // refuse relative ("3 days ago") and year-less dates
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  if (y < 2000 || d.getTime() > Date.now() + 86_400_000) return null;
  return d.toISOString().slice(0, 10);
}

export function cleanText(s: string | null | undefined, max = 600): string {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Normalizes one agent-extracted job. Returns null when there is no usable title. */
export function normalizeJob(raw: RawJob, source: DiscoveredSource, fetchedAt: string): Job | null {
  const title = cleanText(raw.title, 200);
  if (!title) return null;

  const apply = resolveUrl(raw.apply_url, source.url);
  const applyUrl = apply ?? source.url;
  const company = cleanText(raw.company, 120) || source.name;
  const location = cleanText(raw.location, 160);
  const description = cleanText(raw.description);

  const inferred: Job["inferred_fields"] = [];
  let employment = parseEmploymentType(raw.employment_type);
  if (employment === "unknown") {
    employment = parseEmploymentType(`${title} ${description}`);
    if (employment !== "unknown") inferred.push("employment_type");
  }
  let seniority = parseSeniority(raw.seniority);
  if (seniority === "unknown") {
    seniority = parseSeniority(title);
    if (seniority !== "unknown") inferred.push("seniority");
  }

  return {
    id: hash(`${canonicalUrl(applyUrl) ?? applyUrl}|${title}|${company}|${location}`),
    title,
    company,
    location,
    employment_type: employment,
    seniority,
    description,
    source_name: source.name,
    source_url: source.url,
    apply_url: applyUrl,
    posted_date: parseDate(raw.posted_date),
    matched_keywords: [],
    match_score: 0,
    match_reasons: [],
    inferred_fields: inferred,
    verification: "not_checked",
    fetched_at: fetchedAt,
  };
}
