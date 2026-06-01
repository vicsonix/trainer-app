# Client Management — Plan Brief

> Full plan: `context/changes/client-management/plan.md`
> Research: `context/changes/client-management/research.md`

## What & Why

A solo personal trainer needs one place to manage their client roster — contact info, an assigned training package, freetext interview notes (the raw input for the future AI assistant), and a link to the external training plan. S-03 delivers full client CRUD with package assignment, preceded by a routing cleanup that moves all feature URLs from the semantically wrong `/dashboard/packages` nesting to clean sibling paths.

## Starting Point

S-02 (package management) is complete and provides the canonical pattern for all implementation decisions: Server Component data fetching, `useActionState` forms, ShadCN modals, server actions with Zod validation. The `clients` table is fully defined in `supabase/schema.sql`. The nav shell already includes the jungle-teal "Klienci" entry at `/dashboard/clients` — it just needs the URL fixed and the pages built.

## Desired End State

Trainer navigates to `/clients`, sees their client list as cards (name, contact info, package badge), and can add, edit, and delete clients via modals. The create/edit form has 7 fields including a package assignment dropdown with an inline "+ Dodaj pakiet" action item so the trainer never has to leave the form to create a missing package.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| URL structure | Route group `(app)/` — `/packages`, `/clients` as siblings | `/dashboard/packages` is semantically wrong; packages are not sub-pages of dashboard | Research + user decision |
| Package dropdown | ShadCN Select with inline "+ Dodaj pakiet" action item | Trainer should be able to create a missing package without leaving the client form | User decision |
| interview_notes | Unconstrained textarea, no maxLength | PRD Business Logic: AI assistant quality depends on unfiltered notes | Research (roadmap risk note) |
| plan_url validation | Validate as URL only when non-empty | Catches obvious mistakes without penalising the optional blank field | User decision |
| Testing scope | Schema tests + action integration tests (Supabase mock) | Validates ownership checks and DB call shapes that S-02 left untested | User decision |
| Phase structure | 4 phases: refactor → data layer → display UI → interactive UI | Keeps the prerequisite refactor isolated; data layer is testable without UI | Plan |

## Scope

**In scope:**
- Route group refactor: `src/app/dashboard/` → `src/app/(app)/`, all hrefs and `revalidatePath` calls updated
- Client CRUD: list, create, edit, delete
- Package assignment dropdown with inline package creation
- Zod schema + server actions + integration tests

**Out of scope:**
- Remaining-visits counter on client card (S-05)
- Delete cascade warning with appointment count (S-04 will add this)
- Client search / filter
- Auto-selecting newly created package after inline add

## Architecture / Approach

Follows S-02 exactly. Server Component (`page.tsx`) runs two parallel Supabase queries — clients with joined package data, and the packages list for the dropdown — then passes both to `ClientsClientSection` (Client Component). Mutations flow through server actions (`clients.ts`) with Zod validation, Supabase ownership checks, and `revalidatePath('/clients')`. The only new pattern vs S-02 is the inline package add: `ClientForm` renders `PackageFormModal` (imported from the packages feature) triggered by an `onMouseDown` action item inside the ShadCN Select; `router.refresh()` after creation updates the packages prop without resetting the form's local state.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Route Group Refactor | `/packages` and `/dashboard` work at clean sibling URLs; all S-02 redirects and `revalidatePath` calls updated | Moving files could break imports if any use relative paths |
| 2. Data Layer | `clientSchema.ts` + `clients.ts` (3 server actions) + integration tests green | Supabase mock must correctly simulate chained builder API (`.eq().eq()`) |
| 3. Stateless Display | `/clients` renders list of cards (read-only) or empty state | Schema must be deployed to Supabase instance before manual testing |
| 4. Interactive Layer | Full CRUD via modals; inline package add in dropdown; `interview_notes` textarea; `plan_url` validation | `onMouseDown + preventDefault` trick for Select action item; `router.refresh()` must preserve form state |

**Prerequisites:** S-02 done (packages table + UI exist); Supabase schema deployed; `.env.local` populated.  
**Estimated effort:** ~2–3 focused sessions across 4 phases.

## Open Risks & Assumptions

- The `(app)` route group pattern is invisible to `src/middleware.ts` — the middleware's public-routes list (`/login`, `/register`) and redirect target (`/dashboard`) require no changes. Confirmed by Next.js App Router spec.
- `router.refresh()` preserves client component state in Next.js App Router soft refresh. If this assumption breaks (e.g., due to a React key change on the server component), the form would reset after inline package creation.
- Supabase schema must be deployed to the live instance. If it isn't, Phase 3 manual testing will fail silently.

## Success Criteria (Summary)

- Trainer can complete the full S-03 flow on mobile: navigate to `/clients`, add a client with a package assignment (creating the package inline if needed), edit the client, delete the client.
- `interview_notes` accepts multi-paragraph freetext without truncation.
- All tests pass (`npm run test`); build and lint are clean after each phase.
