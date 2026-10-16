import { NextResponse } from "next/server";
import { tinyfishAgentExtract } from "@/lib/tinyfish/agent";
import { fromError, parseBody, readApiKey, errorResponse } from "@/lib/server/route";
import { extractRequestSchema } from "@/lib/server/schemas";
import type { ExtractResponse } from "@/lib/types";

export const maxDuration = 300;

/** Stage 2 — TinyFish Agent: navigate ONE live source and extract its openings. */
export async function POST(req: Request) {
  const key = readApiKey(req);
  if (!key) return errorResponse("MISSING_API_KEY", "Enter your TinyFish API key first.", 401);
  const parsed = await parseBody(req, extractRequestSchema);
  if ("response" in parsed) return parsed.response;
  try {
    const r = await tinyfishAgentExtract(key, parsed.data.source.url, parsed.data.criteria);
    const body: ExtractResponse = r;
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fromError(e);
  }
}
