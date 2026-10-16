import { NextResponse } from "next/server";
import { getAgentRun } from "@/lib/tinyfish/agent";
import { fromError, parseBody, readApiKey, errorResponse } from "@/lib/server/route";
import { runRefSchema } from "@/lib/server/schemas";
import type { ExtractStatusResponse } from "@/lib/types";

export const maxDuration = 30;

/** Stage 2b — poll an Agent run. A failed run is returned as data (state: "failed"), not an HTTP error. */
export async function POST(req: Request) {
  const key = readApiKey(req);
  if (!key) return errorResponse("MISSING_API_KEY", "Enter your TinyFish API key first.", 401);
  const parsed = await parseBody(req, runRefSchema);
  if ("response" in parsed) return parsed.response;
  try {
    const s = await getAgentRun(key, parsed.data.run_id);
    const body: ExtractStatusResponse =
      s.state === "failed" ? { state: "failed", code: s.code, message: s.message, retry_after: s.retryAfter } : s;
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fromError(e);
  }
}
