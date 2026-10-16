import { z } from "zod";
import type { RawJob, SearchCriteria } from "../types";
import { TinyFishError, friendlyMessage, tinyfishRequest } from "./http";

export const AGENT_RUN_URL = "https://agent.tinyfish.ai/v1/automation/run";

/** Uses only the documented output_schema subset (no additionalProperties; nullable instead of type arrays). */
export const JOB_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    jobs: {
      type: "array",
      maxItems: 15,
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
    `Find up to 10 currently listed ${kind} on this site that match: "${c.role}"${
      c.location ? ` in or near "${c.location}" (remote counts only if the posting says so)` : ""
    }.`,
    c.keywords.length ? `Prefer postings mentioning: ${c.keywords.join(", ")}.` : "",
    "Use the site's own search or filters if present; stay on the site except to follow job links.",
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

interface RunResponse {
  run_id?: string | null;
  status?: string;
  num_of_steps?: number | null;
  result?: unknown;
  error?: { code?: string; message?: string; retry_after?: number | null } | null;
}

export async function tinyfishAgentExtract(
  apiKey: string,
  sourceUrl: string,
  criteria: SearchCriteria,
  opts: { fetchImpl?: typeof fetch; maxDurationSeconds?: number } = {},
): Promise<{ jobs: RawJob[]; dropped: number; run_id: string | null; steps: number | null }> {
  const maxDur = opts.maxDurationSeconds ?? 150;
  const res = await tinyfishRequest<RunResponse>({
    url: AGENT_RUN_URL,
    method: "POST",
    apiKey,
    timeoutMs: (maxDur + 30) * 1000,
    fetchImpl: opts.fetchImpl,
    body: {
      url: sourceUrl,
      goal: buildGoal(criteria),
      output_schema: JOB_OUTPUT_SCHEMA,
      browser_profile: "lite",
      agent_config: { max_duration_seconds: maxDur },
    },
  });
  if (res.status === "FAILED" || res.error) {
    const code = res.error?.code ?? "TASK_FAILED";
    throw new TinyFishError(
      friendlyMessage(code, res.error?.message ?? "The agent could not complete this source."),
      code,
      502,
      res.error?.retry_after ?? null,
    );
  }
  const { jobs, dropped } = parseAgentResult(res.result);
  return { jobs, dropped, run_id: res.run_id ?? null, steps: res.num_of_steps ?? null };
}
