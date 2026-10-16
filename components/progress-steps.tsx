import { Check, Circle, Loader2, Minus, X } from "lucide-react";
import type { PipelineProgress, Stage, StageState } from "@/lib/client/pipeline";
import { cn } from "@/lib/utils";

const STEPS: Array<{ id: Stage; label: string; hint: string }> = [
  { id: "search", label: "Search", hint: "Find careers pages" },
  { id: "agent", label: "Agent", hint: "Read live sources" },
  { id: "fetch", label: "Fetch", hint: "Check job pages" },
  { id: "dedupe", label: "Deduplicate", hint: "Merge & rank" },
];

function Icon({ s }: { s: StageState }) {
  if (s === "running") return <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden />;
  if (s === "done") return <Check className="h-4 w-4 text-accent" aria-hidden />;
  if (s === "error") return <X className="h-4 w-4 text-danger" aria-hidden />;
  if (s === "skipped") return <Minus className="h-4 w-4 text-muted" aria-hidden />;
  return <Circle className="h-4 w-4 text-muted/60" aria-hidden />;
}

const LABEL: Record<StageState, string> = {
  idle: "waiting", running: "in progress", done: "done", error: "failed", skipped: "skipped",
};

export function ProgressSteps({ progress }: { progress: PipelineProgress }) {
  return (
    <section aria-label="Search progress" className="rounded-lg border border-border bg-surface p-5">
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STEPS.map((s) => {
          const st = progress.stages[s.id];
          return (
            <li key={s.id} className={cn("rounded-md border p-3", st === "running" ? "border-accent/50" : "border-border")}>
              <div className="flex items-center gap-2 text-sm">
                <Icon s={st} /> {s.label}
                <span className="sr-only"> — {LABEL[st]}</span>
              </div>
              <p className="mt-1 text-xs text-muted">{s.hint}</p>
            </li>
          );
        })}
      </ol>
      <p role="status" aria-live="polite" className="mt-3 text-xs text-muted">{progress.detail}</p>
    </section>
  );
}
