# Artifact 1 — Territory: Change History and Active Areas

_Source: git log analysis only. No code read._
_Generated: 2026-06-25_

---

## Noise Filter

The following are excluded from all counts below — high frequency, zero signal:

| Pattern | Why it's noise |
|---|---|
| `package-lock.json` | Regenerated on every `npm install`; touched 10+ times |
| `context/` | Plan/research docs, not runtime code |
| `public/` | Static assets |
| `.agents/` | Skill definition files, not app code |
| `patches/` | One-off OpenNext patch |
| `context/archive/`, `context/foundation/roadmap.md` | Bookkeeping on slice close |

Semi-noise (included but noted): `eslint.config.mjs` (5 touches) — usually incidental to feature commits, not a real hotspot.

---

## File Touch Frequency (noise excluded, src/ only)

Ranked by number of commits that touched the file:

| Touches | File | Category |
|---------|------|----------|
| 7 | `src/app/api/ai/chat/route.ts` | **AI API** — highest churn in codebase |
| 6 | `src/components/NavLink.tsx` | Navigation shell |
| 6 | `src/app/dashboard/layout.tsx` ¹ | App shell (pre-refactor path) |
| 6 | `src/app/dashboard/page.tsx` ¹ | Dashboard (pre-refactor path) |
| 5 | `src/app/globals.css` | Global styles |
| 5 | `src/app/actions/packages.ts` ² | Package server actions |
| 4 | `src/app/(app)/layout.tsx` | App shell (current path) |
| 4 | `src/app/(app)/calendar/TimeGrid.tsx` | Calendar rendering hub |
| 4 | `src/app/(app)/calendar/page.tsx` | Calendar page |
| 4 | `src/app/login/page.tsx` | Auth boundary |
| 4 | `src/app/layout.tsx` | Root layout |
| 4 | `src/app/dashboard/packages/DeletePackageDialog.tsx` ¹ | Package UI (pre-refactor) |
| 3 | `src/app/(app)/calendar/CalendarView.tsx` | Calendar |
| 3 | `src/app/(app)/calendar/MonthView.tsx` | Calendar |
| 3 | `src/app/(app)/clients/ClientCard.tsx` | Client UI |
| 3 | `src/app/(app)/clients/ClientsClientSection.tsx` | Client UI |
| 3 | `src/app/(app)/clients/ClientEmptyState.tsx` | Client UI |
| 3 | `src/app/actions/clients/index.ts` | Client server actions |
| 3 | `src/app/actions/auth.ts` | Auth server actions |
| 3 | `src/app/(app)/packages/PackagesClientSection.tsx` | Package UI |

¹ Old path (`src/app/dashboard/`) — renamed to `src/app/(app)/` in S-03 p1. Counts reflect pre-refactor history.  
² Renamed to `src/app/actions/packages/index.ts` in S-03. Pre-refactor counts combined.

---

## Co-Change Pairs (files that move together across commits)

These pairs changed in the same commit 2+ times. A pair that always moves together is either a logical unit or a hidden coupling risk.

| Count | File A | File B | Interpretation |
|-------|--------|--------|----------------|
| 5x | `src/app/dashboard/layout.tsx` | `src/app/dashboard/page.tsx` | Old app shell — moved together pre-refactor, now stable |
| 4x | `.env.example` | `package.json` | Expected: every new dependency also adds an env var |
| 3x | `src/app/(app)/calendar/page.tsx` | `src/app/(app)/calendar/TimeGrid.tsx` | TimeGrid is the calendar rendering hub — page always drives it |
| 3x | `src/app/(app)/calendar/CalendarView.tsx` | `src/app/(app)/calendar/TimeGrid.tsx` | Same: TimeGrid pulled in by CalendarView changes |
| 3x | `src/app/(app)/calendar/MonthView.tsx` | `src/app/(app)/calendar/TimeGrid.tsx` | TimeGrid is a **shared dependency** across all 3 calendar views |
| 3x | `src/app/(app)/calendar/MonthView.tsx` | `src/app/(app)/calendar/page.tsx` | Calendar page always touches MonthView |
| 3x | `src/app/(app)/clients/ClientCard.tsx` | `src/app/(app)/clients/ClientsClientSection.tsx` | Section always re-renders when card changes |
| 3x | `src/app/actions/packages.ts` | `DeletePackageDialog.tsx` | Action + consumer coupled across 3 fixes |
| 2x | `src/app/(app)/layout.tsx` | `src/components/NavLink.tsx` | Nav changes ripple into the shell |
| 2x | `src/lib/ai/tools/appointments.ts` | `src/lib/ai/tools/clients.ts` | Tool modules evolve together |
| 2x | `src/app/actions/packages.ts` | `src/app/actions/packageSchema.ts` | Schema and actions always touch together |

**Key signal:** `TimeGrid.tsx` is a hidden hub in the calendar — changing any calendar view (Month, Week, Day, CalendarView, page) has co-moved with it 3–4 times. It is the riskiest file to touch in the calendar module.

---

## Sensitive Cross-Boundary Commits

### Both runtime code AND build/infra changed in the same commit
These are the highest-risk commits — a package.json change combined with a route handler change means the feature and its dependency were shipped together with no isolation window.

| SHA | Date | Subject |
|-----|------|---------|
| dca9b78 | 2026-06-25 | feat(ai-assistant): vector search + Phase 5 tests — `.env.example` + `embeddings.ts` + route.ts |
| a437939 | 2026-06-04 | feat(ai-assistant): AI SDK v5 migration — `package.json` + `route.ts` + `context.ts` |
| 72d5a56 | 2026-06-04 | feat(calendar): Phase 6 tests + mobile nav fix — `package.json` + `vitest.config.ts` + `playwright.config.ts` + layout |
| 0a786c6 | 2026-06-04 | feat(calendar): full calendar — `package.json` + 3 migrations + all calendar components |
| 7969cf4 | 2026-06-01 | feat(client-management): data layer — `tsconfig.json` + `vitest.config.ts` + actions + schema |
| a8aac56 | 2026-05-29 | feat(ai-streaming-route): SSE route — `vitest.config.ts` + `tsconfig.json` + `route.ts` |

### Auth boundary touches
The auth layer (`middleware.ts`, `auth.ts`, login/register pages) was last touched in **2026-05-30** during the package-management palette refactor (login page restyled). Since then it has been untouched — it is stable but sensitive.

| SHA | Date | Subject |
|-----|------|---------|
| 4536ef6 | 2026-05-30 | feat: update layout style — **login page restyled** alongside package UI |
| f35d579 | 2026-05-30 | feat(package-management): install shadcn/ui — **auth forms refactored** |
| 48b34e1 | 2026-05-26 | fix(auth): review fixes — server validation, auth guard, perf, a11y |
| 9721ab0 | 2026-05-26 | feat: create register page |
| 6cc1a6f | 2026-05-26 | feat: add basic auth with dashboard page |

### DB schema / migration touches
Schema changes come in batches alongside large feature commits. The active branch (`feature/ai-assistant`) has an unapplied migration:

| SHA | Date | Migrations touched |
|-----|------|-------------------|
| dca9b78 | 2026-06-25 | `20260605000001_pgvector.sql` — **uncommitted, not on prod** |
| 0a786c6 | 2026-06-04 | 3 appointment column migrations (`ends_at`, `package_price`, `status`) |
| 3855f96 | 2026-05-30 | Initial schema migration setup |

---

## Timeline of Slices (commit-derived)

```
2026-05-19  scaffold
2026-05-21  infra (Cloudflare/wrangler)
2026-05-25  CI/CD fix
2026-05-26  S-01 auth  ←── auth boundary last real change
2026-05-29  F-01 streaming route
2026-05-30  S-02 packages  ←── login page last touched here (styling)
2026-06-01  S-03 clients
2026-06-04  S-04 calendar  ←── 3 DB migrations; TimeGrid emerges as hub
2026-06-04  S-05 client-card
2026-06-04  S-06 p1 (AI SDK v5)
2026-06-04  S-06 p2 (tools split)
2026-06-05  S-06 p3 (UI)
2026-06-25  S-06 p4+p5 (vector search)  ←── TODAY, uncommitted
```

---

## Sensitive Areas Before a Large Change

Ranked by signal from the analysis above:

| Area | Risk | Reason |
|------|------|--------|
| `src/app/api/ai/chat/route.ts` | **High** | Most-touched file (7x); crossed build+runtime boundary in 2 commits; active today |
| `src/app/(app)/calendar/TimeGrid.tsx` | **Medium-High** | Hidden hub — co-moved with 4 different calendar files across 3+ commits |
| `src/app/(app)/layout.tsx` | **Medium** | App shell; touched on nav changes and also in feature commits (co-moves with NavLink) |
| `src/app/actions/clients/index.ts` | **Medium** | 3 feature commits + now gains embedding side-effect; crossed domains in S-03 and S-06 |
| `src/middleware.ts` | **Low (but sensitive)** | Touched only at scaffold — untouched since. Any change here affects every request |
| `src/lib/supabase/{client,server}.ts` | **Low (but sensitive)** | Scaffold-only; no churn. Foundation everything else relies on |
| `supabase/migrations/20260605000001_pgvector.sql` | **Immediate** | Exists uncommitted on active branch; prod DB does not have it yet |
