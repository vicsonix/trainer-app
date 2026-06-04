# Calendar Appointments — Plan Brief

> Full plan: `context/changes/calendar-appointments/plan.md`
> Research: `context/changes/calendar-appointments/research.md`

## What & Why

Build the `/calendar` page: a custom month/week/day appointment calendar where the trainer can create, view, edit, and delete sessions, and click any appointment to instantly see the full client card (FR-010–014). The calendar is the core value flow of the trainer app — the trainer opens it 5 minutes before every session to get client context, so it must be fast, mobile-friendly, and reliable.

## Starting Point

The `appointments` table already exists (`supabase/schema.sql:28-35`) with `id`, `trainer_id`, `client_id`, `starts_at`, `created_at`. The `/calendar` nav link is wired but the page doesn't exist. No calendar library is installed. The server-action pattern, Zod schema pattern, and Radix UI Dialog components are all established by the clients and packages features.

## Desired End State

A `/calendar` page where the trainer sees all appointments in a month, week, or day grid (switchable via tabs), clicks an empty slot to create a new appointment (pre-filled date/time), and clicks an existing event to see the client card with remaining package sessions — plus edit and delete from the same modal. On mobile, the calendar auto-switches to day view.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Calendar library | Custom-built with @internationalized/date | Zero dependency risk, 100% Tailwind v4 control, no React 19 peer-dep friction | Plan |
| Schema additions | Add `ends_at` + `notes` to appointments | `ends_at` is required for time-block height in week/day view; `notes` adds per-session context | Plan |
| Create appointment UX | Click on empty day cell / time slot | Pre-fills date/time; fastest path for the 5-min pre-session flow | Plan |
| Click event → | Detail modal with client card + edit/delete | Satisfies FR-012 in-context without leaving the calendar | Plan |
| Default view | Week; auto-switch to day view on mobile | Weekly is the PRD's primary view; day view is the only legible layout on a phone | Research + Plan |
| Duration input | Start time + duration dropdown (30/60/90/120 min) | Matches how trainers think ("1-hour session at 10am"); fewer taps | Plan |
| Remaining sessions | Live join computed on page load | Always accurate, follows existing fetch pattern, acceptable at solo-trainer scale | Plan |
| Testing | Vitest unit tests + Playwright E2E | Unit tests cover action logic; E2E proves the full data round-trip that units can't | Plan |

## Scope

**In scope:**
- DB migration adding `ends_at` and `notes` to appointments table
- Month / week / day views with prev/next/today navigation
- Click empty slot → create appointment modal (client selector, date, time, duration, notes)
- Click existing event → detail modal (client card, remaining sessions, edit, delete)
- Server actions: create, update, delete appointment
- Remaining sessions counter on every event label
- Vitest unit tests for all three server actions
- Playwright setup + one E2E test for the full lifecycle

**Out of scope:**
- Drag-and-drop rescheduling
- Recurring appointments
- AI assistant integration with calendar
- Push notifications or reminders
- Client-facing calendar view

## Architecture / Approach

Server Component (`page.tsx`) fetches appointments with a single nested Supabase query (appointments → clients → packages), computes remaining sessions per client via a TypeScript `reduce`, and passes `CalendarEvent[]` to a `"use client"` `CalendarClientSection`. The section owns modal state and renders a `CalendarView` component (state: `currentDate`, `view`) that delegates to `MonthView`, `WeekView`, or `DayView`. Week and day views share a `TimeGrid` component that uses a `positionEvents` utility for side-by-side rendering of overlapping events. Both modals (`CreateAppointmentModal`, `AppointmentDetailModal`) wire to the established `useActionState` + server-action pattern.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. DB Migration | `ends_at` + `notes` columns on appointments | Supabase db push must succeed before any server-action work |
| 2. Server Actions | create/update/delete + shared CalendarEvent type | `ends_at` computation from date+time+duration strings |
| 3. Calendar Components | Month/week/day views, navigation, mobile switch | Week-view event overlap positioning algorithm |
| 4. Appointment Modals | Create modal (slot click) + detail/edit/delete modal | stopPropagation between slot click and event click |
| 5. Page Assembly | Live `/calendar` with real Supabase data | Nested Supabase select returning correct shape |
| 6. Testing | Vitest unit tests + Playwright E2E | Playwright auth setup; test isolation (no shared state) |

**Prerequisites:** Supabase project linked (`npm run db:link`). At least one client and one package exist in the database to test the remaining-sessions display.  
**Estimated effort:** ~4–6 development sessions across 6 phases (Phases 2 and 3 can run in parallel after Phase 1).

## Open Risks & Assumptions

- `@internationalized/date` v3.12.2 has no React dependency and no SSR concerns — but verify it's available as an ESM-only package compatible with Next.js 16 + Cloudflare bundling before starting Phase 3.
- The week-view event overlap algorithm (`positionEvents`) is the most complex piece of new logic — budget extra time to test it in isolation before wiring it into the UI.
- Playwright E2E requires real Supabase credentials (`PLAYWRIGHT_TEST_EMAIL`, `PLAYWRIGHT_TEST_PASSWORD`) — these must exist in the test environment or the E2E suite cannot run.

## Success Criteria (Summary)

- Trainer can complete the full appointment flow (create → view → click → client card → delete) in under 10 taps on mobile
- Remaining sessions count is always accurate relative to `package.visit_count`
- `npx playwright test` passes the `calendar.spec.ts` lifecycle test against the local dev server
