"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, Lock, LogOut } from "lucide-react";
import { About } from "@/components/about";
import { ApiKeyPanel, type KeyStatus } from "@/components/api-key-panel";
import { ProgressSteps } from "@/components/progress-steps";
import { Results } from "@/components/results";
import { DEFAULT_FORM, SearchForm, type FormState } from "@/components/search-form";
import { Button } from "@/components/ui/button";
import { initialProgress, runPipeline, type PipelineProgress, type PipelineResult } from "@/lib/client/pipeline";
import { FIXTURES_ENABLED, fixtureJobs } from "@/lib/fixtures";
import { parseKeywords } from "@/lib/jobs/match";

// Practical breadth limits (the server enforces its own, lower-or-equal caps).
const LIMITS = { maxSources: 5, maxDetailFetches: 10 };

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [keyStatus, setKeyStatus] = useState<KeyStatus>("idle");
  const [keyError, setKeyError] = useState("");
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const abort = useRef<AbortController | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { email: string | null } | null) => setEmail(j?.email ?? null))
      .catch(() => {});
  }, []);

  async function signOut() {
    abort.current?.abort();
    setApiKey(""); // drop the TinyFish key from memory before leaving
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.assign("/login");
  }

  const search = useCallback(async () => {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setBusy(true);
    setResult(null);
    setProgress(initialProgress());
    try {
      const r = await runPipeline({
        apiKey: apiKey.trim(),
        criteria: {
          role: form.role.trim(),
          location: form.location.trim(),
          seniority: form.seniority,
          employment: form.employment,
          keywords: parseKeywords(form.keywords),
        },
        limits: LIMITS,
        signal: ctl.signal,
        onProgress: setProgress,
      });
      if (r.fatal && /rejected|API key|credits/i.test(r.fatal)) {
        setKeyStatus("error");
        setKeyError(r.fatal);
      }
      setResult(r);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setResult({ jobs: [], sources: [], searchedAt: new Date().toISOString(), warnings: [], duplicatesRemoved: 0, enriched: 0, fatal: "Unexpected error while searching." });
      }
    } finally {
      if (abort.current === ctl) setBusy(false);
    }
  }, [apiKey, form]);

  const toggleSave = (id: string) =>
    setSaved((s) => {
      const n = new Set(s);
      if (!n.delete(id)) n.add(id);
      return n;
    });

  function changeKey(k: string) {
    setApiKey(k);
    setKeyStatus("idle");
    setKeyError("");
    if (!k) {
      abort.current?.abort();
      setResult(null);
      setProgress(null);
      setSaved(new Set());
      setBusy(false);
    }
  }

  function loadFixtures() {
    const f = fixtureJobs();
    setResult({ jobs: f.jobs, sources: f.sources, searchedAt: new Date().toISOString(), warnings: ["Showing development fixtures, not real results."], duplicatesRemoved: 0, enriched: 0 });
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
      <header className="mb-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="font-mono text-xs uppercase tracking-widest text-accent">JobScout</Link>
          <div className="flex items-center gap-3 text-xs text-muted">
            {email && <span className="hidden sm:inline">{email}</span>}
            <Button variant="outline" size="sm" onClick={signOut}><LogOut className="h-3.5 w-3.5" /> Sign out</Button>
          </div>
        </div>
        <h1 className="mt-8 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Openings, read straight from the source.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          JobScout uses TinyFish to find careers pages, browse them like a person would, and check the job pages — no stale
          aggregator listings.
        </p>
      </header>

      <div className="space-y-5">
        <ApiKeyPanel apiKey={apiKey} status={keyStatus} error={keyError} onChange={changeKey}
          onStatus={(s, e) => { setKeyStatus(s); setKeyError(e ?? ""); }} />
        <SearchForm value={form} onChange={setForm} onSubmit={search} busy={busy}
          disabledReason={apiKey.trim() ? undefined : "Add your TinyFish API key to search."} />
        {FIXTURES_ENABLED && (
          <Button variant="ghost" size="sm" onClick={loadFixtures}>Load development fixtures (dev only)</Button>
        )}
      </div>

      <div className="mt-8 space-y-6" aria-live="polite">
        {progress && (busy || result) && <ProgressSteps progress={progress} />}
        {result?.fatal && (
          <div role="alert" className="flex gap-3 rounded-lg border border-danger/40 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
            <div>
              <p className="text-danger">Search could not complete</p>
              <p className="mt-1 text-muted">{result.fatal}</p>
            </div>
          </div>
        )}
        {result && !result.fatal && (
          <Results result={result} saved={saved} onToggleSave={toggleSave} onRefresh={search} busy={busy} />
        )}
      </div>

      <About />

      <footer className="mt-10 flex items-start gap-2 border-t border-border pt-6 text-xs leading-relaxed text-muted">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <p>
          Privacy: your API key and searches are not stored by JobScout. Saved jobs live in this tab only and disappear when
          you close it. Built for the TinyFish × TechnoJam bounty.
        </p>
      </footer>
    </main>
  );
}
