/** Shared request helper: timeouts + typed errors. Never logs or echoes the API key. */

export class TinyFishError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly retryAfter: number | null = null,
  ) {
    super(message);
    this.name = "TinyFishError";
  }
}

const FRIENDLY: Record<string, string> = {
  MISSING_API_KEY: "No API key was sent. Enter your TinyFish API key first.",
  INVALID_API_KEY: "TinyFish rejected this API key. Check it and try again.",
  UNAUTHORIZED: "TinyFish rejected this API key. Check it and try again.",
  INSUFFICIENT_CREDITS: "Your TinyFish account is out of credits.",
  FREE_ALLOWANCE_EXHAUSTED: "Your TinyFish free daily allowance is used up (resets 00:00 UTC).",
  RATE_LIMIT_EXCEEDED: "TinyFish rate limit reached. Wait a moment and retry.",
  DAILY_LIMIT_EXCEEDED: "TinyFish daily limit reached.",
  TIMEOUT: "The request timed out.",
  SITE_BLOCKED: "The site blocked the automated browser.",
  SERVICE_BUSY: "TinyFish is busy. Retry shortly.",
  BACKEND_UNAVAILABLE: "TinyFish is temporarily unavailable.",
};

export function friendlyMessage(code: string, fallback: string): string {
  return FRIENDLY[code] ?? fallback;
}

function statusToCode(status: number): string {
  if (status === 401) return "INVALID_API_KEY";
  if (status === 402) return "INSUFFICIENT_CREDITS";
  if (status === 429) return "RATE_LIMIT_EXCEEDED";
  if (status === 503) return "SERVICE_BUSY";
  if (status >= 500) return "BACKEND_UNAVAILABLE";
  if (status === 400) return "INVALID_INPUT";
  return "HTTP_ERROR";
}

export interface RequestOptions {
  url: string;
  method: "GET" | "POST";
  apiKey: string;
  body?: unknown;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

export async function tinyfishRequest<T>(opts: RequestOptions): Promise<T> {
  const f = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  let res: Response;
  try {
    res = await f(opts.url, {
      method: opts.method,
      headers: {
        "X-API-Key": opts.apiKey,
        Accept: "application/json",
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      throw new TinyFishError("The request to TinyFish timed out.", "TIMEOUT", 504);
    }
    throw new TinyFishError("Could not reach TinyFish.", "NETWORK_ERROR", 502);
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* handled below */
  }

  if (!res.ok) {
    const err = (json as { error?: { code?: string; message?: string } } | null)?.error;
    const code = err?.code ?? statusToCode(res.status);
    const retry = Number(res.headers.get("retry-after"));
    throw new TinyFishError(
      friendlyMessage(code, err?.message ?? `TinyFish returned HTTP ${res.status}.`),
      code,
      res.status,
      Number.isFinite(retry) && retry > 0 ? retry : null,
    );
  }
  if (json === null) {
    throw new TinyFishError("TinyFish returned an unreadable response.", "MALFORMED_RESPONSE", 502);
  }
  return json as T;
}
