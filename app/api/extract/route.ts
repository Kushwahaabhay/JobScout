import { NextResponse } from "next/server";
import { startAgentRun } from "@/lib/tinyfish/agent";
import { fromError, parseBody, readApiKey, errorResponse } from "@/lib/server/route";
import { extractRequestSchema } from "@/lib/server/schemas";
import type { ExtractStartResponse } from "@/lib/types";

export const maxDuration = 30;

/** Stage 2a — TinyFish Agent: start ONE async run on a live source. Returns immediately with a run id. */
export async function POST(req: Request) {
  const key = readApiKey(req);
  if (!key) return errorResponse("MISSING_API_KEY", "Enter your TinyFish API key first.", 401);
  const parsed = await parseBody(req, extractRequestSchema);
  if ("response" in parsed) return parsed.response;
  try {
    const run_id = await startAgentRun(key, parsed.data.source.url, parsed.data.criteria);
    const body: ExtractStartResponse = { run_id };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fromError(e);
  }
}
