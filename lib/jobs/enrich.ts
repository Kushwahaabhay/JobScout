import type { EnrichItem } from "../types";
import type { FetchedError, FetchedPage } from "../tinyfish/fetch";
import { cleanText, parseDate } from "./normalize";
import { tokens } from "./match";

function pageText(p: FetchedPage): string {
  return typeof p.text === "string" ? p.text : "";
}

/**
 * Pure: turns Fetch results into per-job verification + enrichment.
 * "page_loaded" only means the detail page was readable and mentions the title —
 * it is NOT a claim that the position is still open.
 */
export function buildEnrichItems(
  jobs: Array<{ id: string; title: string; apply_url: string }>,
  results: FetchedPage[],
  errors: FetchedError[],
): EnrichItem[] {
  const okByUrl = new Map<string, FetchedPage>();
  for (const r of results) okByUrl.set(r.url, r);
  const errByUrl = new Map<string, FetchedError>();
  for (const e of errors) errByUrl.set(e.url, e);

  return jobs.map((j) => {
    const page = okByUrl.get(j.apply_url);
    if (page) {
      const text = pageText(page);
      const hay = `${page.title ?? ""} ${text}`.toLowerCase();
      const tt = tokens(j.title);
      const titleFound = tt.length > 0 && tt.every((t) => hay.includes(t));
      const item: EnrichItem = {
        id: j.id,
        verification: titleFound ? "page_loaded" : "page_loaded_unmatched",
        verification_note: titleFound
          ? "Detail page was readable and mentions this title."
          : "Detail page was readable but did not mention this title; it may be a listing page or the role may be gone.",
      };
      const published = parseDate(page.published_date);
      if (published) item.posted_date = published;
      const desc = cleanText(page.description || text, 600);
      if (desc) item.description = desc;
      return item;
    }
    const err = errByUrl.get(j.apply_url);
    if (err) {
      return {
        id: j.id,
        verification: err.error === "page_not_found" ? "not_found" : "fetch_failed",
        verification_note:
          err.error === "page_not_found"
            ? "The posting URL returned not found; the role may have closed."
            : `Could not read the detail page (${err.error}).`,
      } satisfies EnrichItem;
    }
    return { id: j.id, verification: "fetch_failed", verification_note: "Fetch returned no result for this URL." };
  });
}
