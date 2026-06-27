# Dashboard Home Data — Plan Brief

> Full plan: `context/changes/dashboard-home-data/plan.md`

## What & Why

The dashboard is the first screen a trainer sees on login, but today it shows nothing useful — just 4 static navigation cards. S-08 makes it a live command centre: stats for the current week, upcoming appointments, and a recent activity feed, so the trainer gets immediate context without navigating elsewhere.

## Starting Point

`src/app/(app)/dashboard/page.tsx` is a fully static component with zero data fetching. The `StatCard` component needed for the stats row already exists inside `analytics/page.tsx` as a local function — it needs to move to `src/components/` (per `lessons.md`) before the dashboard can use it.

## Desired End State

On login the trainer sees: three live stat cards (visits this week, revenue this month, active clients), a list of today's upcoming appointments plus the next 2–3 from the week, a recent activity feed showing the last 5 completed or cancelled sessions, and the 4 quick-navigation cards moved to the bottom. Empty states with CTA links guide a new trainer who has no data yet.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Activity section shape | Two side-by-side cards (upcoming + recent past) | Clearer separation than a mixed timeline; fits the existing `lg:grid-cols-2` pattern from analytics |
| Nav cards | Keep, move to bottom | Removing them loses quick-tap shortcuts; bottom placement puts data first |
| Upcoming count | Today's sessions + next 2–3 from the week | Always shows something even on a day with no sessions |
| Empty state | CTA message + link per section | Matches the existing analytics empty-state pattern |
| Active clients definition | `clients WHERE package_id IS NOT NULL` | Consistent with how analytics counts `clientsWithPackage` |
| StatCard | Extract to `src/components/stat-card.tsx` | Dashboard and analytics both need it; `lessons.md` requires shared components there |
| Greeting | Keep "Witaj z powrotem!" static | No extra auth metadata query for a name that may not be set |

## Scope

**In scope:**
- Extract `StatCard` to `src/components/stat-card.tsx`
- Update analytics import
- Rewrite `dashboard/page.tsx` as async Server Component with 5 parallel Supabase queries
- Quick-stats row, upcoming section, recent activity section, nav cards at bottom

**Out of scope:**
- Schema changes
- Real-time updates / Supabase Realtime
- Period filter (analytics' responsibility)
- Personalised greeting with trainer's name
- Blob-background decoration

## Architecture / Approach

Single-phase change. Five Supabase queries run in one `Promise.all` at render time (no N+1). All date math in UTC. In-memory aggregation for stats (no extra round-trips). `StatCard` imported from the new shared location. Layout: header → stats row → `lg:grid-cols-2` activity grid → nav cards.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Extract StatCard + Implement Dashboard | Live stats, upcoming list, recent activity, nav cards at bottom | UTC date boundary bug showing wrong week/month counts |

**Prerequisites:** S-04 done (appointment data exists) ✓  
**Estimated effort:** ~1 session, single file rewrite + one extraction

## Open Risks & Assumptions

- UTC date boundaries must match exactly — `starts_at` is stored as ISO UTC in Supabase; `todayStart` computed with `Date.UTC(...)` not local `new Date()`. Mismatch produces wrong day grouping.
- `clients(first_name, last_name)` inline join in `select()` assumes Supabase foreign-key relationship between `appointments.client_id` and `clients.id` is registered — verify in schema if the join returns `null`.

## Success Criteria (Summary)

- Quick-stats numbers match the analytics page for the same time window
- Upcoming section shows only future scheduled appointments; recent activity shows only past completed/cancelled
- Fresh account sees CTA empty states in all data sections, not blank space
