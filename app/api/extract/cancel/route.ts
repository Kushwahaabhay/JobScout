import { NextResponse } from "next/server";
import { cancelAgentRun } from "@/lib/tinyfish/agent";
import { parseBody, readApiKey, errorResponse } from "@/lib/server/route";
import { runRefSchema } from "@/lib/server/schemas";

export const maxDuration = 30;

export async function POST(req: Request) {
  const key = readApiKey(req);
  if (!key) return errorResponse("MISSING_API_KEY", "Enter your TinyFish API key first.", 401);
  const parsed = await parseBody(req, runRefSchema);
  if ("response" in parsed) return parsed.response;
  await cancelAgentRun(key, parsed.data.run_id);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
