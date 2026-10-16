import type { ExtractRequest, ExtractStatusResponse, RawJob } from "../types";
import { ApiError } from "./api";

export const POLL_INTERVAL_MS = 3_000;
/** Client-side deadline per source (TinyFish itself is capped at 120s of run time plus queueing). */
export const SOURCE_DEADLINE_MS = 150_000;
const MAX_CONSECUTIVE_POLL_ERRORS = 3;

export interface AgentApi {
  extractStart(key: string, body: ExtractRequest, signal?: AbortSignal): Promise<{ run_id: string }>;
  extractStatus(key: string, runId: string, signal?: AbortSignal): Promise<ExtractStatusResponse>;
  extractCancel(key: string, runId: string): Promise<unknown>;
}

export interface AgentRunOptions {
  signal?: AbortSignal;
  intervalMs?: number;
  deadlineMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Starts an Agent run for one source and polls until it finishes, fails, or the deadline passes (then cancels it). */
export async function runAgentOnSource(
  api: AgentApi,
  apiKey: string,
  req: ExtractRequest,
  opts: AgentRunOptions = {},
): Promise<{ jobs: RawJob[]; dropped: number; steps: number | null }> {
  const sleep = opts.sleep ?? defaultSleep;
  const now = opts.now ?? Date.now;
  const interval = opts.intervalMs ?? POLL_INTERVAL_MS;
  const deadline = now() + (opts.deadlineMs ?? SOURCE_DEADLINE_MS);

  const { run_id } = await api.extractStart(apiKey, req, opts.signal);
  let pollErrors = 0;

  while (true) {
    if (opts.signal?.aborted) {
      void api.extractCancel(apiKey, run_id);
      throw new DOMException("Aborted", "AbortError");
    }
    if (now() >= deadline) {
      void api.extractCancel(apiKey, run_id);
      throw new ApiError(
        `This site took longer than ${Math.round((opts.deadlineMs ?? SOURCE_DEADLINE_MS) / 1000)}s to read, so it was stopped. Try again or lower the number of sources.`,
        "TIMEOUT",
        504,
        null,
      );
    }
    await sleep(interval);
    try {
      const s = await api.extractStatus(apiKey, run_id, opts.signal);
      pollErrors = 0;
      if (s.state === "done") return { jobs: s.jobs, dropped: s.dropped, steps: s.steps };
      if (s.state === "failed") throw new ApiError(s.message, s.code, 502, s.retry_after);
    } catch (e) {
      if (e instanceof ApiError && (e.code === "UNAUTHENTICATED" || e.status === 401 || e.status === 402)) throw e;
      if ((e as Error).name === "AbortError") throw e;
      // A run-level failure was thrown just above as ApiError(502); only transient poll errors are retried.
      if (e instanceof ApiError && e.status === 502 && e.code !== "NETWORK_ERROR" && e.code !== "HTTP_ERROR") throw e;
      if (++pollErrors >= MAX_CONSECUTIVE_POLL_ERRORS) throw e;
    }
  }
}
