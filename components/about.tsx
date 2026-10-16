import { Bot, FileText, Search } from "lucide-react";

const ITEMS = [
  { icon: Search, name: "Search", body: "Queries the web for company careers pages and ATS job boards (Greenhouse, Lever, Ashby, Workable) matching your role and location. Output: a short list of live sources." },
  { icon: Bot, name: "Agent", body: "A real browser agent opens each source, uses its own search and filters, and extracts the openings it literally sees as structured data. Fields it cannot see stay empty." },
  { icon: FileText, name: "Fetch", body: "Reads the top-ranked job detail pages to confirm they load and mention the title, and fills in description or date only if the page provides them." },
];

export function About() {
  return (
    <section aria-labelledby="about-h" className="mt-16 border-t border-border pt-10">
      <h2 id="about-h" className="text-sm font-medium">How it works</h2>
      <div className="mt-5 grid gap-6 sm:grid-cols-3">
        {ITEMS.map(({ icon: I, name, body }) => (
          <div key={name}>
            <h3 className="flex items-center gap-2 text-sm"><I className="h-4 w-4 text-accent" aria-hidden /> TinyFish {name}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-sm leading-relaxed text-muted">
        Results are then deduplicated (canonical apply URL first, title + company + location as fallback) and ranked with
        a deterministic score for role, keywords, location and type. No LLM is used. Match reasons are our inference; titles,
        companies, locations and links come from the source. A job is never labelled “open” — always confirm on the employer’s site.
      </p>
    </section>
  );
}
