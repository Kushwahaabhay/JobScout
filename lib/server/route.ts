import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import type { ErrorBody } from "../types";
import { TinyFishError } from "../tinyfish/http";

/** Reads the user's key from the request header. It is never logged, stored or returned. */
export function readApiKey(req: Request): string | null {
  const k = req.headers.get("x-api-key")?.trim();
  return k && k.length >= 8 && k.length <= 512 ? k : null;
}

export function errorResponse(code: string, message: string, status: number, retryAfter?: number | null) {
  const body: ErrorBody = { error: { code, message, retry_after: retryAfter ?? null } };
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function fromError(e: unknown) {
  if (e instanceof TinyFishError) {
    // Upstream auth/billing/rate statuses pass through; everything else is a gateway error.
    const status = [401, 402, 429].includes(e.status) ? e.status : e.status === 504 ? 504 : 502;
    return errorResponse(e.code, e.message, status, e.retryAfter);
  }
  // Deliberately do not log the error object: it could contain request context.
  return errorResponse("INTERNAL_ERROR", "Unexpected server error.", 500);
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<{ data: T } | { response: Response }> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return { response: errorResponse("INVALID_INPUT", "Request body must be JSON.", 400) };
  }
  const r = schema.safeParse(json);
  if (!r.success) {
    const first = r.error.issues[0];
    return {
      response: errorResponse("INVALID_INPUT", `Invalid request: ${first?.path.join(".") || "body"} ${first?.message}`, 400),
    };
  }
  return { data: r.data };
}
