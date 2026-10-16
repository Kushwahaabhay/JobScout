"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Download, RefreshCw, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { JobCard } from "@/components/job-card";
import { jobsToCsv } from "@/lib/jobs/csv";
import type { PipelineResult } from "@/lib/client/pipeline";
import type { EmploymentType } from "@/lib/types";

type Sort = "relevance" | "date";
type View = "all" | "saved";

export function Results({
  result, saved, onToggleSave, onRefresh, busy,
}: {
  result: PipelineResult;
  saved: Set<string>;
  onToggleSave: (id: string) => void;
  onRefresh: () => void;
  busy: boolean;
}) {
  const [sort, setSort] = useState<Sort>("relevance");
  const [type, setType] = useState<"all" | EmploymentType>("all");
  const [view, setView] = useState<View>("all");
  const [q, setQ] = useState("");

  const hasDates = result.jobs.some((j) => j.posted_date);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = result.jobs.filter(
      (j) =>
        (type === "all" || j.employment_type === type) &&
        (view === "all" || saved.has(j.id)) &&
        (!needle || `${j.title} ${j.company} ${j.location}`.toLowerCase().includes(needle)),
    );
    if (sort === "date") {
      // Jobs without a source-provided date sort last; no dates are invented.
      list = [...list].sort((a, b) => (b.posted_date ?? "").localeCompare(a.posted_date ?? "") || b.match_score - a.match_score);
    }
    return list;
  }, [result.jobs, type, view, q, sort, saved]);

  function exportCsv() {
    const blob = new Blob([jobsToCsv(shown)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `jobscout-${result.searchedAt.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const failed = result.sources.filter((s) => s.status === "failed");
  const okCount = result.sources.filter((s) => s.status === "ok" || s.status === "empty").length;

  return (
    <section aria-labelledby="res-h" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="res-h" className="text-lg font-medium">
            {result.jobs.length} {result.jobs.length === 1 ? "opportunity" : "opportunities"}
          </h2>
          <p className="mt-1 text-xs text-muted">
            {okCount}/{result.sources.length} sources read · {result.duplicatesRemoved} duplicates merged · {result.enriched} detail pages read ·{" "}
            <time dateTime={result.searchedAt}>{new Date(result.searchedAt).toLocaleString()}</time>
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onRefresh} disabled={busy}><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Refresh</Button>
          <Button onClick={exportCsv} disabled={shown.length === 0}><Download className="h-4 w-4" /> CSV</Button>
        </div>
      </div>

      {(failed.length > 0 || result.warnings.length > 0) && (
        <div role="alert" className="rounded-lg border border-warn/40 p-4 text-sm">
          <p className="flex items-center gap-2 text-warn"><AlertTriangle className="h-4 w-4" /> Partial results</p>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {failed.map((s) => <li key={s.id}><strong className="font-medium text-foreground">{s.name}</strong>: {s.error}</li>)}
            {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      <details className="rounded-lg border border-border text-sm">
        <summary className="cursor-pointer px-4 py-3 text-muted hover:text-foreground">Sources checked ({result.sources.length})</summary>
        <ul className="divide-y divide-border border-t border-border">
          {result.sources.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs">
              <a href={s.url} target="_blank" rel="noreferrer" className="truncate underline hover:text-foreground">{s.name}</a>
              <span className={s.status === "failed" ? "text-danger" : "text-muted"}>
                {s.status === "ok" ? `${s.jobs_found} found` : s.status === "empty" ? "no matching openings" : s.status}
              </span>
            </li>
          ))}
        </ul>
      </details>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filters">
        <Input aria-label="Filter results" placeholder="Filter by title, company, location" value={q} onChange={(e) => setQ(e.target.value)} className="sm:max-w-xs" />
        <Select aria-label="Employment type" value={type} onChange={(e) => setType(e.target.value as typeof type)} className="w-auto">
          <option value="all">All types</option>
          <option value="internship">Internship</option>
          <option value="full-time">Full-time</option>
          <option value="part-time">Part-time</option>
          <option value="contract">Contract</option>
          <option value="unknown">Type not stated</option>
        </Select>
        <Select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="w-auto">
          <option value="relevance">Sort: relevance</option>
          <option value="date" disabled={!hasDates}>Sort: date{hasDates ? "" : " (no dates available)"}</option>
        </Select>
        <Select aria-label="View" value={view} onChange={(e) => setView(e.target.value as View)} className="w-auto">
          <option value="all">All results</option>
          <option value="saved">Saved ({saved.size})</option>
        </Select>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <SearchX className="mx-auto h-6 w-6 text-muted" aria-hidden />
          <p className="mt-3 text-sm">{result.jobs.length === 0 ? "No matching openings were found." : "No results match these filters."}</p>
          {result.jobs.length === 0 && (
            <p className="mt-1 text-xs text-muted">Try a broader role, remove the location, or switch the type to “Internship or full-time”.</p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {shown.map((j) => <JobCard key={j.id} job={j} saved={saved.has(j.id)} onToggleSave={onToggleSave} />)}
        </div>
      )}
    </section>
  );
}
