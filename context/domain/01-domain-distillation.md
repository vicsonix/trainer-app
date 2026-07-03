---
title: Domain Distillation — Trainer App
created: 2026-07-03
type: domain-distillation
---

# Domain Distillation — Trainer App

> Product of this artifact: a **map of the domain**, not code. Every claim is traced to
> a source (document or code) with `file:line`. Nothing here is invented — where a concept
> exists in the docs but has no home in the code, it is marked **NOT IN CODE**.

## Step 0 — Project context discovered

**Source documents found:**
- `app-problem.md` — original one-page MVP framing (Polish).
- `context/foundation/prd.md` — the authoritative requirements document (greenfield, v1). Frontmatter, Success Criteria, Functional Requirements FR-001…FR-017, Business Logic, Non-Goals.
- `context/foundation/tech-stack.md` — stack decision record.
- `README.md`, `CLAUDE.md`, `AGENTS.md` — build/architecture notes.

**Stack & layers** (`tech-stack.md:1-25`, `CLAUDE.md`):
- Next.js 16 App Router + TypeScript + Tailwind v4; Supabase (Postgres + email/password auth).
- **Persistence / domain schema:** `supabase/schema.sql` and `supabase/migrations/*`.
- **Domain logic lives in three thin, uncoordinated places** (this is the central finding):
  - Server Actions — `src/app/actions/{appointments,clients,packages}/index.ts` (writes + validation).
  - Server Components (page loaders) — `src/app/(app)/{calendar,clients,analytics}/page.tsx` (read models, and *inline* business calculations).
  - AI layer — `src/lib/ai/context.ts` (LLM grounding context) and `src/lib/ai/tools/*.ts` (read/write tools).
- There is **no `domain/` or service layer.** Business rules are duplicated inline at each read site. This is the structural cause of the divergences in Step 4.

**Constraint / limitation:** requirements are rich and current, so the map is document-anchored. The one gap: PRD gives *what* the counter means but never a canonical implementation, so each screen re-derived it — see Step 4.

---

## Step 1 — Ubiquitous Language

| Term | Definition | Source (doc) | Lives in code at | Notes |
|---|---|---|---|---|
| **Trainer** (`trainer`) | Solo personal trainer; the only user. Owns all data under one flat account. | `prd.md:26-30`, `prd.md:146` | `auth.users` via `trainer_id` FK on every table (`schema.sql:7,17,33`) | Not a domain table — it *is* the Supabase auth user. Tenancy root. |
| **Client** (`klient`) | A trainer's client: identity + contact + interview + plan link + assigned package. | `prd.md:97-104`, `app-problem.md:13-15` | `public.clients` (`schema.sql:15-26`); `clients/page.tsx` | Holds `package_id` (one, nullable). |
| **Package** (`pakiet`) | A bundle of N training visits sold at a price. | `prd.md:90-93` (FR-003/004) | `public.packages` (`schema.sql:5-12`) | **Overloaded** — see Step 3/5. `visit_count > 0`, `price >= 0`. |
| **Appointment / Visit** (`wizyta`) | A single session in the calendar: time, client, optional package, price, status. | `prd.md:107-113` (FR-010…013) | `public.appointments` (`schema.sql:31-45`) | Carries its **own** `package_id` (nullable), independent of the client's current `package_id`. |
| **Appointment status** | Lifecycle: `scheduled`, `completed`, `cancelled`, `no_show`. | Implied by PRD ("odbytych", "odwołane" `prd.md:113,138`) | `appointments.status` CHECK (`schema.sql:40-42`); transitions in `appointments/index.ts:182-213` | `completed`/`no_show` blocked for future dates (`index.ts:191-201`). |
| **Remaining visits** (`pozostałe wizyty`) | visit_count minus visits already used. **The core counter.** | `prd.md:117,138` (FR-014) | Computed inline in ≥3 places — `calendar/page.tsx:73-76`, `ai/tools/read.ts:112-118`, `analytics/page.tsx:111-118` | **No single definition.** Three formulas — Step 4. |
| **"Ending soon"** (`kończący się`) | Package state when remaining ≤ 2. | `prd.md:138` | `AppointmentDetailModal.tsx:282` (`remainingSessions <= 2`), `analytics/page.tsx:117` | **NOT on the client card** — Step 4. |
| **Interview** (`wywiad`) | Free-text client motivations/goals/fears. | `prd.md:99-100` (FR-007), `app-problem.md:14` | `clients.interview_notes text` (`schema.sql:24`) | Free-text by design; AI reads it. |
| **Training plan** (`plan treningowy`) | External URL to a plan document. | `prd.md:101-102` (FR-008) | `clients.plan_url text` (`schema.sql:25`) | Link only, not managed content. |
| **AI Assistant** (`asystent`) | NL Q&A grounded **only** in trainer-entered data. | `prd.md:122-124,132` (FR-015…017) | `api/ai/chat/route.ts`; `ai/context.ts`; `ai/tools/*` | Grounding is an invariant — Step 3. |
| **Stats / revenue** (`statystyki`, `przychód`) | Aggregates: completed visits, cancellations, estimated revenue. | `prd.md:47,123` (FR-016) | `analytics/page.tsx:82-94`; `ai/tools/read.ts:46-81` (`get_stats`) | Revenue = Σ price of `completed`. |
| **Package price on a visit** | One-off price, or derived from package. | `schema.sql:29-30` comment | `appointments.price` (`schema.sql:39`) | Schema *comments* a derivation rule the code does **not** apply — Step 4. |
| **Conversation** | Persisted AI chat threads (+ embeddings for semantic recall). | — (not in PRD) | `migrations/20260625000001_conversations.sql`; `pgvector` migration; `lib/embeddings.ts` | Supporting infra for FR-015. **NOT IN PRD** as a first-class concept. |

---

## Step 2 — Subdomain classification (Core / Supporting / Generic)

Anchored to the product's reason to exist: *"jedno miejsce, które syntetyzuje kontekst o kliencie na żądanie"* (`prd.md:22`) and the two success criteria — the pre-session client card and the AI assistant (`prd.md:36-47`, `app-problem.md:30-31`).

| Area | Category | Justification (traced to product goals) |
|---|---|---|
| **Client Context Synthesis** (client card + AI assistant grounded in interview/plan/package/history) | **CORE** | This is the differentiator. `prd.md:22` says no existing product joins trainer data with an on-demand context assistant. Success = US-01 (`prd.md:57-66`) + US-02 (`prd.md:68-77`). |
| **Package consumption / remaining-visits counter** | **CORE** | FR-014 is called out as *"jeden z głównych bolów trenera, core feature"* (`prd.md:118`). It's the number the trainer opens the app to see. Yet it has no owning model (Step 3/5). |
| **Calendar & appointments** | **Supporting** | Necessary substrate for the counter and the card, but a guardrail explicitly demands correctness (`prd.md:53`). Valuable, not differentiating — many apps do calendars. |
| **Client / Package CRUD** | **Supporting** | Data-entry backbone (FR-003…009). Enables Core but isn't the edge. |
| **Trainer stats / analytics** | **Supporting** | Secondary success criterion (`prd.md:46-47`); reduces month-end billing time. Explicitly *secondary*. |
| **Authentication & tenant isolation** | **Generic** | FR-001/002 delegated to Supabase auth + RLS (`schema.sql:47-62`). PRD prefers not writing auth from scratch (`tech-stack.md:36`). Solved problem. |
| **AI transport / embeddings / streaming** | **Generic** (enabling Core) | Vercel AI SDK + pgvector are commodity plumbing; the *value* is the grounded synthesis (Core), not the transport. |

**Core distilled to one sentence:** the product's edge is *turning the trainer's own scattered data into a trustworthy, on-demand client context* — of which the **remaining-visits counter** and the **grounded assistant** are the two load-bearing pieces.

---

## Step 3 — Aggregate candidates & their invariants

| # | Candidate aggregate | Invariant that MUST always hold | Source | Enforcement status in code |
|---|---|---|---|---|
| **A** | **Package Enrollment** (a client's purchased package instance) — *currently missing; conflated into `Package` + `clients.package_id`* | `0 ≤ remaining ≤ visit_count`, i.e. **used visits (completed [+scheduled]) can never exceed the package's visit_count.** | FR-014 + Business Logic `prd.md:138` (*"liczba pozostałych = wizyty w pakiecie − wizyty odbyte"*) | **IGNORED.** No capacity check anywhere. `createAppointmentAction` (`appointments/index.ts:53-104`) validates only time-overlap, never package capacity. Analytics openly renders `remaining <= 0` / *"Brak sesji"* (`analytics/page.tsx:325,344`) → the invariant is known to break. |
| **B** | **Appointment** | An appointment occupies a valid time span (`ends_at > starts_at`) and does not overlap another active appointment for the same trainer. | `prd.md:53,113` | **ENFORCED.** DB CHECK `chk_ends_after_starts` (`schema.sql:44`); overlap guard in `index.ts:75-86,129-141`. Status→future-date rule `index.ts:191-201`. Good. |
| **C** | **Appointment ↔ Package consistency** | If an appointment consumes a package, its `package_id` must equal the client's enrolled package (or the rule for which package it draws from must be explicit). | Implied by FR-014 semantics | **IGNORED / undefined.** `appointments.package_id` is set from the form independently (`index.ts:91`) and can diverge from `clients.package_id`. Counters disagree on which id to trust (Step 4). |
| **D** | **Trainer (tenant boundary)** | A trainer's data is never visible to another trainer. | `prd.md:51,128` (guardrail + NFR) | **ENFORCED.** RLS `using (trainer_id = auth.uid())` on all three tables (`schema.sql:52-62`) + `.eq('trainer_id', user.id)` in every query. Strong. |
| **E** | **Assistant grounding** | The assistant asserts only facts derivable from trainer-entered data; never fabricates. | `prd.md:76,132` (FR-015) | **DECLARED, partially enforced.** Context is built strictly from DB rows (`ai/context.ts`) and tools query only owned rows — so the *inputs* are grounded. But "no fabrication" is a model-behavior property with no test/guard here. |
| **F** | **Visit price** | A package-visit's price is derived (`package.price / visit_count`); a one-off's price is set explicitly. | `schema.sql:29-30` (comment) | **IGNORED.** `price` comes straight from the form (`appointments/index.ts:91`, `schema.ts:12-17`) and is nullable; no derivation. Revenue silently drops null-priced completed visits (`analytics/page.tsx:88-90`). |

**Headline:** the one Core invariant (A) has **no aggregate to live in** and is enforced nowhere; the well-enforced invariants (B, D) are Supporting/Generic.

---

## Step 4 — MODEL vs CODE divergences (the highest-value section)

| # | Document says (X) | Code does (Y) | Evidence | Severity |
|---|---|---|---|---|
| **D1** | Remaining = visit_count − **completed** visits (`prd.md:138`). | **Three different formulas, none matching the doc:** | | **Critical** — Core counter is inconsistent across the app. |
| | · Calendar / AI card | `visit_count − completed − **scheduled**`, filtered by matching `package_id`. | `calendar/page.tsx:73-76`; `ai/tools/read.ts:112-118` | Includes future scheduled visits → smaller number than PRD. |
| | · Analytics | `visit_count − (completed + scheduled)` counted **by `client_id`, NOT by `package_id`**. | `analytics/page.tsx:103-118` | A client's visits on a *different/old* package still decrement the current package. Different result again. |
| | · PRD | `visit_count − completed` only. | `prd.md:138` | Neither screen matches the spec. |
| **D2** | Remaining visits are shown **"na karcie klienta i na wizytach w kalendarzu"** (FR-014, `prd.md:117`). | The **client card shows only `visit_count`** (`"… · N wizyt"`), no remaining, no "ending soon". | `clients/ClientCard.tsx:76-85` (only `packages.visit_count`); page loader never computes remaining (`clients/page.tsx:26-57`). | **High** — a must-have output is missing on one of its two required surfaces. |
| **D3** | Assistant answers *"ile zostało wizyt do końca pakietu"* (`app-problem.md:18`, FR-015). | The LLM's **default grounding context omits remaining visits** — `context.ts` lists `visit_count` only (`context.ts:53-55`), never the counter. Remaining is available **only if** the model calls the `get_client` tool. | `ai/context.ts:53-70` vs `ai/tools/read.ts:109-123` | **High** — for the Core question, correctness depends on a tool call, and that tool uses formula #2 (D1), not the PRD's. |
| **D4** | "Gdy remaining ≤ 2, pakiet oznaczony jako 'kończący się'" (`prd.md:138`). | Threshold `≤ 2` is **hard-coded in three separate spots**, not shared: calendar modal, analytics. Absent on client card (see D2). | `AppointmentDetailModal.tsx:282`; `analytics/page.tsx:117` | **Medium** — duplicated magic number; drifts with D1. |
| **D5** | Package-visit price is **derived** from the package; one-offs set price explicitly (`schema.sql:29-30`). | Price is always taken raw from the form and is nullable; no derivation. Completed visits with `null` price are dropped from revenue. | `appointments/index.ts:91`; `schema.ts:12-17`; `analytics/page.tsx:88-90` | **Medium** — undercounts the secondary "przychód" metric (`prd.md:47`). |
| **D6** | A package is *"aktualny pakiet"* with a defined lifecycle; the counter tracks the current bundle (`prd.md:138`). | Deleting a package **nulls** `clients.package_id` and `appointments.package_id` (`ON DELETE SET NULL`), silently erasing consumption history; renewing/re-buying the same package has **no instance boundary**, so old completed visits keep counting against the "new" one. | `schema.sql:22,35`; no enrollment concept anywhere. | **High** — the Core counter has no concept of *which purchase* a visit belongs to. |
| **D7** | Overlap guard should protect calendar integrity (`prd.md:53`). | Enforced in app code only, **not at the DB.** Concurrent requests / direct writes can still double-book. | `appointments/index.ts:75-86` (no DB exclusion constraint in `schema.sql`) | **Low** — correct for single-user MVP; latent. |

---

## Step 5 — Refactor ranking

Ranked by **value** (how Core the invariant is) × **risk** (how weakly it's enforced today).

| Rank | Target | Value | Risk today | Why here |
|---|---|---|---|---|
| **#1** | **Introduce a `PackageEnrollment` aggregate** (a client's purchased package instance) that **owns the remaining-visits invariant** and exposes one canonical `remaining()` calculation. | Highest — it *is* the Core counter (FR-014, `prd.md:118`). | Highest — invariant A is enforced nowhere; three divergent formulas (D1); no purchase boundary (D6); goes negative in prod (`analytics:325`). | Collapses D1, D3, D4, D6 into one owned rule and gives every surface (card, calendar, AI) a single source of truth. |
| **#2** | **Surface remaining + "ending soon" on the client card**, reusing the #1 calculation. | High — closes a missing must-have output (D2, FR-014). | Medium — pure omission, no data risk. | Cheap once #1 exists; directly serves US-01 (the pre-session card). |
| **#3** | **Feed remaining visits into the assistant's default context** and align the `get_client` tool to the #1 formula. | High — the Core assistant question (D3, FR-015). | Medium — currently answerable only via a tool call, with the wrong formula. | Makes the assistant trustworthy on its headline use case. |
| **#4** | **Define appointment↔package consumption rule + price derivation** (invariants C, F; D5). | Medium — correctness of revenue (secondary metric). | Medium — silent under-count. | Naturally folds into #1's aggregate boundary. |
| **#5** | **Promote overlap + capacity guards to DB constraints** (D7, and a `remaining ≥ 0` check). | Medium | Low (single-user MVP) | Defense-in-depth; do after the model is right. |

**#1 is the refactor.** Everything else is either downstream of it or lower-stakes. The single most valuable move is to give the *remaining-visits* invariant a home — a `PackageEnrollment` aggregate — so the number the trainer opens the app to see stops being computed three incompatible ways and starts being computed once, correctly, and enforced.

---

## Appendix — files inspected

- Docs: `app-problem.md`, `context/foundation/prd.md`, `context/foundation/tech-stack.md`.
- Schema: `supabase/schema.sql`, `supabase/migrations/20240101000000_initial_schema.sql` (+ later migrations: ends_at/notes, package_price, status, pgvector, conversations).
- Actions: `src/app/actions/{appointments,packages}/index.ts`, `.../appointments/schema.ts`.
- Read models: `src/app/(app)/{calendar,clients,analytics}/page.tsx`, `clients/ClientCard.tsx`, `calendar/AppointmentDetailModal.tsx`.
- AI: `src/lib/ai/context.ts`, `src/lib/ai/tools/read.ts`, `src/lib/ai/tools/packages.ts`.
