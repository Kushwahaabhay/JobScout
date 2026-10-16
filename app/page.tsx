import Link from "next/link";
import { ArrowRight, Bot, FileText, GitMerge, KeyRound, Search, ShieldCheck, Link2 } from "lucide-react";

const STEPS = [
  { icon: Search, api: "Search", title: "Discover", body: "Finds company careers pages and ATS boards for your role and location." },
  { icon: Bot, api: "Agent", title: "Read live", body: "A browser agent opens each source and extracts the openings it actually sees." },
  { icon: FileText, api: "Fetch", title: "Verify", body: "Reads the job pages to confirm the title and pull the description and date, only if shown." },
  { icon: GitMerge, api: "Dedupe", title: "Rank", body: "Merges duplicates by canonical apply URL and ranks by role, skills and location." },
];

const PRINCIPLES = [
  { icon: Link2, title: "Original apply links", body: "Every card links to the employer’s own posting. No reposted listings." },
  { icon: ShieldCheck, title: "Facts vs. inference", body: "Source facts are shown as-is; anything we derive is labelled “inferred”. Nothing is ever called “open”." },
  { icon: KeyRound, title: "Your key, your session", body: "Your TinyFish key lives in page memory only: never stored, never logged." },
];

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <span className="font-mono text-xs uppercase tracking-widest text-accent">JobScout</span>
        <nav className="flex items-center gap-5 text-sm text-muted" aria-label="Primary">
          <a href="#how" className="hover:text-foreground">How it works</a>
          <Link href="/login" className="rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-surface">Sign in</Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6">
        <section className="py-16 sm:py-28">
          <p className="text-xs uppercase tracking-widest text-muted">Powered by TinyFish Search · Agent · Fetch</p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
            Find openings <span className="text-accent">straight from the source.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted">
            Tell JobScout the role, place and skills. It finds careers pages, browses them like a person would, checks the
            job pages and hands you ranked openings with a link to apply at the original source.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/login" className="inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 text-sm font-medium text-accent-fg hover:bg-[#d4f78a]">
              Start searching <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <a href="#how" className="inline-flex h-11 items-center rounded-md border border-border px-5 text-sm hover:bg-surface">See how it works</a>
          </div>
        </section>

        <section id="how" aria-labelledby="how-h" className="scroll-mt-8 border-t border-border py-14">
          <h2 id="how-h" className="text-sm font-medium">Four steps, each doing real work</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: I, api, title, body }, i) => (
              <li key={api} className="rounded-lg border border-border bg-surface p-5">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span className="font-mono">0{i + 1}</span>
                  <I className="h-4 w-4 text-accent" aria-hidden />
                </div>
                <h3 className="mt-4 text-base font-medium">{title}</h3>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-accent">{api}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="trust-h" className="border-t border-border py-14">
          <h2 id="trust-h" className="text-sm font-medium">Honest by design</h2>
          <div className="mt-6 grid gap-8 sm:grid-cols-3">
            {PRINCIPLES.map(({ icon: I, title, body }) => (
              <div key={title}>
                <I className="h-4 w-4 text-accent" aria-hidden />
                <h3 className="mt-3 text-sm font-medium">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-16 rounded-lg border border-border bg-surface p-8 text-center">
          <h2 className="text-xl font-medium">Bring a TinyFish API key and try it.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">Sign in, paste your key for the session, and run your first search in under a minute.</p>
          <Link href="/login" className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-accent-fg hover:bg-[#d4f78a]">
            Sign in <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-muted sm:px-6">
          <span>Built for the TinyFish × TechnoJam bounty.</span>
          <span>No tracking. No stored keys. Results are not a guarantee a role is open.</span>
        </div>
      </footer>
    </div>
  );
}
