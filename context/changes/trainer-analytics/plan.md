# Trainer Analytics Page Implementation Plan

## Overview

Add a dedicated `/analytics` page where the trainer can view aggregated stats — completed visits, cancellations, no-shows, revenue, and top packages by usage — filterable by period (this month / last 3 months / all time). Data is computed server-side from the existing `appointments` and `packages` tables with no schema changes.

## Current State Analysis

The app has a complete data model for analytics. `appointments.status` (completed | cancelled | no_show | scheduled) and `appointments.price` (numeric 10,2) carry all the signal needed. `packages` carries name and base price. The Server Component + Supabase fetch pattern is well-established across calendar, clients, and packages pages. There is no chart library installed; CSS-based bars will be used. Navigation lives in `src/app/(app)/layout.tsx` (navLinks array) and `src/components/NavLink.tsx` (icon map).

## Desired End State

The trainer opens `/analytics` and sees:
- A period selector (This Month / Last 3 Months / All Time) that updates the URL (`?period=`) and triggers a server re-fetch
- Four stat cards: Completed Sessions, Cancelled, No-shows, Revenue
- Revenue card shows a footnote when some appointments lack price data: "Based on X of Y sessions with price data"
- A package popularity section listing packages ordered by completed visit count, each with a CSS horizontal bar proportional to max usage
- Per-section empty states with a link to `/calendar` when no data exists for the period

### Key Discoveries

- `appointments.status` CHECK constraint: `'scheduled' | 'completed' | 'cancelled' | 'no_show'` — `supabase/migrations/20260603000001_add_appointment_status.sql`
- `appointments.price` nullable numeric(10,2); `appointments.package_id` nullable FK to packages — `supabase/migrations/20260602000001_add_appointment_package_price.sql`
- All queries scope by `eq('trainer_id', user.id)` — RLS also enforces this but explicit filter is the pattern
- Navigation array: `src/app/(app)/layout.tsx:9-15`; icon map: `src/components/NavLink.tsx:8-14`
- Period filter can be pure SSR using `<Link href="?period=...">` — no client component needed for the selector
- Data volume is low (solo trainer, 5–20 sessions/week) — fetching all appointments for a period and aggregating in JS is efficient

## What We're NOT Doing

- No chart library (recharts, chart.js, etc.) — CSS bars only
- No custom date ranges — three fixed periods only
- No per-client breakdown or drill-down views
- No schema changes or new Supabase RPC functions
- No caching layer — standard Next.js server render per request is sufficient at this scale
- No export or print functionality

## Implementation Approach

Single Server Component page (`analytics/page.tsx`) that reads `searchParams.period`, computes a date range, runs two parallel Supabase queries (appointments + packages), aggregates counts and revenue in server JS, and renders all sections. Period selector tabs are `<Link>` elements — clicking triggers a standard Next.js navigation to the same page with a different query param, causing a full server re-render. No client component boundary needed.

## Critical Implementation Details

**searchParams is async in Next.js 15+.** The page signature must be `{ searchParams }: { searchParams: Promise<{ period?: string }> }` with `const { period = 'month' } = await searchParams`. Following the existing pattern from other pages in this app.

**Aggregation in server JS, not SQL.** Supabase JS SDK has no native GROUP BY + COUNT syntax. Fetch `status`, `price`, and `package_id` for the period; aggregate in-process. At solo-trainer scale this is faster than a raw SQL RPC and follows the pattern already established in the app.

---

## Phase 1: Navigation Entry + Data Layer

### Overview

Wire `/analytics` into the nav and build the data-fetching + aggregation layer as a Server Component. The page renders with no UI yet beyond the raw data — success here is confirmed data visible via `console.log` during dev or by the server component rendering basic text.

### Changes Required

#### 1. Navigation — navLinks array

**File:** `src/app/(app)/layout.tsx`

**Intent:** Add the analytics route to the nav array so both the desktop sidebar and mobile bottom bar render the link.

**Contract:** Append `{ href: '/analytics', label: 'Analityka' }` as the sixth entry in the `navLinks` array (after the existing `assistant` entry at line ~15).

#### 2. Navigation — icon mapping

**File:** `src/components/NavLink.tsx`

**Intent:** Map the `/analytics` path to an icon so the NavLink component renders the correct icon for the new route.

**Contract:** In the `sectionIcons` object (lines 8–14), add `'/analytics': BarChart2` (import `BarChart2` from `lucide-react` alongside existing imports).

#### 3. Analytics page — Server Component scaffold

**File:** `src/app/(app)/analytics/page.tsx` (new file)

**Intent:** Server Component that authenticates, resolves the period, fetches raw appointment and package data in parallel, and aggregates into analytics stats for rendering.

**Contract:**

Page signature:
```typescript
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
})
```

Period resolution — map `period` param to a `from` ISO string (or `null` for all time):
- `'month'` → first day of current calendar month UTC
- `'3months'` → today minus 90 days
- `'all'` → `null` (no lower bound)

Parallel fetch — two queries, both scoped by `trainer_id`:
1. `appointments` — select `status`, `price`, `package_id`, filtered by `.gte('starts_at', from)` when `from` is not null
2. `packages` — select `id`, `name` (no date filter; need full list to look up names)

Aggregation (in server JS from query results):
- `completedCount` — appointments where status === 'completed'
- `cancelledCount` — status === 'cancelled'
- `noShowCount` — status === 'no_show'
- `completedWithPrice` — completed appointments where price is not null
- `totalRevenue` — sum of `price` over `completedWithPrice`
- `pricedCount` — length of `completedWithPrice` (for footnote: X of completedCount)
- `packageUsage` — for completed appointments with a non-null `package_id`, group by package_id and count; join package name from the packages query result; sort descending by count

### Success Criteria

#### Automated Verification

- TypeScript compiles with no errors: `npm run build` (or `npx tsc --noEmit`)
- ESLint passes: `npm run lint`

#### Manual Verification

- `/analytics` renders without a 500 error in dev (`npm run dev`)
- Nav sidebar and mobile bottom bar show "Analityka" with a BarChart2 icon
- The active link highlight applies correctly when on `/analytics`
- Switching `?period=month`, `?period=3months`, `?period=all` in the URL causes a server re-render with different data (verify via correct counts in dev)

**Implementation Note:** After completing this phase and all automated verification passes, pause here for manual confirmation that the nav entry renders and the data layer works before proceeding to the UI phase.

---

## Phase 2: Analytics UI

### Overview

Render the aggregated data as a polished analytics page: period selector tabs, four stat cards, package popularity section with CSS bars, and per-section empty states — all matching the existing design language.

### Changes Required

#### 1. Period selector tabs

**File:** `src/app/(app)/analytics/page.tsx`

**Intent:** Render three tab buttons (This Month / Last 3 Months / All Time) that link to the same page with different `?period=` params; the active tab is highlighted based on the current server-side `period` value.

**Contract:** Render a `<div>` with three `<Link>` elements using the tab switcher pattern from `src/app/(app)/calendar/CalendarNav.tsx:81-96`. Active tab: `bg-primary text-primary-foreground`. Inactive: `bg-background text-foreground hover:bg-muted`. Use `cn()` for conditional classes. Period labels: `'month' → 'Ten miesiąc'`, `'3months' → 'Ostatnie 3 miesiące'`, `'all' → 'Wszystko'` (Polish, matching app language).

#### 2. Stat cards grid

**File:** `src/app/(app)/analytics/page.tsx`

**Intent:** Display the four primary metrics in a responsive card grid — Completed Sessions, Cancelled, No-shows, Revenue.

**Contract:** Four `<Card>` components from `src/components/ui/card.tsx` in a `grid gap-4 sm:grid-cols-2 lg:grid-cols-4` layout. Each card follows the PackageCard stat-block pattern (`src/app/(app)/packages/PackageCard.tsx:37-53`): large bold number, small muted label beneath. Revenue card: format as `{totalRevenue.toFixed(2)} zł`; if `pricedCount < completedCount`, render a `<p className="text-[10px] text-muted-foreground mt-1">` below the value with the text `Na podstawie {pricedCount} z {completedCount} sesji z ceną`.

If `completedCount === 0` for the period, render a single empty-state panel instead of the four cards — centered text "Brak sesji w tym okresie" + a `<Link href="/calendar">` button using the ClientEmptyState pattern from `src/app/(app)/clients/ClientEmptyState.tsx`.

#### 3. Package popularity section

**File:** `src/app/(app)/analytics/page.tsx`

**Intent:** Show which packages are used most (by completed visits) as an ordered list with proportional CSS bars.

**Contract:** Section heading "Popularność pakietów". If `packageUsage` is empty (no completed appointments with a package_id), render an empty-state message: "Brak sesji z przypisanym pakietem w tym okresie" + Link to `/calendar`. Otherwise render a `<ul>` — each item:

```
[package name, truncated]  [proportional bar]  [count]
```

Bar: `<div className="flex-1 rounded-full bg-soft-linen-100 dark:bg-carbon-black-800 h-2">` containing an inner `<div>` with `style={{ width: \`${(item.count / maxCount) * 100}%\` }}` and `className="h-2 rounded-full bg-lobster-pink-500"`. `maxCount` = count of the top package (first item after sort). Show at most 5 packages.

#### 4. Page header

**File:** `src/app/(app)/analytics/page.tsx`

**Intent:** Standard page header matching the pattern used in clients and packages pages.

**Contract:** `<h1 className="text-2xl font-bold tracking-tight">Analityka</h1>` with a subtitle `<p className="text-sm text-muted-foreground mt-0.5">Twoje statystyki treningowe</p>`. Container: `max-w-5xl px-4 py-8`.

### Success Criteria

#### Automated Verification

- TypeScript compiles with no errors: `npm run build`
- ESLint passes: `npm run lint`

#### Manual Verification

- Period selector tabs render and switching between them changes the displayed counts
- Default period on first visit is "Ten miesiąc" (no `?period=` param defaults to `month`)
- All four stat cards display correct numbers for the selected period
- Revenue footnote appears when any completed appointment lacks a price; is hidden when all are priced
- Package popularity list orders correctly by completed visit count; bar widths are proportional
- Empty states appear when no appointments exist for the period; links to `/calendar` navigate correctly
- Page layout matches existing pages (same container width, same header pattern)
- Dark mode renders correctly (soft-linen/carbon-black backgrounds switch properly)
- Mobile: bottom nav shows Analityka with icon; layout does not overflow on small screens

**Implementation Note:** After completing this phase, verify all manual criteria above before considering S-07 done.

---

## Testing Strategy

### Manual Testing Steps

1. Open `/analytics` with no appointments → confirm all sections show empty states
2. Add a few completed and cancelled appointments in the test account → confirm counts update
3. Test all three period filters: "Ten miesiąc", "Ostatnie 3 miesiące", "Wszystko"
4. Add an appointment without a price → confirm revenue footnote appears
5. Assign appointments to different packages → confirm package popularity list orders correctly
6. Test on mobile (Chrome DevTools, 375px) — bottom nav, layout, bar widths
7. Toggle dark mode — confirm all backgrounds switch correctly
8. Direct-navigate to `?period=3months` → confirm correct period is active

## References

- Roadmap S-07: `context/foundation/roadmap.md:157-167`
- DB schema: `supabase/schema.sql` + `supabase/migrations/20260603000001_add_appointment_status.sql`
- Fetch pattern reference: `src/app/(app)/calendar/page.tsx:34-49`
- Nav array: `src/app/(app)/layout.tsx:9-15`
- Icon map: `src/components/NavLink.tsx:8-14`
- Tab switcher pattern: `src/app/(app)/calendar/CalendarNav.tsx:81-96`
- Stat block pattern: `src/app/(app)/packages/PackageCard.tsx:37-53`
- Empty state pattern: `src/app/(app)/clients/ClientEmptyState.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Navigation Entry + Data Layer

#### Automated

- [x] 1.1 TypeScript compiles with no errors (`npm run build` / `npx tsc --noEmit`)
- [x] 1.2 ESLint passes (`npm run lint`)

#### Manual

- [x] 1.3 `/analytics` renders without a 500 error in dev
- [x] 1.4 Nav sidebar and mobile bottom bar show "Analityka" with BarChart2 icon
- [x] 1.5 Active link highlight applies correctly on `/analytics`
- [x] 1.6 Switching `?period=` params in the URL produces different data (verify in dev)

### Phase 2: Analytics UI

#### Automated

- [ ] 2.1 TypeScript compiles with no errors (`npm run build`)
- [ ] 2.2 ESLint passes (`npm run lint`)

#### Manual

- [ ] 2.3 Period selector tabs render; switching changes displayed counts
- [ ] 2.4 Default period on first visit is "Ten miesiąc"
- [ ] 2.5 Four stat cards display correct numbers for selected period
- [ ] 2.6 Revenue footnote appears when any completed appointment lacks a price
- [ ] 2.7 Package popularity list orders correctly; bar widths are proportional
- [ ] 2.8 Empty states appear with links to `/calendar` when no data for period
- [ ] 2.9 Page layout matches existing pages (container, header pattern)
- [ ] 2.10 Dark mode renders correctly
- [ ] 2.11 Mobile layout correct; bottom nav shows Analityka
