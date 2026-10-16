/** Server-side caps for search breadth. Override with env vars; the client can only go lower. */
function intEnv(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const LIMITS = {
  maxSourcesCap: intEnv("JOBSCOUT_MAX_SOURCES", 8),
  maxDetailFetchesCap: intEnv("JOBSCOUT_MAX_DETAIL_FETCHES", 20),
  defaultSources: 5,
  defaultDetailFetches: 10,
};
