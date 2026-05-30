# Package CRUD — Plan Brief

> Full plan: `context/changes/package-management/plan.md`
> Research: `context/changes/package-management/research.md`

## What & Why

Trainers need to define reusable training packages (name, visit count, price) that can be assigned to clients — FR-003 and FR-004 in the PRD. This is the first feature slice (S-02) after auth, and it also installs the shadcn/ui + zod foundation and active nav highlighting that every subsequent slice inherits.

## Starting Point

The dashboard shell and nav bar already exist (`src/app/dashboard/layout.tsx`) with links to Pakiety, Klienci, Kalendarz, and Asystent — but the `/dashboard/packages` route returns 404 and the nav has no active-state highlighting. The codebase has no form library, no UI component library, and no `cn()` utility. Auth forms are hand-rolled.

## Desired End State

A trainer on a phone can create, edit, and delete training packages in under 60 seconds total. The package list shows per-session price automatically. Deleting a package used by clients warns with the client count before confirming. Quick-select chips and preset template cards in the empty state eliminate blank-form friction for first-time setup.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Form routing | Full pages (/packages/new, /packages/[id]/edit) | Matches the existing login/register pattern; works cleanly with useActionState + Server Actions; sets the convention for S-03/S-04 | Plan |
| Delete safety | Warn with client count, require confirmation | Schema silently nullifies clients.package_id on delete — trainer needs the only warning the system will ever show | Plan |
| Empty state | 3 hardcoded preset template cards | Research: doubles first-use adoption for admin tools; zero extra DB queries | Research |
| shadcn scope | Full adoption — refactor auth forms too | Avoids two visual patterns in a codebase where S-03/S-04 will also use forms | Plan |
| Validation UX | Inline field errors + Sonner toast on success | Matches login form's inline error pattern; precise per-field feedback for a 3-field form | Plan |
| Active nav | usePathname() NavLink Client Component | Nav exists but has no active state; sets the convention before more pages are added | Plan |
| Testing | Unit tests for zod schema validation | Covers the most likely regression (validation logic); no Supabase test project yet | Plan |
| Schema deploy gate | Phase 0 manual verification | Roadmap notes schema deployment not confirmed; a missing table wastes all subsequent debugging time | Plan |
| Session chips | Pre-fill visit_count only, not price | Trainer pricing varies significantly — a suggested price anchors them to a number that may be wrong | Plan |
| Atomic unit | Single session/visit | Universal across all competitor apps; maps to one appointments row | Research |
| Per-session rate | Computed display only, never stored | Avoids sync bugs; correct by definition at render time | Research |
| Libraries | zod + shadcn/ui (skip react-hook-form, TanStack Query) | react-hook-form conflicts with useActionState; TanStack Query is overkill for 3-field CRUD with Server Actions | Research |

## Scope

**In scope:**
- Package CRUD: create, edit, delete with validation and inline errors
- Package list with per-session rate and client-count-aware delete confirmation
- Empty state with 3 preset template cards + quick-select session chips on the form
- shadcn/ui + zod installation; auth form refactor to shadcn components
- Active nav highlighting via NavLink Client Component
- Schema deployment verification (Phase 0 manual gate)
- Unit tests for zod validation schema

**Out of scope:**
- Package expiry dates (future `client_packages` join table)
- Tier pricing (multiple price points per package)
- Pagination or search (≤ 20 packages expected)
- Supabase integration tests (no test project configured)
- Monthly summary or revenue stats (Secondary success criteria, deferred)

## Architecture / Approach

Server Components fetch data; Client Components own form state. Server Actions handle all mutations via `useActionState`. The create/update actions return `{ success: true }` instead of redirecting server-side — the Client Component form detects success in a `useEffect`, fires the Sonner toast, then navigates with `router.push()`. Delete uses a bound Server Action inside an AlertDialog confirm form. The package list fetches client counts with a single embedded Supabase query (`.select('*, clients(count)')`).

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 0. Schema Gate | Confirms Supabase tables + RLS deployed | All subsequent phases fail silently if schema is missing |
| 1. Foundation | shadcn + zod installed; auth forms refactored | shadcn init may conflict with existing Tailwind v4 token setup in globals.css |
| 2. Active Nav | NavLink component; current section highlighted | usePathname() requires Client Component — must not convert the Server Component layout |
| 3. Server Actions | createPackageAction, updatePackageAction, deletePackageAction with zod | zod v4 API differs from v3; coerce patterns must be used correctly |
| 4. Package List | Card list + delete AlertDialog + empty state presets | Supabase embedded count syntax `clients(count)` must be destructured correctly |
| 5. Create Form | Chips + PLN input + per-session rate + inline errors + toast | Toast-then-navigate requires returning `{ success: true }` — NOT calling redirect() in the action |
| 6. Edit Form | Pre-filled form + 404 for unknown IDs | updatePackageAction must be bound with `.bind(null, id)` before passing as form action |
| 7. Unit Tests | Seven zod schema test cases passing | packageSchema must be exported from actions/packages.ts for direct testing |

**Prerequisites:** S-01 done (auth in place); Supabase project accessible; `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
**Estimated effort:** ~2–3 focused sessions across 7 phases.

## Open Risks & Assumptions

- shadcn `init` modifies `globals.css` — the existing `@theme inline` Tailwind v4 token block must coexist with shadcn's CSS variable additions. Review the diff before committing.
- The `clients(count)` Supabase embed syntax is v2 JS client behaviour — verify against actual SDK version in `package.json` if the query returns unexpected shapes.
- PLN is hardcoded throughout. If the trainer's locale changes, price display will need a currency abstraction layer (deferred to V2).

## Success Criteria (Summary)

- Trainer can complete full package CRUD on a phone (create → edit → delete) in under 3 minutes from first load
- Empty state preset cards pre-fill the form in one tap; per-session rate updates in real time
- Deleting a package assigned to clients surfaces the count warning before any data is changed
