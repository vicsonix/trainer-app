# Trainer Analytics Page — Plan Brief

> Full plan: `context/changes/trainer-analytics/plan.md`

## What & Why

Add a dedicated `/analytics` page so the trainer can see aggregated stats — completed visits, cancellations, no-shows, revenue, and top packages by usage — filterable by period. This is S-07 from the roadmap: a read-only insights layer that uses the appointment and package data already in place, with no schema changes required.

## Starting Point

The `appointments` table has a `status` enum (completed | cancelled | no_show | scheduled) and a nullable `price` column added in migrations through June 2026. The data-fetching pattern (Server Component → `createClient()` → parallel Supabase queries) is established across calendar, clients, and packages pages. No chart library is installed.

## Desired End State

The trainer navigates to `/analytics` from the main nav, selects "Last 3 Months", and sees: 42 completed sessions, 3 cancellations, 1 no-show, 8,400 zł revenue (with a footnote if any sessions lack price data), and a ranked bar chart of packages by usage. Empty sections show friendly messages with a link to the Calendar to add data.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Visualization | CSS-based bars, no chart library | Zero bundle cost; matches existing card patterns | Plan |
| Period filter implementation | URL search params (SSR) | Shareable URLs, no client-side fetch complexity | Plan |
| Available periods | This month / Last 3 months / All time | Matches roadmap spec exactly | Plan |
| Package ranking metric | By completed visit count | Reflects actual usage independent of price variance | Plan |
| Revenue with null prices | Show sum + partial-data footnote | Honest without hiding real earnings | Plan |
| Navigation placement | Add as 6th nav item (sidebar + mobile) | Directly discoverable, consistent with all other pages | Plan |
| Empty states | Per-section, each linking to Calendar | Specific guidance; avoids hiding partial data | Plan |

## Scope

**In scope:**
- `/analytics` page (Server Component, pure SSR)
- Period selector (This month / Last 3 months / All time) via URL param
- 4 stat cards: Completed, Cancelled, No-shows, Revenue
- Revenue partial-data footnote
- Package popularity section with CSS bars (top 5)
- Per-section empty states
- Nav entry in sidebar + mobile bottom bar

**Out of scope:**
- Chart library installation
- Custom date ranges
- Per-client drill-down
- Data export
- New Supabase schema or RPC functions

## Architecture / Approach

Single Server Component (`src/app/(app)/analytics/page.tsx`) reads `searchParams.period`, computes a date range, and runs two parallel Supabase queries: all appointments for the period (status + price + package_id) and all packages (id + name). Aggregation happens in server JS — count by status, sum revenue from non-null prices, group by package_id. Period tabs are `<Link href="?period=...">` elements; clicking triggers standard Next.js navigation and a full server re-render with new data. No client component or client-side fetch needed.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Navigation + Data Layer | Nav entry wired; Server Component fetching and aggregating data correctly | searchParams must be awaited (async in Next.js 15+) |
| 2. Analytics UI | All sections rendered: period tabs, stat cards, package bars, empty states | Revenue footnote logic and CSS bar proportions must handle edge cases (all null, single package) |

**Prerequisites:** S-04 (calendar-appointments) done — appointments table with status and price columns in place. ✓ Already done.

**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- Revenue accuracy depends on `appointments.price` being set at booking time; the partial-data footnote surfaces this honestly rather than silently zeroing.
- Adding a 6th item to the mobile bottom nav may squeeze icons — monitor on 320px-wide screens.
- Polish labels assumed throughout (matching existing nav labels: Panel, Pakiety, Klienci, Kalendarz, Asystent).

## Success Criteria (Summary)

- Period selector changes the data displayed correctly for all three periods
- Revenue footnote appears when any completed appointment lacks a price; is absent when all are priced
- Package popularity bars are proportional to the top package's count; empty state shows when no package-linked sessions exist
