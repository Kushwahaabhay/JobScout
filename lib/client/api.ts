import type {
  ConnectResponse,
  EnrichRequest,
  EnrichResponse,
  ErrorBody,
  ExtractRequest,
  ExtractStartResponse,
  ExtractStatusResponse,
  SearchRequest,
  SearchResponse,
} from "../types";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly retryAfter: number | null,
  ) {
    super(message);
  }
}

/** The key lives in React memory and is passed in per call; this module never stores it. */
async function post<T>(path: string, apiKey: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify(body),
      signal,
      cache: "no-store",
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError("Network error: could not reach the JobScout server.", "NETWORK_ERROR", 0, null);
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON (e.g. platform timeout page) */
  }
  if (res.status === 401 && (json as ErrorBody | null)?.error?.code === "UNAUTHENTICATED") {
    window.location.assign("/login");
    throw new ApiError("Your session expired. Please sign in again.", "UNAUTHENTICATED", 401, null);
  }
  if (!res.ok) {
    const err = (json as ErrorBody | null)?.error;
    const fallback =
      res.status === 504 || res.status === 502
        ? "The request timed out or the gateway failed."
        : `Request failed (HTTP ${res.status}).`;
    throw new ApiError(err?.message ?? fallback, err?.code ?? "HTTP_ERROR", res.status, err?.retry_after ?? null);
  }
  if (json === null) throw new ApiError("The server returned an unreadable response.", "MALFORMED_RESPONSE", res.status, null);
  return json as T;
}

export const api = {
  connect: (key: string, signal?: AbortSignal) => post<ConnectResponse>("/api/connect", key, {}, signal),
  search: (key: string, body: SearchRequest, signal?: AbortSignal) => post<SearchResponse>("/api/search", key, body, signal),
  extractStart: (key: string, body: ExtractRequest, signal?: AbortSignal) =>
    post<ExtractStartResponse>("/api/extract", key, body, signal),
  extractStatus: (key: string, run_id: string, signal?: AbortSignal) =>
    post<ExtractStatusResponse>("/api/extract/status", key, { run_id }, signal),
  extractCancel: (key: string, run_id: string) =>
    post<{ ok: true }>("/api/extract/cancel", key, { run_id }).catch(() => undefined),
  enrich: (key: string, body: EnrichRequest, signal?: AbortSignal) => post<EnrichResponse>("/api/enrich", key, body, signal),
};
