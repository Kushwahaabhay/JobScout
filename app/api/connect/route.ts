import { NextResponse } from "next/server";
import { tinyfishSearch } from "@/lib/tinyfish/search";
import { errorResponse, fromError, readApiKey } from "@/lib/server/route";
import type { ConnectResponse } from "@/lib/types";


/** Connection test: one tiny TinyFish Search call proves the key is accepted. */
export async function POST(req: Request) {
  const key = readApiKey(req);
  if (!key) return errorResponse("MISSING_API_KEY", "Enter your TinyFish API key first.", 401);
  try {
    await tinyfishSearch(key, { query: "careers", purpose: "JobScout connection test" });
    const body: ConnectResponse = { ok: true };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fromError(e);
  }
}
