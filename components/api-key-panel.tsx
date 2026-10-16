"use client";

import { useState } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { api } from "@/lib/client/api";

export type KeyStatus = "idle" | "testing" | "connected" | "error";

interface Props {
  apiKey: string;
  status: KeyStatus;
  error: string;
  onChange: (key: string) => void;
  onStatus: (s: KeyStatus, error?: string) => void;
}

/** The key is held only in the parent's React state: no storage, no URL, no logs. */
export function ApiKeyPanel({ apiKey, status, error, onChange, onStatus }: Props) {
  const [show, setShow] = useState(false);

  async function test() {
    if (!apiKey.trim()) return;
    onStatus("testing");
    try {
      await api.connect(apiKey.trim());
      onStatus("connected");
    } catch (e) {
      onStatus("error", e instanceof Error ? e.message : "Connection failed.");
    }
  }

  return (
    <section aria-labelledby="key-h" className="rounded-lg border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="key-h" className="flex items-center gap-2 text-sm font-medium">
          <KeyRound className="h-4 w-4 text-accent" aria-hidden /> TinyFish API key
        </h2>
        <div role="status" aria-live="polite" className="text-xs">
          {status === "connected" && (
            <span className="flex items-center gap-1 text-accent"><CheckCircle2 className="h-3.5 w-3.5" /> Connected</span>
          )}
          {status === "error" && (
            <span className="flex items-center gap-1 text-danger"><XCircle className="h-3.5 w-3.5" /> Not connected</span>
          )}
          {status === "testing" && (
            <span className="flex items-center gap-1 text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Testing…</span>
          )}
        </div>
      </div>

      <Label htmlFor="api-key">API key</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id="api-key"
            type={show ? "text" : "password"}
            value={apiKey}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Paste your key"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            className="pr-10 font-mono"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide API key" : "Show API key"}
            className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded text-muted hover:text-foreground"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <Button onClick={test} disabled={!apiKey.trim() || status === "testing"}>Test</Button>
        <Button variant="ghost" onClick={() => { onChange(""); setShow(false); }} disabled={!apiKey} aria-label="Clear API key">
          <Trash2 className="h-4 w-4" /> Clear
        </Button>
      </div>

      {status === "error" && <p className="mt-2 text-sm text-danger">{error}</p>}

      <p className="mt-3 flex gap-2 text-xs leading-relaxed text-muted">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          Used for this browser session only. It stays in page memory (never localStorage, cookies or a database), is
          sent over HTTPS to this app’s own server, and is forwarded to TinyFish as <code className="font-mono">X-API-Key</code>.
          It is never logged or returned. Reloading the tab clears it. Get a key at{" "}
          <a className="underline hover:text-foreground" href="https://agent.tinyfish.ai/api-keys" target="_blank" rel="noreferrer">
            agent.tinyfish.ai
          </a>.
        </span>
      </p>
    </section>
  );
}
