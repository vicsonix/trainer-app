# Dashboard Home Data — Implementation Plan

## Overview

Replace the static dashboard page with a live data view that gives the trainer an at-a-glance picture of their week on every login: a quick-stats row (visits this week, revenue this month, active clients), an upcoming appointments list (today + next 2–3 from this week), a recent activity list (last 5 completed/cancelled), and the existing navigation cards moved to the bottom.

## Current State Analysis

`src/app/(app)/dashboard/page.tsx` is a fully static React component — no async, no Supabase queries, no data. It renders 4 hardcoded navigation cards (Pakiety, Klienci, Kalendarz, Asystent) and a "Witaj z powrotem!" heading. Nothing fetched, nothing live.

All data needed for the dashboard already exists in three Supabase tables: `appointments` (status, starts_at, price, client_id), `clients` (id, package_id, first_name, last_name), `packages`. The established Server Component + `Promise.all` fetch pattern from `analytics/page.tsx:85-90` applies directly.

`StatCard` (`analytics/page.tsx:38-56`) is the right component for the quick-stats row, but it currently lives as a local function inside the analytics page. `lessons.md` specifies that hand-written application components go in `src/components/` — it needs to move there before the dashboard can use it.

## Desired End State

The dashboard page is an async Server Component that fetches data in a single `Promise.all` call and renders:
- A **quick-stats row** with 3 cards: visits completed this week, revenue this month (zł), active clients count
- An **upcoming appointments** section: all of today's scheduled sessions listed first, then the next 2–3 scheduled from the rest of the week; if none, a CTA linking to `/calendar`
- A **recent activity** section: last 5 completed or cancelled appointments with client name, date, and a status badge; if none, a CTA linking to `/calendar`
- The **4 navigation cards** at the bottom (same design, moved from top to bottom)

### Verification

Navigate to `/dashboard` as a logged-in trainer. The quick-stats row shows correct numbers (cross-check against `/analytics`). The upcoming list shows only scheduled appointments from today onward. The recent activity list shows the last 5 non-scheduled appointments. On a fresh account with no data, each section shows a Polish empty-state message with a working link. Navigation cards are present at the bottom and link correctly.

### Key Discoveries

- Analytics `Promise.all` pattern at `analytics/page.tsx:85-90` — copy this structure exactly, 5 queries in parallel
- `StatCard` component at `analytics/page.tsx:38-56` — extract to `src/components/stat-card.tsx`; props shape: `{ value, label, footnote?, icon, iconBg, iconColor, valueColor? }`
- All date computations use UTC (matching `analytics/page.tsx:22-30`) — `Date.UTC(...)` not local `new Date()`
- Supabase supports `select('*, clients(first_name, last_name)')` for inline joins — no separate client name query needed
- Active clients definition = `clients WHERE package_id IS NOT NULL` — matches what analytics calls `clientsWithPackage`
- RLS ensures `.eq('trainer_id', user.id)` is the only ownership filter needed

## What We're NOT Doing

- No schema changes — everything comes from existing `appointments`, `clients`, `packages` tables
- No personalised greeting with the trainer's name — "Witaj z powrotem!" stays static (no extra auth metadata query)
- No real-time updates or Supabase Realtime subscriptions — page fetches on each navigation, same as every other page
- No period selector on the dashboard (that's analytics' job)
- No blob-background decoration (the current dashboard and analytics both use simple `bg-card` cards with no blob layer — keep consistent)
- No changes to the sidebar navigation, layout, or any other page

## Implementation Approach

Two file changes with a shared dependency extracted first:

1. Extract `StatCard` from analytics into `src/components/stat-card.tsx`, then update analytics to import it from there.
2. Rewrite `src/app/(app)/dashboard/page.tsx` as an async Server Component with a single `Promise.all` covering 5 Supabase queries. Compute quick-stats in-memory (no additional round-trips). Render sections top-to-bottom: header → quick-stats → upcoming + recent (side by side on desktop, stacked on mobile) → nav cards.

---

## Phase 1: Extract StatCard and Implement Dashboard

### Overview

Extract the shared `StatCard` component, update analytics to use it, then build the full live dashboard in one cohesive change.

### Changes Required

#### 1. Shared StatCard component

**File**: `src/components/stat-card.tsx`

**Intent**: Move the StatCard component out of analytics into the shared components directory so both analytics and dashboard can import it without duplication.

**Contract**: Named export `StatCard`. Props interface:
```ts
{
  value: React.ReactNode
  label: string
  footnote?: React.ReactNode
  icon: React.ElementType
  iconBg: string
  iconColor: string
  valueColor?: string
}
```
Body is a verbatim copy of the current function at `analytics/page.tsx:38-56`. Add `'use client'` only if needed — it's a pure presentational component with no hooks, so it can remain a Server Component (no directive needed).

---

#### 2. Update analytics to import shared StatCard

**File**: `src/app/(app)/analytics/page.tsx`

**Intent**: Remove the local `StatCard` function definition (lines 38–56) and replace it with an import from the new shared location.

**Contract**: `import { StatCard } from '@/components/stat-card'`. All existing `<StatCard .../>` usages stay unchanged.

---

#### 3. Dashboard page — async Server Component with live data

**File**: `src/app/(app)/dashboard/page.tsx`

**Intent**: Convert from a static component to an async Server Component that fetches five Supabase queries in parallel and renders the full live dashboard layout.

**Contract**:

Date boundaries (all UTC, computed at render time):
```ts
const now        = new Date()
const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
const todayEnd   = new Date(todayStart); todayEnd.setUTCDate(todayEnd.getUTCDate() + 1)
const weekStart  = new Date(todayStart); weekStart.setUTCDate(todayStart.getUTCDate() - ((todayStart.getUTCDay() + 6) % 7))
const weekEnd    = new Date(weekStart);  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)
const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
```

Five queries in a single `Promise.all`:
- `upcoming`: `appointments` WHERE `status = 'scheduled'` AND `starts_at >= todayStart`, select `id, starts_at, ends_at, clients(first_name, last_name)`, order `starts_at` asc, limit 8
- `recentActivity`: `appointments` WHERE `status IN ('completed', 'cancelled', 'no_show')`, select `id, starts_at, status, clients(first_name, last_name)`, order `starts_at` desc, limit 5
- `weeklyCompleted`: `appointments` WHERE `status = 'completed'` AND `starts_at >= weekStart` AND `starts_at < weekEnd`, select `id` only (count from `.length`)
- `monthlyRevenue`: `appointments` WHERE `status = 'completed'` AND `starts_at >= monthStart`, select `price` (sum client-side)
- `activeClients`: `clients` WHERE `package_id IS NOT NULL`, use `select('id', { count: 'exact', head: true })`

In-memory derivation:
- `visitsThisWeek` = `weeklyCompleted.length`
- `revenueThisMonth` = `monthlyRevenue.reduce((s, a) => s + (a.price ?? 0), 0)`
- `activeClientsCount` = the `count` value from the `activeClients` query
- `todayAppts` = `upcoming.filter(a => a.starts_at < todayEnd.toISOString())`
- `nextAppts` = `upcoming.filter(a => a.starts_at >= todayEnd.toISOString()).slice(0, 3)`

Layout (top to bottom):
1. **Header**: existing "Panel trenera" badge + "Witaj z powrotem!" heading + subtitle (unchanged styling)
2. **Quick-stats row**: 3 `<StatCard>` components in a `grid grid-cols-3 gap-3` — visits (jungle-teal), revenue (tiger-orange), active clients (lobster-pink). Revenue formatted as `${revenueThisMonth.toFixed(2)} zł`.
3. **Activity grid**: `grid gap-4 lg:grid-cols-2` containing:
   - *Upcoming card*: `rounded-xl bg-card ring-1 ring-foreground/10` with a top stripe `h-0.5 bg-gradient-to-r from-tiger-orange-400 to-tiger-orange-600`. Lists `todayAppts` first (with a "Dziś" day label if any), then `nextAppts` (with their date). Each row: time on left, client name on right. Empty state: `Brak nadchodzących wizyt — <Link href="/calendar">Zaplanuj wizytę →</Link>`
   - *Recent activity card*: same card shell, top stripe `h-0.5 bg-gradient-to-r from-jungle-teal-400 to-jungle-teal-600`. Lists `recentActivity` rows with client name, date, and a status badge (`completed` → jungle-teal, `cancelled` / `no_show` → destructive). Empty state: `Brak ostatniej aktywności — <Link href="/calendar">Dodaj wizytę →</Link>`
4. **Nav cards**: existing 4-card grid moved verbatim to the bottom (same classes, same data, no styling changes).

### Success Criteria

#### Automated Verification

- TypeScript compilation passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Build completes without error: `npm run build`

#### Manual Verification

- Dashboard shows live stat numbers; quick-stats values match the analytics page (same counts)
- Upcoming section lists today's scheduled appointments first, then next 2–3 from the week
- Recent activity section lists last 5 completed/cancelled with correct status badges
- Each section displays an empty-state CTA when there is no data (new trainer account)
- Nav cards are at the bottom and all 4 links navigate to the correct pages
- Browser network tab shows ≤ 5 Supabase requests on page load (no N+1)
- No regressions on the analytics page (StatCard renders identically after extraction)

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation that the dashboard renders correctly before considering this change done.

---

## Testing Strategy

### Manual Testing Steps

1. Log in as a trainer with existing appointments. Navigate to `/dashboard`.
2. Note the visits-this-week count. Open `/analytics` → verify the same number appears under "Sesji ukończonych" for the equivalent period.
3. Check the upcoming section: only scheduled appointments from today onward should appear.
4. Mark one today's appointment as completed in the calendar. Reload dashboard — it should move from upcoming to recent activity.
5. Create a fresh test account with no data. Visit `/dashboard`. Confirm all three data sections show CTA empty states with working links.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-08, line 169)
- StatCard source: `src/app/(app)/analytics/page.tsx:38-56`
- Fetch pattern reference: `src/app/(app)/analytics/page.tsx:85-90`
- Component directory convention: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Extract StatCard and Implement Dashboard

#### Automated

- [x] 1.1 TypeScript compilation passes: `npm run typecheck`
- [x] 1.2 Linting passes: `npm run lint`
- [x] 1.3 Build completes without error: `npm run build`

#### Manual

- [ ] 1.4 Dashboard shows live stat numbers matching analytics page
- [ ] 1.5 Upcoming section lists today's appointments first, then next 2–3 from the week
- [ ] 1.6 Recent activity shows last 5 completed/cancelled with correct status badges
- [ ] 1.7 Empty-state CTAs appear on a fresh account and links work
- [ ] 1.8 Nav cards at bottom, all 4 links correct
- [ ] 1.9 ≤ 5 Supabase requests on page load (no N+1)
- [ ] 1.10 Analytics page StatCard renders identically after extraction
