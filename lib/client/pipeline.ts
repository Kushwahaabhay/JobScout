import { dedupeJobs } from "../jobs/dedupe";
import { rankJobs } from "../jobs/match";
import { normalizeJob } from "../jobs/normalize";
import type {
  EnrichItem,
  Job,
  SearchCriteria,
  SourceLimits,
  SourceReport,
} from "../types";
import { ApiError, api } from "./api";

export type Stage = "search" | "agent" | "fetch" | "dedupe";
export type StageState = "idle" | "running" | "done" | "error" | "skipped";

export interface PipelineProgress {
  stages: Record<Stage, StageState>;
  detail: string;
  sources: SourceReport[];
}

export interface PipelineResult {
  jobs: Job[];
  sources: SourceReport[];
  searchedAt: string;
  warnings: string[];
  duplicatesRemoved: number;
  enriched: number;
  /** Set when the run could not produce any results at all. */
  fatal?: string;
}

const AGENT_CONCURRENCY = 3;

export const initialProgress = (): PipelineProgress => ({
  stages: { search: "idle", agent: "idle", fetch: "idle", dedupe: "idle" },
  detail: "",
  sources: [],
});

async function pool<T>(items: T[], size: number, worker: (item: T) => Promise<void>, signal: AbortSignal) {
  let i = 0;
  const run = async () => {
    while (i < items.length && !signal.aborted) {
      const item = items[i++];
      await worker(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
}

export function applyEnrichment(jobs: Job[], items: EnrichItem[]): Job[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return jobs.map((j) => {
    const e = byId.get(j.id);
    if (!e) return j;
    return {
      ...j,
      verification: e.verification,
      verification_note: e.verification_note,
      // Source-provided values only fill gaps; they never overwrite what the agent read.
      description: j.description || e.description || "",
      posted_date: j.posted_date ?? e.posted_date ?? null,
    };
  });
}

/** Search → Agent → Fetch → Deduplicate. Failures are collected per source; nothing is fabricated. */
export async function runPipeline(args: {
  apiKey: string;
  criteria: SearchCriteria;
  limits: SourceLimits;
  signal: AbortSignal;
  onProgress: (p: PipelineProgress) => void;
}): Promise<PipelineResult> {
  const { apiKey, criteria, limits, signal } = args;
  const progress = initialProgress();
  const emit = (patch?: Partial<PipelineProgress>) => {
    Object.assign(progress, patch);
    args.onProgress({ ...progress, stages: { ...progress.stages }, sources: [...progress.sources] });
  };
  const warnings: string[] = [];
  const searchedAt = new Date().toISOString();
  const empty = (fatal?: string): PipelineResult => ({
    jobs: [], sources: progress.sources, searchedAt, warnings, duplicatesRemoved: 0, enriched: 0, fatal,
  });

  // 1. Search
  progress.stages.search = "running";
  emit({ detail: "Searching for careers pages and job portals…" });
  let discovered;
  try {
    discovered = await api.search(apiKey, { criteria, limits }, signal);
  } catch (e) {
    progress.stages.search = "error";
    emit();
    return empty(e instanceof Error ? e.message : "Search failed.");
  }
  warnings.push(...discovered.warnings);
  progress.stages.search = "done";
  progress.sources = discovered.sources.map((s) => ({ ...s, status: "pending", jobs_found: 0 }));
  if (progress.sources.length === 0) {
    progress.stages.agent = progress.stages.fetch = progress.stages.dedupe = "skipped";
    emit({ detail: "No sources found." });
    return empty();
  }

  // 2. Agent — one live source per request, a few in parallel
  progress.stages.agent = "running";
  emit({ detail: `Agent is reading ${progress.sources.length} sources…` });
  const rawJobs: Job[] = [];
  const fetchedAt = new Date().toISOString();
  let authFatal: string | undefined;

  await pool(progress.sources, AGENT_CONCURRENCY, async (src) => {
    if (authFatal) return;
    src.status = "running";
    emit();
    try {
      const r = await api.extract(apiKey, { criteria, source: src }, signal);
      const jobs = r.jobs.map((j) => normalizeJob(j, src, fetchedAt)).filter((j): j is Job => j !== null);
      src.jobs_found = jobs.length;
      src.status = jobs.length ? "ok" : "empty";
      if (r.dropped) warnings.push(`${src.name}: ${r.dropped} malformed entries were skipped.`);
      rawJobs.push(...jobs);
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
      src.status = "failed";
      src.error = e instanceof Error ? e.message : "Unknown error";
      if (e instanceof ApiError && [401, 402].includes(e.status)) authFatal = e.message;
    }
    emit();
  }, signal);

  const failed = progress.sources.filter((s) => s.status === "failed").length;
  progress.stages.agent = failed === progress.sources.length ? "error" : "done";
  if (authFatal) {
    progress.stages.fetch = progress.stages.dedupe = "skipped";
    emit({ detail: authFatal });
    return empty(authFatal);
  }

  // Dedupe + rank before spending Fetch calls on duplicates.
  const first = dedupeJobs(rawJobs);
  let ranked = rankJobs(first.jobs, criteria);
  let removed = first.removed;

  // 3. Fetch — validate/enrich the top-ranked detail pages
  let enriched = 0;
  const toFetch = ranked
    .filter((j) => j.apply_url !== j.source_url)
    .slice(0, limits.maxDetailFetches);
  if (toFetch.length === 0) {
    progress.stages.fetch = "skipped";
  } else {
    progress.stages.fetch = "running";
    emit({ detail: `Fetching ${toFetch.length} job detail pages…` });
    const items: EnrichItem[] = [];
    const batches: typeof toFetch[] = [];
    for (let i = 0; i < toFetch.length; i += 10) batches.push(toFetch.slice(i, i + 10));
    let batchFails = 0;
    await pool(batches, 2, async (batch) => {
      try {
        const r = await api.enrich(
          apiKey,
          { jobs: batch.map((j) => ({ id: j.id, title: j.title, apply_url: j.apply_url })) },
          signal,
        );
        items.push(...r.items);
      } catch (e) {
        if ((e as Error).name === "AbortError") throw e;
        batchFails++;
        warnings.push(`Detail fetch failed for ${batch.length} jobs: ${e instanceof Error ? e.message : "unknown error"}`);
      }
    }, signal);
    progress.stages.fetch = batchFails === batches.length ? "error" : "done";
    enriched = items.filter((i) => i.verification === "page_loaded").length;
    ranked = rankJobs(applyEnrichment(ranked, items), criteria);
  }

  // 4. Final dedupe (enrichment can reveal identical postings)
  progress.stages.dedupe = "running";
  emit();
  const second = dedupeJobs(ranked);
  removed += second.removed;
  progress.stages.dedupe = "done";
  emit({ detail: "Done." });

  return {
    jobs: rankJobs(second.jobs, criteria),
    sources: progress.sources,
    searchedAt,
    warnings,
    duplicatesRemoved: removed,
    enriched,
  };
}
