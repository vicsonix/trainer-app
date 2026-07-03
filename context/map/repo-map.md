# Repo Map

_Synthesized from: git log analysis (99 commits, co-change pairs), madge dependency graph (88 files), diff-level review._
_Generated: 2026-07-03. Branch: `chore/documentation-update`. Working tree clean; all slices merged to `main`._
_Supersedes the 2026-06-25 map, which was generated mid-flight on `feature/ai-assistant`._

---

## What this project is

Solo trainer management app. One contributor (Victoria), AI pair on every commit. Stack: Next.js 16 App Router, Supabase (auth + PostgreSQL + RLS), Cloudflare Workers (via OpenNext), Vercel AI SDK v5 + Anthropic claude-haiku-4-5.

**Nine slices shipped and archived** (F-01, S-01…S-08, S-11). Two proposed, not started: S-09 notifications, S-10 profile. No work in flight.

---

## What changed since the last map

The previous map's headline items were all about *in-flight* AI work. That work landed. The three most important deltas:

1. **S-06 (AI assistant) closed.** `route.ts` is still the highest-churn file by lifetime count but is now **dormant** — the churn signal is stale.
2. **Two "look wired but aren't" traps resolved.** The `conversations` tables and the pgvector migration now have committed migrations (`20260625000001_conversations.sql`, `20260605000001_pgvector.sql`). Confirm they were applied to the live Supabase instance.
3. **A new load-bearing coupling emerged.** The appointment `status` field now feeds three surfaces — calendar, analytics (S-07), dashboard (S-08) — but its sole writer only invalidates the calendar. This is the current map's center of gravity.

---

## The four narrow doors

Loaded by the framework, not imported by any `src/` file. The import graph doesn't see them; the entire app passes through them.

| File | Loaded by | If broken |
|------|-----------|-----------|
| `src/middleware.ts` | Next.js, every request | Auth bypass or redirect loop. Untouched since S-01 |
| `src/app/(app)/layout.tsx` | Next.js layout tree | All 6 protected pages lose nav, ChatWrapper, ThemeToggle, auth check |
| `src/app/api/ai/chat/route.ts` | HTTP POST `/api/ai/chat` | Entire chat UI goes dark |
| `src/app/layout.tsx` | Next.js root layout | Global styles, toaster, ThemeProvider gone app-wide |

---

## The widest blast radius

**`src/lib/supabase/server.ts`** — now imported by **16 files** (was 13; analytics + dashboard + conversations-test added), spanning every layer. Contract is one line:
```ts
createClient(): Promise<SupabaseClient>
```
Changing its return type or throw behavior breaks the entire app at once.

**`src/lib/utils.ts`** — ~15 UI components. Pure `cn()`. Low change risk, rebuilds all UI on touch.

**`src/components/stat-card.tsx`** — new shared insight primitive; imported by both analytics and dashboard. A prop-shape change hits both surfaces.

---

## Hidden hubs (co-change, not imports)

- **`calendar/TimeGrid.tsx`** — no special import status, but co-moves with every calendar view (page 3×, CalendarView 3×, MonthView 3×). The calendar's rendering core. **Check it before touching any calendar view.**
- **The `status` column** — invisible to madge (it's data, not an import). Written in one place, read in three. See below.

---

## The current risk center: appointment `status`

```
AppointmentDetailModal (UI)
   └─► updateAppointmentStatusAction   actions/appointments/index.ts:182
         ├─ server guard: completed|no_show require starts_at <= now
         ├─ update({ status }).eq(trainer_id)
         └─ revalidatePath('/calendar')      ⚠ ONLY /calendar
   status ∈ {scheduled, completed, cancelled, no_show}
         ├─► calendar   (overlap excludes cancelled/no_show)
         ├─► analytics  (all KPIs + revenue are projections of status)
         └─► dashboard  (status-derived tiles)
```

The write revalidates only `/calendar`, yet analytics and dashboard derive from the same column. Whether they show stale numbers after a status change is **unproven** — the key unknown driving the deep-dive below.

---

## Four cycles, one root cause (unchanged)

`npx madge --circular` → 4 cycles, all in `src/app/(app)/clients/`. Root cause: `PackageOption` interface lives in `clients/page.tsx` and is `import type`-d by 4 siblings. Runtime-safe (`import type` erased), but `page.tsx` plays two roles and every `PackageOption` change fans out to 4 files. Fix when convenient: move it to `clients/types.ts`.

---

## Still dead code

`src/lib/supabase/client.ts` (`createBrowserClient`) — zero importers in `src/`. All chat UI talks to the API route over HTTP. Held for a future realtime feature, or removable.

---

# Deep-dive target (this map's pick)

The lesson asks for **one** flow to deepen. Selection is driven by the three sections below.

## 1. Risk zones → the target

The hardest current coupling is the appointment **`status` write-path**. It:
- crosses the most boundaries — one server action → DB enum → three independent read surfaces (calendar, analytics, dashboard);
- is the **newest** live coupling (analytics turned status into a reporting primitive on 2026-06-25, with a bug fix in the same commit);
- has a **structural smell**: the sole writer `revalidatePath`s only `/calendar`, so analytics/dashboard may silently disagree;
- carries a business guardrail — the future-appointment guard is enforced in two places (UI + server) that must stay in sync.

This beats the previously-chosen AI approval flow, which is now closed, dormant, and already documented under `context/archive/2026-06-04-ai-assistant/`.

## 2. First day → entry points (read these first, in order)

1. `src/app/actions/appointments/index.ts` — `updateAppointmentStatusAction` (line 182): the guard, the update, the single `revalidatePath`.
2. `src/app/(app)/calendar/AppointmentDetailModal.tsx` — the UI that calls it and mirrors the guard by hiding buttons.
3. `src/app/(app)/analytics/page.tsx` — how every KPI (counts, revenue, cancellation rate) is derived from `status` (lines 82–94).

Then skim `src/app/(app)/dashboard/page.tsx` for the third reader, and `playwright/{calendar,analytics}.spec.ts` for what E2E already covers.

## 3. Constraints → first unknowns for the agent to confirm or refute

- **U1 — Cache/revalidation:** `updateAppointmentStatusAction` invalidates only `/calendar`. Are `/analytics` and `/dashboard` dynamically rendered (so they refetch on next visit), or do they serve stale status-derived numbers? Confirm by rendering mode / fetch caching.
- **U2 — Migrations applied to prod:** the `conversations` and `pgvector` migrations exist on disk and are committed. Confirm they are actually applied to the live Supabase instance, not just present in `supabase/migrations/`.
- **U3 — Revenue data hole:** revenue sums `completed` appointments with non-null `price` only. Is the "N of M priced" display intentional, or are unpriced completed sessions an unintended gap?
- **U4 — Status/date drift:** the guard blocks *setting* completed/no_show on a future appointment, but does editing an already-completed appointment's date to the future re-validate? Can status and `starts_at` disagree?

---

## Before any significant change: the short checklist

```
□ Touching appointment status handling?
  → Keep BOTH guards (UI hide + server starts_at check); server is source of truth.
  → If a new surface reads status, extend revalidatePath or confirm dynamic rendering.
  → A new status enum value must be handled in calendar overlap + analytics + dashboard.

□ Touching middleware.ts or supabase/server.ts?
  → Full regression across auth + every page + every action (16 importers).

□ Touching (app)/layout.tsx?
  → NavLink, ChatWrapper, MobileHeader, ThemeToggle, auth redirect change together.

□ Touching any calendar component?
  → Check TimeGrid.tsx — it co-moves with everything in that module.

□ Touching route.ts or lib/ai/?
  → Area is closed/dormant; read context/archive/2026-06-04-ai-assistant/ first.
  → Do not add module-level env-var reads that throw (CF Workers cold-start).
  → New tools go in the domain file under lib/ai/tools/, not in route.ts.
```

---

## Stable areas (low risk)

| File / Area | Last touched | Note |
|---|---|---|
| `src/middleware.ts` | 2026-05-26 (S-01) | Auth gate — correct by inertia, sensitive by nature |
| `src/lib/supabase/{client,server}.ts` | scaffold | Foundation; never changed |
| `src/app/api/ai/chat/route.ts` + `lib/ai/` | 2026-06-25 (S-06) | Closed & archived; dormant |
| `src/app/actions/packages/` | 2026-05-30 (S-02) | Complete; tests pass |
| `src/app/(app)/calendar/` (excl. TimeGrid + status path) | 2026-06-25 | Done |
