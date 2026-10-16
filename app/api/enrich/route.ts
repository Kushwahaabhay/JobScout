import { NextResponse } from "next/server";
import { tinyfishFetch } from "@/lib/tinyfish/fetch";
import { buildEnrichItems } from "@/lib/jobs/enrich";
import { errorResponse, fromError, parseBody, readApiKey } from "@/lib/server/route";
import { enrichRequestSchema } from "@/lib/server/schemas";
import type { EnrichResponse } from "@/lib/types";

export const maxDuration = 150;

/** Stage 3 — TinyFish Fetch: read job-detail URLs to validate and enrich (max 10 per call). */
export async function POST(req: Request) {
  const key = readApiKey(req);
  if (!key) return errorResponse("MISSING_API_KEY", "Enter your TinyFish API key first.", 401);
  const parsed = await parseBody(req, enrichRequestSchema);
  if ("response" in parsed) return parsed.response;
  const { jobs } = parsed.data;
  try {
    const { results, errors } = await tinyfishFetch(
      key,
      [...new Set(jobs.map((j) => j.apply_url))],
      "Read a job posting page to confirm its title and extract the description and posting date if shown",
    );
    const body: EnrichResponse = { items: buildEnrichItems(jobs, results, errors) };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fromError(e);
  }
}
