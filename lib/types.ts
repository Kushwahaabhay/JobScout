/** Shared API contracts between the browser and the route handlers. */

export type EmploymentType = "internship" | "full-time" | "part-time" | "contract" | "unknown";
export type Seniority = "intern" | "entry" | "mid" | "senior" | "lead" | "unknown";
export type EmploymentPreference = "any" | "internship" | "full-time";
export type SeniorityPreference = "any" | Exclude<Seniority, "unknown">;

export interface SearchCriteria {
  role: string;
  location: string;
  seniority: SeniorityPreference;
  employment: EmploymentPreference;
  /** Parsed from the comma-separated input. */
  keywords: string[];
}

export interface SourceLimits {
  maxSources: number;
  maxDetailFetches: number;
}

export type SourceStatus = "pending" | "running" | "ok" | "empty" | "failed";

export interface DiscoveredSource {
  id: string;
  name: string;
  url: string;
  snippet: string;
  /** Search query that surfaced this source. */
  query: string;
}

export interface SourceReport extends DiscoveredSource {
  status: SourceStatus;
  jobs_found: number;
  error?: string;
}

/** Fields the agent extracted straight from the live page. */
export interface RawJob {
  title: string;
  company?: string | null;
  location?: string | null;
  employment_type?: string | null;
  seniority?: string | null;
  description?: string | null;
  apply_url?: string | null;
  posted_date?: string | null;
}

export type Verification =
  | "not_checked"
  | "page_loaded" // detail page fetched and mentions the job title
  | "page_loaded_unmatched" // page fetched but title not found in it
  | "not_found" // 404 / 410
  | "fetch_failed";

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  employment_type: EmploymentType;
  seniority: Seniority;
  description: string;
  source_name: string;
  source_url: string;
  apply_url: string;
  /** Only set when the source page states it. */
  posted_date: string | null;
  matched_keywords: string[];
  match_score: number;
  /** Human-readable, inferred by JobScout (not source facts). */
  match_reasons: string[];
  /** Fields whose value was derived by us rather than stated by the source. */
  inferred_fields: Array<"employment_type" | "seniority">;
  verification: Verification;
  verification_note?: string;
  fetched_at: string;
  /** True for development fixtures only. */
  fixture?: boolean;
}

/* ---- route contracts ---- */

export interface ErrorBody {
  error: { code: string; message: string; retry_after?: number | null };
}

export interface ConnectResponse {
  ok: true;
}

export interface SearchRequest {
  criteria: SearchCriteria;
  limits: SourceLimits;
}
export interface SearchResponse {
  sources: DiscoveredSource[];
  queries: string[];
  warnings: string[];
}

export interface ExtractRequest {
  criteria: SearchCriteria;
  source: DiscoveredSource;
}
export interface ExtractResponse {
  jobs: RawJob[];
  run_id: string | null;
  steps: number | null;
  dropped: number;
}

export interface EnrichRequest {
  jobs: Array<{ id: string; title: string; apply_url: string }>;
}
export interface EnrichItem {
  id: string;
  verification: Verification;
  verification_note?: string;
  description?: string;
  posted_date?: string | null;
}
export interface EnrichResponse {
  items: EnrichItem[];
}
