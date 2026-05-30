---
project: Trainer App
version: 1
status: draft
created: 2026-05-25
updated: 2026-05-30
prd_version: 1
main_goal: market-feedback
top_blocker: capacity
---

# Roadmap: Trainer App

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

A solo personal trainer loses client context between sessions — before each appointment they must search scattered notes to recall the intake interview, motivations, and previous workout. Trainer App solves this with a single place that synthesizes client context on demand: interview notes, package counter, appointment history, and plan link — one tap on the phone, accessible in 5 minutes before a session. The core differentiator — the feature that, if removed, makes the product indistinguishable from a notes app — is the AI assistant that answers natural-language questions about specific clients and general statistics, grounded only in the trainer's own data.

## North star

**S-05 + S-06: Tap an appointment → see the full client card, AND ask the AI assistant a natural-language question about that client** — the first time both US-01 and US-02 work together proves the complete product hypothesis — the assumption that on-demand context synthesis (one tap for manual context, natural language for AI synthesis) solves the between-session knowledge loss — before investing in secondary features.

> The north star is the smallest combination of slices whose successful delivery proves the core product hypothesis, placed as early as Prerequisites allow because everything else only matters if this works. The user confirmed US-01 and US-02 must be validated together: the client card on appointment tap (S-05) proves "one tap for full context"; the AI assistant (S-06) proves the synthesis differentiator that the PRD identifies as essential.

## At a glance

| ID   | Change ID                 | Outcome (trainer can …)                                                                  | Prerequisites           | PRD refs                               | Status   |
|------|---------------------------|------------------------------------------------------------------------------------------|-------------------------|----------------------------------------|----------|
| F-01 | ai-streaming-route        | (foundation) LLM provider wired; streaming API route in place                            | —                       | FR-015, FR-016, FR-017                 | done     |
| S-01 | auth-registration-login   | register an account and log in with email + password                                     | auth scaffold (present) | FR-001, FR-002                         | done     |
| S-02 | package-management        | add, edit, and delete training packages                                                  | S-01                    | FR-003, FR-004                         | done     |
| S-03 | client-management         | add a client with interview notes, assign a package, add a plan link, and edit all data  | S-02                    | FR-005, FR-006, FR-007, FR-008, FR-009 | proposed |
| S-04 | calendar-appointments     | add and manage appointments in the weekly calendar view                                  | S-03                    | FR-010, FR-011, FR-013                 | proposed |
| S-05 | client-card-session-view  | tap an appointment and see the full client card with remaining package visits             | S-04                    | FR-012, FR-014, US-01                  | proposed |
| S-06 | ai-assistant              | ask natural-language questions about a client or general stats                           | S-04, F-01              | FR-015, FR-016, FR-017, US-02          | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme              | Chain                                          | Note                                                                                        |
|--------|--------------------|------------------------------------------------|---------------------------------------------------------------------------------------------|
| A      | Data & UI backbone | `S-01` → `S-02` → `S-03` → `S-04` → `S-05`   | Critical path to north star pt. 1; linear dependency chain — no steps can be skipped.      |
| B      | AI assistant       | `F-01` → `S-06`                                | Joins Stream A at `S-04`; delivers north star pt. 2. Start F-01 in parallel with S-01.     |

## Baseline

What's already in place in the codebase as of 2026-05-25 (auto-researched + user-confirmed).
Foundations below assume these layers are present and do NOT re-scaffold them.

- **Frontend:** present — Next.js 16.2.6 + React 19 + Tailwind CSS v4; scaffold pages only (`login`, `home`); no feature pages yet (`dashboard`, clients, packages, calendar are absent)
- **Backend / API:** absent — no route handlers in `src/app/api/`; architecture is Next.js App Router + Supabase direct from Server Components
- **Data:** partial — `supabase/schema.sql` with `packages`, `clients`, `appointments` tables + RLS policies; Supabase browser and server clients wired (`src/lib/supabase/`); schema not confirmed deployed to Supabase instance
- **Auth:** present — Supabase auth; `src/middleware.ts:30` verifies session; redirects unauthenticated → `/login`; `src/app/login/page.tsx` exists
- **Deploy / infra:** partial — `wrangler.toml` (Cloudflare Workers + OpenNext) + `.github/workflows/deploy.yml` (GitHub Actions) wired; not yet tested end-to-end in production
- **Observability:** partial — `src/lib/logger.ts` (Axiom `@axiomhq/js`, dataset `trainer-app`); no error tracking; no metrics dashboard

## Foundations

### F-01: LLM provider wired + AI streaming API route

- **Outcome:** (foundation) A streaming Next.js API route exists that accepts a client-context payload and a natural-language question, calls the Anthropic Claude API (`claude-haiku-4-5`), and returns a streaming response; API key wired as a Cloudflare Workers secret.
- **Change ID:** ai-streaming-route
- **PRD refs:** FR-015, FR-016, FR-017
- **Unlocks:** S-06 (AI assistant slice); also proves streaming SSE works on the Cloudflare Workers + OpenNext stack before the full AI slice is planned
- **Prerequisites:** —
- **Parallel with:** S-01, S-02, S-03, S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** No API routes exist in the codebase; adding the Anthropic SDK (`@anthropic-ai/sdk`) may push the Cloudflare Workers free-tier gzipped bundle past 3 MiB — validate bundle size with `wrangler deploy --dry-run` before merging (per `context/foundation/infrastructure.md` risk register).
- **Status:** done

## Slices

### S-01: Auth registration + login

- **Outcome:** trainer can register a new account and log in with email + password; session persists across browser restarts.
- **Change ID:** auth-registration-login
- **PRD refs:** FR-001, FR-002
- **Prerequisites:** auth scaffold (present — `src/middleware.ts`, Supabase auth, `src/app/login/page.tsx`)
- **Parallel with:** F-01
- **Blockers:** —
- **Unknowns:**
  - Registration page/form — baseline confirms `login/page.tsx` exists but does not confirm a registration form is wired; verify before closing this slice — Owner: user. Block: no (does not prevent planning; check during `/10x-plan auth-registration-login`).
- **Risk:** Auth is the trust foundation of the entire product; a session or data-isolation bug here breaks every downstream slice and violates the NFR "trainer's client data is never accessible from another trainer's account."
- **Status:** done

### S-02: Package management

- **Outcome:** trainer can add a training package (name, number of visits, price), edit it, and delete it.
- **Change ID:** package-management
- **PRD refs:** FR-003, FR-004
- **Prerequisites:** S-01; `supabase/schema.sql` migrated to Supabase instance (packages table + RLS in place)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** This slice also produces the dashboard shell and navigation structure that all subsequent slices inherit. A wrong navigation decision here ripples into every later slice.
- **Status:** done

### S-03: Client management

- **Outcome:** trainer can add a client (name, contact info), assign a package, record freetext interview notes and training goals, add a training plan link, and edit all of the above.
- **Change ID:** client-management
- **PRD refs:** FR-005, FR-006, FR-007, FR-008, FR-009
- **Prerequisites:** S-02 (package list needed for the assignment dropdown)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Interview notes freetext is the raw input consumed by the AI assistant (S-06). If the field is constrained (e.g., character limit, sanitisation that strips content), AI context quality degrades; keep it unconstrained in v1 per PRD Business Logic.
- **Status:** proposed

### S-04: Calendar and appointments

- **Outcome:** trainer can add an appointment (date, time, assigned client) to the weekly calendar, view the current week, and edit or delete any appointment.
- **Change ID:** calendar-appointments
- **PRD refs:** FR-010, FR-011, FR-013
- **Prerequisites:** S-03 (client list needed to assign appointments)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** PRD Guardrail: "calendar must always display the correct week — date errors destroy trust in the product." Date and timezone handling on the Cloudflare Workers edge runtime must be explicitly tested; do not defer to final QA.
- **Status:** proposed

### S-05: Client card on appointment tap + package counter

- **Outcome:** trainer taps an appointment in the weekly calendar and immediately sees the full client card: assigned package with remaining visits (flagged "ending soon" when ≤ 2 remain), interview notes, training goals, and plan link.
- **Change ID:** client-card-session-view
- **PRD refs:** FR-012, FR-014, US-01
- **Prerequisites:** S-04 (appointments with assigned clients + packages exist in the database)
- **Parallel with:** S-06
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Acceptance criterion: client card must load within 2 seconds on a mobile network (NFR). The Supabase query fetching client + package + visit count should fit in one round-trip; verify under realistic network conditions before closing this slice.
- **Status:** proposed

### S-06: AI assistant

- **Outcome:** trainer can ask a natural-language question about a specific client (interview, plan, visit count, package status) or general stats (visits this month, estimated revenue) and receive an answer grounded only in their own data; the assistant is accessible via a dedicated page and a floating button visible throughout the app; a progress indicator appears for responses taking longer than 2 seconds.
- **Change ID:** ai-assistant
- **PRD refs:** FR-015, FR-016, FR-017, US-02
- **Prerequisites:** S-04 (appointment data needed for FR-016 stats queries); F-01 (LLM provider selected, streaming API route in place)
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** PRD Business Logic rule: "assistant must not present fabricated details as fact." Grounding the response on the full client data record (not a summary) and prompting the LLM to cite only provided data are the primary implementation risks. Validate this behaviour manually against real queries before closing the slice.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                | Suggested issue title                                         | Ready for `/10x-plan` | Notes                                                        |
|------------|--------------------------|---------------------------------------------------------------|-----------------------|--------------------------------------------------------------|
| F-01       | ai-streaming-route       | Wire Anthropic Claude API and create AI streaming route       | yes                   | Run `/10x-plan ai-streaming-route` |
| S-01       | auth-registration-login  | Complete auth registration + login flow                       | yes                   | Run `/10x-plan auth-registration-login`                      |
| S-02       | package-management       | Package CRUD (add / edit / delete)                           | no                    | Needs S-01 done                                              |
| S-03       | client-management        | Client management with interview notes and package assignment | no                    | Needs S-02 done                                              |
| S-04       | calendar-appointments    | Weekly calendar with appointment CRUD                         | no                    | Needs S-03 done                                              |
| S-05       | client-card-session-view | Client card on appointment tap + package counter              | no                    | Needs S-04 done                                              |
| S-06       | ai-assistant             | AI assistant — client queries and stats                       | no                    | Needs S-04 + F-01 done                                       |

## Open Roadmap Questions

1. ~~**Which LLM provider — Claude API or OpenAI?**~~ **Resolved 2026-05-29: Anthropic Claude API (`claude-haiku-4-5`).** F-01 and S-06 unblocked.
2. **Are `target_scale.qps` and `target_scale.data_volume` correct as `low` / `small`?** — Owner: user. Block: no (PRD estimates based on 5–20 clients/week and text + calendar data; override if actual deployment profile differs).

## Parked

- **AI-proposed calendar slots** — Why parked: PRD §Non-Goals — AI answers questions, does not actively manage the calendar.
- **Client access to the app** — Why parked: PRD §Non-Goals — trainer-only access model in v1.
- **Automated notifications to clients** — Why parked: PRD §Non-Goals — trainer manages client communication manually in v1.
- **Multi-trainer / studio support** — Why parked: PRD §Non-Goals — solo-trainer model only in v1.
- **Native mobile app** — Why parked: PRD §Non-Goals — web app only; App Store / Google Play out of scope.
- **Google OAuth** — Why parked: PRD §Access Control — planned for v2 to reduce login friction on mobile.
- **Monthly summary view** — Why parked: PRD §Success Criteria Secondary — not on the must-have path; defer until north star (S-05 + S-06) is shipped and validated.

## Done

- **S-01: trainer can register a new account and log in with email + password; session persists across browser restarts.** — Archived 2026-05-28 → `context/archive/2026-05-26-auth-registration-login/`. Lesson: —.
- **F-01: (foundation) LLM provider wired; streaming API route in place** — Archived 2026-05-30 → `context/archive/2026-05-28-ai-streaming-route/`. Lesson: —.
- **S-02: trainer can add a training package (name, number of visits, price), edit it, and delete it.** — Archived 2026-05-30 → `context/archive/2026-05-30-package-management/`. Lesson: —.
