import { z } from "zod";
import type { RawJob, SearchCriteria } from "../types";
import { TinyFishError, friendlyMessage, tinyfishRequest } from "./http";

export const AGENT_BASE = "https://agent.tinyfish.ai";
export const AGENT_RUN_ASYNC_URL = `${AGENT_BASE}/v1/automation/run-async`;
export const RUN_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
/** Handed to TinyFish so a run can never go on forever. */
export const AGENT_MAX_DURATION_SECONDS = 120;

/** Uses only the documented output_schema subset (no additionalProperties; nullable instead of type arrays). */
export const JOB_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    jobs: {
      type: "array",
      maxItems: 10,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          company: { type: "string", nullable: true },
          location: { type: "string", nullable: true },
          employment_type: { type: "string", nullable: true },
          seniority: { type: "string", nullable: true },
          description: { type: "string", nullable: true },
          apply_url: { type: "string", nullable: true },
          posted_date: { type: "string", nullable: true },
        },
        required: ["title"],
      },
    },
  },
  required: ["jobs"],
} as const;

export function buildGoal(c: SearchCriteria): string {
  const kind =
    c.employment === "internship" ? "internships" : c.employment === "full-time" ? "full-time roles" : "roles";
  return [
    `Find up to 8 currently listed ${kind} on this site that match: "${c.role}"${
      c.location ? ` in or near "${c.location}" (remote counts only if the posting says so)` : ""
    }.`,
    c.keywords.length ? `Prefer postings mentioning: ${c.keywords.join(", ")}.` : "",
    "Work fast: use the site's own search or filters if present, read the listing page(s) only (at most 2 pages of results), and do NOT open individual job pages. Stay on this site.",
    "For each posting return ONLY what is literally shown on the page: title, company, location, employment type, seniority, a short description (max 400 characters), the absolute URL of the posting or its apply page, and the posted date if displayed.",
    "Use null for anything not shown. Never guess or invent values. If there are no matching postings, return an empty jobs array.",
  ]
    .filter(Boolean)
    .join(" ");
}

const Str = z.string().nullish();
const JobSchema = z.object({
  title: z.string().min(1),
  company: Str,
  location: Str,
  employment_type: Str,
  seniority: Str,
  description: Str,
  apply_url: Str,
  posted_date: Str,
});

/** Pure: extracts valid jobs from an arbitrary agent result, skipping malformed entries. */
export function parseAgentResult(result: unknown): { jobs: RawJob[]; dropped: number } {
  let list: unknown = null;
  if (Array.isArray(result)) list = result;
  else if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    list = r.jobs ?? r.openings ?? r.results;
    if (typeof list === "string") {
      try {
        list = JSON.parse(list);
      } catch {
        list = null;
      }
    }
  }
  if (!Array.isArray(list)) {
    throw new TinyFishError("The agent returned output we could not read as a job list.", "MALFORMED_OUTPUT", 502);
  }
  const jobs: RawJob[] = [];
  let dropped = 0;
  for (const item of list) {
    const p = JobSchema.safeParse(item);
    if (p.success) jobs.push(p.data as RawJob);
    else dropped++;
  }
  return { jobs, dropped };
}

export type AgentRunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";

interface RunError {
  code?: string;
  message?: string;
  retry_after?: number | null;
}

/** Stage 2a: starts an async Agent run and returns at once with its id (no long-lived connection). */
export async function startAgentRun(
  apiKey: string,
  sourceUrl: string,
  criteria: SearchCriteria,
  fetchImpl?: typeof fetch,
): Promise<string> {
  const res = await tinyfishRequest<{ run_id?: string | null; error?: RunError | null }>({
    url: AGENT_RUN_ASYNC_URL,
    method: "POST",
    apiKey,
    timeoutMs: 30_000,
    fetchImpl,
    body: {
      url: sourceUrl,
      goal: buildGoal(criteria),
      output_schema: JOB_OUTPUT_SCHEMA,
      browser_profile: "lite",
      agent_config: { max_duration_seconds: AGENT_MAX_DURATION_SECONDS },
    },
  });
  if (!res.run_id) {
    const code = res.error?.code ?? "INTERNAL_ERROR";
    throw new TinyFishError(friendlyMessage(code, res.error?.message ?? "TinyFish could not start the run."), code, 502);
  }
  return res.run_id;
}

export type AgentRunState =
  | { state: "running"; status: string }
  | { state: "done"; jobs: RawJob[]; dropped: number; steps: number | null }
  | { state: "failed"; code: string; message: string; retryAfter: number | null };

/** Pure: interprets a GET /v1/runs/{id} body. */
export function interpretRun(run: {
  status?: string;
  num_of_steps?: number | null;
  result?: unknown;
  error?: RunError | null;
}): AgentRunState {
  if (run.status === "COMPLETED" && !run.error) {
    const { jobs, dropped } = parseAgentResult(run.result);
    return { state: "done", jobs, dropped, steps: run.num_of_steps ?? null };
  }
  if (run.status === "FAILED" || run.status === "CANCELLED" || run.error) {
    const code = run.error?.code ?? (run.status === "CANCELLED" ? "CANCELLED" : "TASK_FAILED");
    return {
      state: "failed",
      code,
      message: friendlyMessage(code, run.error?.message ?? "The agent could not complete this source."),
      retryAfter: run.error?.retry_after ?? null,
    };
  }
  return { state: "running", status: run.status ?? "PENDING" };
}

/** Stage 2b: polls one run. */
export async function getAgentRun(apiKey: string, runId: string, fetchImpl?: typeof fetch): Promise<AgentRunState> {
  if (!RUN_ID_RE.test(runId)) throw new TinyFishError("Invalid run id.", "INVALID_INPUT", 400);
  const run = await tinyfishRequest<Parameters<typeof interpretRun>[0]>({
    // Screenshots/HTML are not needed; keep the poll response small.
    url: `${AGENT_BASE}/v1/runs/${runId}?screenshots=none&html=none`,
    method: "GET",
    apiKey,
    timeoutMs: 30_000,
    fetchImpl,
  });
  return interpretRun(run);
}

/** Best-effort cancel so a timed-out run stops consuming credits. */
export async function cancelAgentRun(apiKey: string, runId: string, fetchImpl?: typeof fetch): Promise<void> {
  if (!RUN_ID_RE.test(runId)) return;
  try {
    await tinyfishRequest<unknown>({
      url: `${AGENT_BASE}/v1/runs/${runId}/cancel`,
      method: "POST",
      apiKey,
      body: {},
      timeoutMs: 15_000,
      fetchImpl,
    });
  } catch {
    /* already finished, or cancel unavailable: nothing more to do */
  }
}
