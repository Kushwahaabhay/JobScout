# JobScout

Live job and internship discovery built on **TinyFish Search, Agent and Fetch** (TinyFish × TechnoJam bounty).
Bring your own TinyFish API key; JobScout finds careers pages, reads them with a real browser agent, checks the job
pages and returns ranked, deduplicated openings with a link to apply at the original source.

Next.js (App Router) · TypeScript · Tailwind CSS v4 · shadcn-style UI primitives · Lucide · Zod · Vitest.

## Setup

```bash
npm install --legacy-peer-deps   # only needed if your npm complains about peer ranges
npm run dev                      # http://localhost:3000
npm test                         # unit tests
npm run typecheck && npm run build
```

No TinyFish key is ever configured server-side. In development a demo account works out of the box:
`demo@jobscout.dev` / `jobscout-demo` (disabled automatically in production).

## Landing page and sign-in

- `/` public landing page · `/login` sign-in · `/app` the workbench (requires a session).
- Auth is deliberately database-free: users are listed in the `JOBSCOUT_USERS` env var as `email|salt:hash`
  (scrypt). Create entries with `npm run auth:hash -- you@example.com 'password'`; separate several with `;`.
- A successful login sets an HttpOnly, SameSite=Lax, `Secure` (production) cookie holding an HMAC-signed token
  (12 h expiry) signed with `AUTH_SECRET` (32+ random chars). `proxy.ts` blocks `/app` and the `/api/connect|search|extract|enrich`
  routes without a valid session, and rejects cross-origin state-changing API calls.
- **Production fails closed**: without `AUTH_SECRET` and `JOBSCOUT_USERS` nobody can sign in.
- Login attempts are throttled per server instance (best effort); add a WAF/edge limit for stronger protection.
- There is no sign-up, password reset or user database by design. Optionally set `NEXT_PUBLIC_DEMO_HINT` to show
  demo credentials on the login page for judges (it is public text).
- Signing in is separate from the TinyFish key, which is still entered in the app and kept only in memory.

## API key handling

- The user pastes their key into the UI (masked, show/hide, **Test**, **Clear**).
- It lives only in React state. Never `localStorage`, `sessionStorage`, cookies, URLs, a database or source control.
- The browser sends it as `X-API-Key` to **same-origin** route handlers (`/api/*`), which forward it to TinyFish as `X-API-Key`.
- Handlers never log it, never include it in errors and never return it. There is no `NEXT_PUBLIC_*` key.
- Reloading the tab or pressing **Clear** removes it (and cancels any running search).
- Deploy on HTTPS only (Vercel etc. do this by default) so the key is encrypted in transit.

## Architecture

```
Browser (key in memory)
  └─ lib/client/pipeline.ts   Search → Agent → Fetch → Deduplicate, with per-stage progress
       ├─ POST /api/connect   TinyFish Search (1 tiny query) → connection test
       ├─ POST /api/search    TinyFish Search  GET  https://api.search.tinyfish.ai
       ├─ POST /api/extract         TinyFish Agent  POST .../v1/automation/run-async   (starts one run, returns run_id)
       ├─ POST /api/extract/status  polls GET .../v1/runs/{id} until COMPLETED / FAILED
       ├─ POST /api/extract/cancel  cancels a run that hit the client deadline
       └─ POST /api/enrich    TinyFish Fetch   POST https://api.fetch.tinyfish.ai                  (≤10 URLs per call)
```

Each endpoint is a small module in `lib/tinyfish/` (`search.ts`, `agent.ts`, `fetch.ts`) on top of a shared
`http.ts` (timeouts, typed errors, friendly messages). Pure logic is in `lib/jobs/` (`normalize`, `match`, `dedupe`,
`enrich`, `csv`). Request validation is Zod (`lib/server/schemas.ts`). Typed contracts: `lib/types.ts`.

Implemented against the official docs (docs.tinyfish.ai): auth header `X-API-Key`; Search params `query`,
`include_domains`, `purpose`; Fetch body `urls` (max 10), `format`, `purpose`, per-URL `errors[]` returned with HTTP 200;
Agent body `url`, `goal`, `output_schema` (documented JSON-Schema subset, `nullable` instead of type arrays),
`agent_config.max_duration_seconds`, with `COMPLETED`/`FAILED` status and `error.code`.

Why the orchestration runs from the browser: an Agent run can take a minute or more. Instead of holding one HTTP request open
(which hits proxy/serverless timeouts), each source is started with the **async** endpoint and polled every 3 s with short requests.
Each source has a 150 s deadline (TinyFish is also told `max_duration_seconds: 120`); on timeout the run is cancelled and that
source is reported as failed while the others continue. The Agent goal asks it to read listing pages only, which keeps runs short.

### What each API contributes

| Stage | API | Contribution |
|---|---|---|
| 1 | Search | Discovers careers pages and ATS boards (Greenhouse, Lever, Ashby, Workable) for the role/location |
| 2 | Agent | Browses each live source and extracts the openings it literally sees (structured output) |
| 3 | Fetch | Reads the top-ranked detail pages: confirms they load and mention the title; fills gaps in description/date |
| 4 | Dedupe | Merge by canonical apply URL, fallback to normalized title+company+location; deterministic ranking |

### Data integrity rules

- Nothing is fabricated: no mock results in production; failed sources are listed with their error; malformed agent entries are skipped and counted.
- `posted_date` is set only from an absolute date shown by the source (relative strings like “3 days ago” are rejected).
- Employment type / seniority inferred from the title are tagged **(inferred)**. “Why it matched” is labelled as inference.
- Jobs are never labelled “open”. Fetch results show *“Detail page read · not proof it’s open”*, or *“Link not found — may be closed”* on 404/410.
- Breadth is capped: UI sends 5 sources / 10 detail fetches; server caps via `JOBSCOUT_MAX_SOURCES` (8) and `JOBSCOUT_MAX_DETAIL_FETCHES` (20).
- CSV export neutralizes spreadsheet formula injection from scraped text.

### Development fixtures

`NEXT_PUBLIC_ENABLE_FIXTURES=true` shows a “Load development fixtures” button, labelled `DEV FIXTURE` on each card.
It is hard-disabled when `NODE_ENV=production`.

## Deployment (Vercel)

1. Push the repo, import it in Vercel, keep defaults. **Do not add any TinyFish key as an env var.** Set `AUTH_SECRET` and `JOBSCOUT_USERS` (and optionally `NEXT_PUBLIC_DEMO_HINT`) in the project environment variables.
2. No long-running function is needed: the Agent routes only start/poll/cancel (each < 30 s). The Fetch route allows up to 150 s.
3. Optionally set `JOBSCOUT_MAX_SOURCES` / `JOBSCOUT_MAX_DETAIL_FETCHES`.

## Demo script (≈3 min)

1. Open the landing page, click **Start searching**, sign in. Point out the privacy note. Paste your key, press **Test** → “Connected”.
2. Keep the defaults (Software Engineer · Bengaluru · Internship · React, TypeScript, Python) → **Find Opportunities**.
3. Watch Search → Agent → Fetch → Deduplicate; expand **Sources checked** to show which sites were read and any failures.
4. Show a card: confirmed facts vs *(inferred)* tags and match reasons; the verification badge; **Apply at source**.
5. Filter by type, sort by relevance, save two jobs, view **Saved**, export **CSV**, press **Refresh**.
6. Press **Clear** to show the key and results disappear. Open **How it works** to explain each API.

## Tests

`npm test` covers session signing/tampering/expiry, password hashing, fail-closed secret, URL canonicalization, normalization (incl. no invented dates), matching, deduplication, CSV
escaping, agent-output parsing, Search source selection, Fetch → verification mapping, and the TinyFish clients with a
mocked transport (headers, error mapping, key never leaked into errors).

## Known limits

- Search quality depends on TinyFish Search results; some sites block automation (reported per source).
- Free-tier limits apply (Search 30 req/min; Fetch 150 URLs/min). Rate-limit and credit errors are surfaced, not hidden.
- Not verified here with a live key: end-to-end agent extraction quality. All endpoint shapes follow the docs and are covered by mocked tests.
