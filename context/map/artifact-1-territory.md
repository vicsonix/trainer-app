# Artifact 1 — Territory: Change History and Active Areas

_Source: git log analysis only. No code read._
_Generated: 2026-07-03. Branch: `chore/documentation-update`. 99 commits. Working tree clean._

---

## What changed since the last map (2026-06-25 → 2026-07-03)

The previous map was generated mid-flight on `feature/ai-assistant` with uncommitted work. **That work has all landed and merged to `main`.** Four slices closed in this window:

| Slice | Change ID | What landed |
|-------|-----------|-------------|
| S-06 | ai-assistant | p4+p5 (vector search) + **p6 (conversation history + named threads)** — both migrations now committed |
| S-07 | trainer-analytics | analytics page (6 stat cards, charts) + **future-appointment status bug fix** + E2E spec |
| S-08 | dashboard-home-data | live dashboard moved into `(app)/dashboard/`; new shared `stat-card.tsx` |
| S-11 | theme-toggle | `ThemeToggle` wired into `(app)/layout.tsx` + `MobileHeader.tsx` |

Two stale traps from the last map are **now resolved** (see Artifact 2): the `conversations` tables and the pgvector migration both exist and are committed.

---

## Noise Filter

Excluded from all counts — high frequency, zero signal:

| Pattern | Why it's noise |
|---|---|
| `package-lock.json` | Regenerated on every `npm install` |
| `context/` | Plan/research docs, not runtime code |
| `public/`, `.agents/`, `patches/` | Static assets / skill defs / one-off patch |
| `context/archive/`, `roadmap.md` | Bookkeeping on slice close |

---

## File Touch Frequency (cumulative, noise excluded, src/ only)

| Touches | File | Category |
|---------|------|----------|
| 7 | `src/app/api/ai/chat/route.ts` | **AI API** — highest cumulative churn; now **dormant** (S-06 closed) |
| 7 | `src/components/NavLink.tsx` | Navigation shell |
| 6 | `src/app/globals.css` | Global styles |
| 6 | `src/app/dashboard/{page,layout}.tsx` ¹ | App shell (pre-refactor path) |
| 6 | `src/app/(app)/layout.tsx` | App shell (current path) |
| 5 | `src/app/layout.tsx` | Root layout |
| 5 | `src/app/actions/packages.ts` ² | Package server actions |
| 4 | `src/app/(app)/calendar/TimeGrid.tsx` | Calendar rendering hub |
| 4 | `src/app/(app)/calendar/page.tsx` | Calendar page |
| 4 | `src/app/(app)/calendar/AppointmentDetailModal.tsx` | **Appointment status UI** — see hot area below |
| 4 | `src/app/login/page.tsx` | Auth boundary |
| 3 | `src/app/(app)/analytics/page.tsx` | **Analytics — newest active area (3 of 3 touches in last window)** |
| 3 | `src/app/actions/appointments/index.ts` | **Appointment write path — status guard added here** |

¹ Old path (`src/app/dashboard/`) — renamed to `src/app/(app)/` in S-03. ² Renamed to `actions/packages/index.ts` in S-03.

**Cumulative frequency now lags behind reality:** `route.ts` is still #1 by lifetime touches but has had **zero active work since S-06 closed**. The files that moved *in the last window* are analytics, appointment actions, and layout — not the AI route.

---

## Recently active files (this window only, 2026-06-24 → today)

| Touches | File | Driver |
|---------|------|--------|
| 3 | `src/app/(app)/analytics/page.tsx` | S-07 built from scratch |
| 2 | `src/app/actions/appointments/index.ts` | Future-appointment status guard (S-07 bugfix) |
| 2 | `src/app/actions/appointments/appointments.test.ts` | Test-baseline + status guard tests |
| 2 | `src/app/(app)/layout.tsx` | Theme toggle placement (S-11) |
| 1 | `src/components/stat-card.tsx` | New shared component (S-07 + S-08) |
| 1 | `src/app/(app)/dashboard/page.tsx` | Live dashboard (S-08) |

---

## Co-Change Pairs (files that move together, cumulative)

| Count | File A | File B | Interpretation |
|-------|--------|--------|----------------|
| 3x | `calendar/page.tsx` | `calendar/TimeGrid.tsx` | TimeGrid is the calendar rendering hub — page always drives it |
| 3x | `calendar/CalendarView.tsx` | `calendar/TimeGrid.tsx` | Same hub, pulled in by CalendarView |
| 3x | `calendar/MonthView.tsx` | `calendar/TimeGrid.tsx` | TimeGrid co-moves with **all** calendar views |
| 3x | `clients/ClientCard.tsx` | `clients/ClientsClientSection.tsx` | Section re-renders when card changes |
| 2x | `actions/appointments/index.ts` | `AppointmentDetailModal.tsx` | **Status write coupling** — server guard + UI hide moved together (S-07 fix) |
| 2x | `(app)/layout.tsx` | `NavLink.tsx` | Nav changes ripple into the shell |
| 2x | `.env.example` | `package.json` | Every new dependency also adds an env var |

**New signal this window:** `actions/appointments/index.ts` ↔ `AppointmentDetailModal.tsx`. The future-appointment fix touched the **server guard** (`updateAppointmentStatusAction`) and the **UI** (hide completed/no_show buttons) in the same commit. Two places enforce one rule — they must stay in sync.

---

## Sensitive Cross-Boundary Commits (runtime + build/infra in one commit)

| SHA | Date | Subject |
|-----|------|---------|
| dca9b78 | 2026-06-25 | S-06 vector search — `.env.example` + `embeddings.ts` + `route.ts` |
| a437939 | 2026-06-04 | S-06 AI SDK v5 — `package.json` + `route.ts` + `context.ts` |
| 0a786c6 | 2026-06-04 | S-04 full calendar — `package.json` + 3 migrations + all calendar components |

### Auth boundary
`middleware.ts` / `auth.ts` / login-register pages — last real change **2026-05-30** (package palette refactor restyled login). Untouched since. Stable but sensitive.

### DB schema / migrations (all now committed, none pending)
```
20240101000000  initial schema
20260601–03     appointment ends_at / package_price / status columns  (S-04)
20260605000001  pgvector                                              (S-06, now committed)
20260625000001  conversations + conversation_messages                (S-06 p6, now committed)
```
No uncommitted migrations. The prod-drift risk called out in the last map is closed **on disk** — confirm it was actually applied to the Supabase instance (see Constraints in repo-map).

---

## Timeline of Slices (commit-derived)

```
2026-05-19  scaffold
2026-05-26  S-01 auth            ←── auth boundary last real change
2026-05-29  F-01 streaming route
2026-05-30  S-02 packages        ←── login page last touched (styling)
2026-06-01  S-03 clients
2026-06-04  S-04 calendar        ←── status column + TimeGrid emerges as hub
2026-06-04  S-05 client-card
2026-06-04→25  S-06 ai-assistant ←── closed & archived 2026-06-25
2026-06-25  S-07 analytics       ←── status field becomes analytics' data source; guard bugfix
2026-06-27  S-08 dashboard       ←── stat-card shared component
2026-06-29  S-11 theme-toggle
2026-07-01  docs + repo map
```

---

## Sensitive Areas Before a Large Change (current)

| Area | Risk | Reason |
|------|------|--------|
| `actions/appointments/index.ts` (`status`) | **High** | Sole writer of appointment status; feeds calendar **and** analytics **and** dashboard. Only revalidates `/calendar`. |
| `(app)/analytics/page.tsx` | **Medium-High** | Newest area; every KPI is a projection of the status field; 410-line single file |
| `calendar/TimeGrid.tsx` | **Medium-High** | Hidden hub — co-moves with all calendar views |
| `(app)/layout.tsx` | **Medium** | App shell; nav + ChatWrapper + ThemeToggle + auth redirect all live here |
| `middleware.ts` | **Low (but sensitive)** | Untouched since scaffold; affects every request |
| `lib/supabase/{client,server}.ts` | **Low (but sensitive)** | Scaffold-only; `server.ts` now has 16 importers |
