import { Bookmark, BookmarkCheck, Building2, ExternalLink, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { Job } from "@/lib/types";

const TYPE_LABEL: Record<Job["employment_type"], string> = {
  internship: "Internship", "full-time": "Full-time", "part-time": "Part-time", contract: "Contract", unknown: "Type not stated",
};

function VerificationBadge({ job }: { job: Job }) {
  switch (job.verification) {
    case "page_loaded":
      return <Badge tone="accent" title={job.verification_note}>Detail page read · not proof it’s open</Badge>;
    case "page_loaded_unmatched":
      return <Badge tone="warn" title={job.verification_note}>Title not found on detail page</Badge>;
    case "not_found":
      return <Badge tone="danger" title={job.verification_note}>Link not found — may be closed</Badge>;
    case "fetch_failed":
      return <Badge tone="warn" title={job.verification_note}>Detail page unreadable</Badge>;
    default:
      return <Badge>Not verified</Badge>;
  }
}

export function JobCard({ job, saved, onToggleSave }: { job: Job; saved: boolean; onToggleSave: (id: string) => void }) {
  const inferred = (f: "employment_type" | "seniority") => job.inferred_fields.includes(f);
  return (
    <article className="flex flex-col rounded-lg border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-medium leading-snug">{job.title}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden /> <span className="truncate">{job.company}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded border border-border px-1.5 py-0.5 font-mono text-xs" title="Relevance to your search (our estimate)">
            {job.match_score}
          </span>
          <Button
            variant="ghost" size="icon" onClick={() => onToggleSave(job.id)}
            aria-pressed={saved} aria-label={saved ? `Remove ${job.title} from saved` : `Save ${job.title}`}
          >
            {saved ? <BookmarkCheck className="h-4 w-4 text-accent" /> : <Bookmark className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
        <Badge className="gap-1"><MapPin className="h-3 w-3" aria-hidden />{job.location || "Location not stated"}</Badge>
        <Badge>{TYPE_LABEL[job.employment_type]}{inferred("employment_type") ? " (inferred)" : ""}</Badge>
        {job.seniority !== "unknown" && <Badge>{job.seniority}{inferred("seniority") ? " (inferred)" : ""}</Badge>}
        {job.posted_date && <Badge>Posted {job.posted_date}</Badge>}
        {job.fixture && <Badge tone="warn">DEV FIXTURE</Badge>}
      </div>

      {job.description && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-foreground/80">{job.description}</p>}

      {(job.match_reasons.length > 0 || job.matched_keywords.length > 0) && (
        <p className="mt-3 text-xs text-muted">
          <span className="uppercase tracking-wider">Why it matched (inferred): </span>
          {job.match_reasons.join(" · ")}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="min-w-0 space-y-1 text-xs text-muted">
          <p className="truncate">Source: <a className="underline hover:text-foreground" href={job.source_url} target="_blank" rel="noreferrer">{job.source_name}</a></p>
          <VerificationBadge job={job} />
        </div>
        <a
          href={job.apply_url} target="_blank" rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg hover:bg-[#d4f78a]"
        >
          Apply at source <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          <span className="sr-only"> (opens {job.title} at {job.company} in a new tab)</span>
        </a>
      </div>
    </article>
  );
}
