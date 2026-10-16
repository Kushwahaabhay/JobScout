import { z } from "zod";
import { TinyFishError, tinyfishRequest } from "./http";

export const FETCH_URL = "https://api.fetch.tinyfish.ai";
export const MAX_URLS_PER_CALL = 10;

const FetchResult = z.object({
  url: z.string(),
  final_url: z.string().nullish(),
  title: z.string().nullish(),
  description: z.string().nullish(),
  published_date: z.string().nullish(),
  text: z.unknown().optional(),
});
const FetchErr = z.object({ url: z.string(), error: z.string(), status: z.number().optional() });
const FetchResponse = z.object({ results: z.array(FetchResult), errors: z.array(FetchErr).default([]) });

export type FetchedPage = z.infer<typeof FetchResult>;
export type FetchedError = z.infer<typeof FetchErr>;

export async function tinyfishFetch(
  apiKey: string,
  urls: string[],
  purpose: string,
  fetchImpl?: typeof fetch,
): Promise<{ results: FetchedPage[]; errors: FetchedError[] }> {
  if (urls.length === 0) return { results: [], errors: [] };
  if (urls.length > MAX_URLS_PER_CALL) {
    throw new TinyFishError(`At most ${MAX_URLS_PER_CALL} URLs per fetch call.`, "INVALID_INPUT", 400);
  }
  const raw = await tinyfishRequest<unknown>({
    url: FETCH_URL,
    method: "POST",
    apiKey,
    timeoutMs: 150_000, // docs recommend a client timeout of at least 150s
    fetchImpl,
    body: { urls, format: "markdown", purpose: purpose.slice(0, 2000), per_url_timeout_ms: 60_000 },
  });
  const parsed = FetchResponse.safeParse(raw);
  if (!parsed.success) {
    throw new TinyFishError("TinyFish Fetch returned an unexpected shape.", "MALFORMED_RESPONSE", 502);
  }
  return parsed.data;
}
