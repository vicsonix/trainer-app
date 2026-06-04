# Calendar Appointments Implementation Plan

## Overview

Build a complete appointment calendar for the trainer app with custom month/week/day views, CRUD appointment management, and client card access from event clicks. The calendar is built from scratch using `@internationalized/date` (no third-party library), styled entirely with Tailwind v4, and backed by migrations that add `ends_at`, `notes`, `package_id`, and `price` to the existing `appointments` table.

### Model change (post-plan decision)

`appointments` carries two new columns beyond the original spec:
- `package_id uuid` (nullable FK → `packages`) — links a visit to a specific package; **null means one-off session**
- `price numeric(10,2)` (nullable) — explicit charge for one-off sessions; for package visits the per-session rate is derived from `package.price / package.visit_count` and shown as read-only info

**Remaining sessions** is now `package.visit_count − COUNT(appointments WHERE package_id = package.id)` — one-off sessions (package_id null) no longer incorrectly reduce the package counter.

**Create/edit modal price display**:
- Client has a package → show `"X zł za wizytę (z pakietu [Nazwa])"` as read-only info; `package_id` sent as hidden input
- Client has no package → show editable price input (optional but intended)

## Current State Analysis

- `appointments` table exists (`supabase/schema.sql:28-35`) with `id`, `trainer_id`, `client_id`, `starts_at`, `created_at`. Missing: `ends_at`, `notes`
- RLS is already enabled on `appointments` (`trainer_id = auth.uid()`)
- Index on `(trainer_id, starts_at)` already exists — covers the calendar fetch query
- Nav link `/calendar` is wired in `src/app/(app)/layout.tsx:11` and the dashboard card (`src/app/(app)/dashboard/page.tsx:24-29`) — page file does not exist yet
- Server action pattern: `src/app/actions/clients/index.ts` — `'use server'`, Zod validation, `prevState+formData`, `revalidatePath`
- Zod schema pattern: `src/app/actions/clients/schema.ts` — `nullish().transform()` for optional fields
- Unit test pattern: `src/app/actions/clients/clients.test.ts` — `vi.mock` + `buildQueryChain` + `setupMockSupabase`
- Component patterns: CVA + `cn()` + Radix UI `Dialog` — all reusable for modals
- No calendar library or `@internationalized/date` installed; Playwright not configured

## Desired End State

A working `/calendar` page where the trainer can:
1. View appointments in month, week, or day view and switch between them via a tab switcher
2. Click an empty day cell (month view) or time slot (week/day view) to open a pre-filled create modal
3. Create an appointment: pick client, date, start time, duration (30/60/90/120 min), optional notes
4. Click an existing appointment to open a detail modal showing the full client card (name, remaining sessions, interview notes, plan link) plus edit and delete actions
5. See the remaining session count on every event label (package.visit_count minus total appointments for that client)
6. On screens < 640px, the calendar auto-switches to day view

**Verification**: Playwright E2E test covers create → view in calendar → click event → confirm client card visible → delete.

### Key Discoveries:

- `appointments` table already exists — two separate migrations add the required columns (`ends_at`/`notes` in Phase 1; `package_id`/`price` added post-plan)
- Remaining sessions = `package.visit_count − COUNT(appointments WHERE package_id = package.id)` — one-off sessions (package_id null) are excluded
- The Supabase nested select supports joining `appointments → clients → packages` in one query
- Playwright is not yet configured — setup is part of Phase 6

## What We're NOT Doing

- No third-party calendar library (custom-built for full Tailwind v4 control and zero dependency risk)
- No drag-and-drop rescheduling of appointments
- No recurring appointments
- No AI assistant integration with calendar (separate feature)
- No client-facing calendar view
- No push notifications or email reminders

## Implementation Approach

Six phases in dependency order. Phases 2 and 3 can proceed in parallel once Phase 1 is done.

1. **DB migration** — unblocks all server-action work
2. **Server actions** — unblocks page data fetching; defines shared types
3. **Calendar UI components** — largest phase; independent of actions until Phase 5
4. **Appointment modals** — depends on actions (Phase 2) and the Dialog component
5. **Page assembly** — wires Phases 2–4 together into the live page
6. **Testing** — unit tests for actions + Playwright E2E for the full lifecycle

## Critical Implementation Details

**Week/day view event overlap positioning**: When two or more events overlap in time on the same day they must render side-by-side, not stacked. The algorithm in `utils/eventPositioning.ts`: sort events by `startsAt`; for each event, find the lowest column index not occupied by any concurrently-overlapping event; assign `left = column/totalCols * 100%` and `width = 1/totalCols * 100%`. Build and unit-test this utility before wiring it into `TimeGrid` — bugs here produce invisible or clipped events that are hard to diagnose in the browser.

**Slot click vs event click in the same grid**: Time-slot cells and event blocks share the same CSS grid area in the week/day view. The event block's `onClick` must call `e.stopPropagation()` to prevent the parent slot cell's `onClick` from also firing (which would open the create modal instead of the detail modal).

**Mobile view auto-switch**: Use `window.matchMedia('(max-width: 640px)')` in a `useEffect` on mount. The initial server render always outputs week view; the client-side `useEffect` replaces it with day view on mobile. Also add a resize listener so rotating the device switches views.

---

## Phase 1: Database Migration

### Overview

Two migrations add four new columns to `appointments`: `ends_at`, `notes`, `package_id`, and `price`.

### Changes Required:

#### 1. Migration: ends_at + notes

**File**: `supabase/migrations/20260601000001_add_appointment_ends_at_notes.sql` ✅ applied

**Contract**:
```sql
ALTER TABLE public.appointments
  ADD COLUMN ends_at timestamptz,
  ADD COLUMN notes   text;
UPDATE public.appointments SET ends_at = starts_at + interval '1 hour' WHERE ends_at IS NULL;
ALTER TABLE public.appointments ALTER COLUMN ends_at SET NOT NULL;
ALTER TABLE public.appointments ADD CONSTRAINT chk_ends_after_starts CHECK (ends_at > starts_at);
```

#### 2. Migration: package_id + price

**File**: `supabase/migrations/20260602000001_add_appointment_package_price.sql`

**Intent**: Link appointments to a specific package visit (null = one-off session) and capture an explicit price for sessions not covered by a package.

**Contract**:
```sql
ALTER TABLE public.appointments
  ADD COLUMN package_id uuid REFERENCES public.packages(id) ON DELETE SET NULL,
  ADD COLUMN price      numeric(10, 2);
```

#### 3. schema.sql update

**File**: `supabase/schema.sql`

**Intent**: Keep the canonical schema file in sync with both migrations.

**Contract**: `appointments` table now includes `package_id`, `ends_at`, `notes`, `price`, and the CHECK constraint.

### Success Criteria:

#### Automated Verification:

- Migration file contains both `ADD COLUMN` statements and the CHECK constraint

#### Manual Verification:

- `npx supabase db push` applies the migration without error
- Supabase Studio shows `ends_at` and `notes` columns on the `appointments` table
- Existing appointments (if any) have `ends_at = starts_at + 1 hour`

#### 3. Install @internationalized/date

**File**: `package.json`

**Intent**: Install the date arithmetic library in Phase 1 (not Phase 3) so it is available to both the Phase 2 server actions (for timezone-safe datetime construction) and the Phase 3 calendar components.

**Contract**: `npm install @internationalized/date` — adds the package to dependencies.

**Implementation Note**: After completing this phase and manual verification passes, pause for confirmation before proceeding to Phase 2.

---

## Phase 2: Appointment Server Actions

### Overview

Add server actions for appointment CRUD following the established clients pattern, and define the shared `CalendarEvent` type used by all subsequent phases.

### Changes Required:

#### 1. Zod schema

**File**: `src/app/actions/appointments/schema.ts`

**Intent**: Validate appointment form data submitted from the create/edit modal — client selection, date, start time, duration, and optional notes.

**Contract**: Export `appointmentSchema` with fields: `client_id` (required UUID), `package_id` (nullish → null, validated as UUID when present), `date` (non-empty string YYYY-MM-DD), `start_time` (non-empty string HH:MM), `duration` (enum literal `'30' | '60' | '90' | '120'`), `notes` (nullish → empty string), `price` (nullish → null, validated as numeric string when present), `tz` (non-empty string — IANA timezone identifier). Follow the existing pattern in `src/app/actions/clients/schema.ts`.

#### 2. Server actions

**File**: `src/app/actions/appointments/index.ts`

**Intent**: Provide three server actions for creating, updating, and deleting appointments, following the exact pattern of `src/app/actions/clients/index.ts`.

**Contract**:
- Export `AppointmentFormState` type: `{ errors: { client_id?: string[]; date?: string[]; start_time?: string[]; duration?: string[]; notes?: string[]; _form?: string[] } } | { success: true } | null`
- `createAppointmentAction(prevState, formData)`: parse → compute `starts_at` by converting the trainer's local time to UTC using the submitted `tz` (IANA timezone). Use `@internationalized/date`'s `ZonedDateTime` (available after Phase 3's install — move `npm install @internationalized/date` to Phase 1 so it is available here): construct the zoned datetime from `date`, `start_time`, and `tz`, then call `.toDate()` / convert to UTC via its epoch ms. `ends_at = new Date(starts_at.getTime() + Number(duration) * 60_000)`. Insert; `revalidatePath('/calendar')`. **Note:** `new Date(\`${date}T${start_time}\`)` without a timezone suffix creates UTC time on Cloudflare Workers, not local time — always use `tz` for the conversion.
- `updateAppointmentAction(id, prevState, formData)`: same parse, update with `eq('id', id).eq('trainer_id', user.id)` ownership check
- `deleteAppointmentAction(id): Promise<{ error?: string }>`: auth check → delete with ownership check; `revalidatePath('/calendar')`

#### 3. Shared calendar types

**File**: `src/app/(app)/calendar/types.ts`

**Intent**: Define the `CalendarEvent` shape that flows from the Server Component through calendar views and both modals, so every component agrees on the data contract.

**Contract**: Export `CalendarView`, `CalendarEvent`, and `ModalClient`:
```typescript
export type CalendarView = 'month' | 'week' | 'day'

export type CalendarEvent = {
  id: string
  clientId: string
  clientName: string
  startsAt: Date
  endsAt: Date
  notes: string | null
  remainingSessions: number | null   // null when client has no package or appointment is one-off
  packageName: string | null
  packageId: string | null
  price: number | null               // explicit price for one-off sessions
  client: { id: string; firstName: string; lastName: string; phone: string | null; email: string | null; interviewNotes: string | null; planUrl: string | null }
}

// Used by the create/edit modal to drive package_id + price display logic
export type ModalClient = {
  id: string; firstName: string; lastName: string
  packageId: string | null; packageName: string | null
  packagePrice: number | null; packageVisitCount: number | null
}
```

### Success Criteria:

#### Automated Verification:

- `npm run build` passes (all types check, no compile errors)
- `npm run lint` passes

#### Manual Verification:

- Zod schema rejects missing `client_id` and invalid `duration` values (verify via a quick test or console call)

**Implementation Note**: Unit tests for these actions are in Phase 6. Manual verification here is a smoke check only.

---

## Phase 3: Custom Calendar Components

### Overview

Build the full calendar UI: date utilities, event-positioning algorithm, month view, shared time grid, week and day views, navigation, and the top-level calendar container with mobile auto-switching.

### Changes Required:

#### 1. Date utilities  *(requires `@internationalized/date` installed in Phase 1)*

**File**: `src/app/(app)/calendar/utils/dates.ts`

**Intent**: Centralize all date arithmetic so view components contain only rendering logic.

**Contract**: Export:
- `getMonthGrid(month: CalendarDate): CalendarDate[][]` — 6 rows × 7 columns, padding with prev/next-month days to fill the grid
- `getWeekDays(date: CalendarDate): CalendarDate[]` — 7 days of the week containing `date`, Monday-first (Polish locale)
- `toJsDate(d: CalendarDate, hours?: number, minutes?: number): Date`
- `fromJsDate(d: Date): CalendarDate`
- `isSameDay(a: CalendarDate, b: CalendarDate): boolean`
- `getTimeSlots(): string[]` — `['06:00', '06:30', ..., '22:00']` (33 half-hour slots)
- `addDays(d: CalendarDate, n: number): CalendarDate`

#### 3. Event positioning utility

**File**: `src/app/(app)/calendar/utils/eventPositioning.ts`

**Intent**: Compute side-by-side column assignments for overlapping events so they render correctly in the time grid.

**Contract**: Export `positionEvents(events: CalendarEvent[]): PositionedEvent[]` where `PositionedEvent = CalendarEvent & { column: number; totalColumns: number }`. Algorithm: sort by `startsAt`; for each event, find the minimum column index not occupied by any already-processed event whose time interval overlaps the current event (`a.startsAt < b.endsAt && b.startsAt < a.endsAt`).

#### 4. Month view

**File**: `src/app/(app)/calendar/MonthView.tsx`

**Intent**: Render a 7-column month grid where each day cell is a button that emits `onSlotClick`, and each event chip emits `onEventClick` with `stopPropagation`.

**Contract**: Props `{ month: CalendarDate; events: CalendarEvent[]; today: CalendarDate; onSlotClick: (date: CalendarDate) => void; onEventClick: (event: CalendarEvent) => void }`. Render `grid grid-cols-7` with a weekday-header row (Mo–Su in Polish) + up to 6 week rows. Each day cell: `<button>` calling `onSlotClick`. Event chips inside call `e.stopPropagation()` then `onEventClick`. Chips use `bg-lobster-pink-100 text-lobster-pink-800` with a session-count badge (`bg-red-500` when `remainingSessions ≤ 2`). Days outside the current month are visually muted.

#### 5. Time grid (shared by week and day views)

**File**: `src/app/(app)/calendar/TimeGrid.tsx`

**Intent**: Scrollable time-slot grid with hour labels on the left and N day columns — shared component to avoid duplicating the positioning logic between WeekView and DayView.

**Contract**: Props `{ days: CalendarDate[]; events: CalendarEvent[]; today: CalendarDate; onSlotClick: (datetime: Date) => void; onEventClick: (event: CalendarEvent) => void }`. Structure: scrollable container (`overflow-y-auto max-h-[calc(100vh-220px)]`), left time-label column, then N day columns. Each 30-min slot cell is a `<button>` whose `onClick` computes the datetime from the day index + slot index and calls `onSlotClick`. Event blocks are absolutely positioned within their day column: `top = (minutesSince6am / 30) * slotHeightPx`, `height = durationMinutes / 30 * slotHeightPx`, `left/width` from `positionEvents`. Event block `onClick` calls `e.stopPropagation()` then `onEventClick`.

#### 6. Week view

**File**: `src/app/(app)/calendar/WeekView.tsx`

**Intent**: Thin wrapper that renders a day-of-week header row above `TimeGrid` with 7 days.

**Contract**: Props `{ week: CalendarDate; events: CalendarEvent[]; today: CalendarDate; onSlotClick; onEventClick }`. Computes `days = getWeekDays(week)` and renders a day-header row (day name + date number) above `<TimeGrid days={days} ... />`.

#### 7. Day view

**File**: `src/app/(app)/calendar/DayView.tsx`

**Intent**: Single-column time grid — wraps TimeGrid with one day.

**Contract**: Props `{ day: CalendarDate; events: CalendarEvent[]; today: CalendarDate; onSlotClick; onEventClick }`. Passes `days={[day]}` to `<TimeGrid />` with a single-day header.

#### 8. Navigation and view switcher

**File**: `src/app/(app)/calendar/CalendarNav.tsx`

**Intent**: Toolbar with month/week/day tabs, and prev/next/today buttons, and a current-period label.

**Contract**: Props `{ view: CalendarView; currentDate: CalendarDate; onViewChange; onNavigate: (dir: 'prev' | 'next' | 'today') => void }`. Uses existing `Button` component. Period label: month → `"Czerwiec 2026"`, week → `"26 maj – 1 cze 2026"`, day → `"1 czerwca 2026"` (Polish locale via `Intl.DateTimeFormat`).

#### 9. Calendar container

**File**: `src/app/(app)/calendar/CalendarView.tsx`

**Intent**: State owner for `currentDate` and `view`; manages mobile auto-switching; renders `CalendarNav` plus the appropriate view component.

**Contract**: `"use client"`. Props `{ events: CalendarEvent[]; onSlotClick: (date: Date) => void; onEventClick: (event: CalendarEvent) => void }`. State: `view: CalendarView` (initial `'week'`), `currentDate: CalendarDate` (initial `today(getLocalTimeZone())`). `useEffect` on mount: if `window.matchMedia('(max-width: 640px)').matches` → set view to `'day'`; add a listener to react to resize. Navigation: prev/next advances `currentDate` by 1 month / 1 week / 1 day based on `view`; today resets to `today(getLocalTimeZone())`. Filters `events` to the visible range before passing to the view component.

### Success Criteria:

#### Automated Verification:

- `npm run build` passes with no TypeScript errors
- `npm run lint` passes

#### Manual Verification:

- Calendar renders without crashing with an empty events array
- Month/week/day views display correctly with correct day labels
- Prev/next/today navigation moves the calendar date
- Mobile viewport (`<640px`) auto-shows day view on mount
- Clicking an empty slot triggers `onSlotClick` (verify via console.log)
- Clicking an event chip/block triggers `onEventClick` and does not also trigger `onSlotClick`

**Implementation Note**: Build and manually test `positionEvents` with 2–3 hardcoded overlapping events before wiring it into `TimeGrid`.

---

## Phase 4: Appointment Modals

### Overview

Two `Dialog`-based modals: the create modal (pre-filled from slot click) and the detail/edit/delete modal (opened from event click, covering FR-012 and FR-013).

### Changes Required:

#### 1. Create appointment modal

**File**: `src/app/(app)/calendar/CreateAppointmentModal.tsx`

**Intent**: Allow the trainer to create an appointment with the clicked date/time pre-filled, picking a client and duration from dropdowns.

**Contract**: Props `{ open: boolean; onOpenChange: (v: boolean) => void; prefillDate: Date | null; clients: ModalClient[] }`. Uses existing `Dialog`, `Input`, `Select`, `Textarea`, `Button`, `Label`. Fields: client `Select` (sorted A–Z, required — shows error if empty on submit), date `Input type="date"` (pre-filled from `prefillDate`), start time `Input type="time"` (pre-filled to nearest 30-min boundary if `prefillDate` has a time component, otherwise blank), duration `Select` with options `30 / 60 / 90 / 120 minut`, notes `Textarea` (optional), `<input type="hidden" name="tz" />` with value initialised via `useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone)`.

**Price / package display** (driven by selected client):
- Client has a `packageId` → render `<input type="hidden" name="package_id" value={packageId} />` and a read-only info line: `"X,XX zł za wizytę (z pakietu [Nazwa])"` where X,XX = `packagePrice / packageVisitCount`
- Client has no `packageId` → render `<Input type="number" name="price" />` (optional, for recording the one-off fee); no hidden `package_id` field (field absent = null in action)

Wires `useActionState(createAppointmentAction, null)`. Calls `onOpenChange(false)` when response is `{ success: true }`.

#### 2. Appointment detail/edit/delete modal

**File**: `src/app/(app)/calendar/AppointmentDetailModal.tsx`

**Intent**: Show the full client card for a clicked appointment (FR-012) and provide inline edit and delete capability (FR-013).

**Contract**: Props `{ open: boolean; onOpenChange: (v: boolean) => void; event: CalendarEvent | null }`. Two internal display modes via local state: `'detail'` and `'edit'`. Detail mode renders: client name (`h2`), package name + remaining sessions badge (red `bg-red-500 text-white` when `≤ 2`), interview notes (full text, scrollable), plan URL link (opens new tab via `target="_blank"`), appointment date + time range. Edit mode renders the same form as `CreateAppointmentModal` pre-filled with the event's data (including the hidden `tz` field), wired to `updateAppointmentAction(event.id, ...)`. Delete: a local `showDeleteConfirm: boolean` state toggles an inline "Czy na pewno usunąć wizytę? [Anuluj] [Usuń]" section rendered inside the existing Dialog using standard `Button` components — no nested `AlertDialog`. Confirming calls `deleteAppointmentAction(event.id)`, then `onOpenChange(false)`. **Rationale**: nesting Radix `AlertDialog` inside Radix `Dialog` causes the outer Dialog's `hideOthers` to mark the AlertDialog portal as `aria-hidden`, blocking accessibility and pointer events.

### Success Criteria:

#### Automated Verification:

- `npm run build` passes
- `npm run lint` passes

#### Manual Verification:

- Clicking a slot opens create modal with date pre-filled (and time pre-filled for week/day view)
- Submitting valid create form creates the appointment and it appears in the calendar
- Missing client field shows inline error, does not submit
- Clicking an event opens detail modal showing correct client name and remaining sessions count
- Edit mode pre-fills all fields; successful update reflects in the calendar
- Delete confirmation dialog appears; confirming removes the event from the calendar

---

## Phase 5: Calendar Page Assembly

### Overview

Wire the server-side Supabase fetch and the client-side state container into the final `/calendar` page.

### Changes Required:

#### 1. Calendar page — Server Component

**File**: `src/app/(app)/calendar/page.tsx`

**Intent**: Fetch all appointments with nested client + package data, compute remaining sessions per client in TypeScript, and pass the event list and client list down to the Client Component.

**Contract**: Async Server Component — no `"use client"`. Two Supabase queries:
1. Appointments + nested client + package:
   ```
   .from('appointments')
   .select('id, client_id, starts_at, ends_at, notes, clients(id, first_name, last_name, phone, email, interview_notes, plan_url, package_id, packages(id, name, visit_count))')
   .eq('trainer_id', user.id)
   .order('starts_at')
   ```
2. Clients for the create-modal dropdown:
   ```
   .from('clients').select('id, first_name, last_name').eq('trainer_id', user.id).order('first_name')
   ```

Compute `sessionCountByPackageId` in TypeScript: `reduce` over appointments counting only those where `package_id` is non-null, keyed by `package_id`. Derive `remainingSessions = package.visit_count - sessionCountByPackageId[package_id]` per appointment — one-off sessions (package_id null) yield `remainingSessions: null`. Map to `CalendarEvent[]`.

Clients query for the create-modal dropdown must include package fields so the modal can show price info:
```
.from('clients').select('id, first_name, last_name, package_id, packages(id, name, price, visit_count)').eq('trainer_id', user.id).order('first_name')
```
Map to `ModalClient[]`. Wrap in `<div className="mx-auto max-w-5xl px-4 py-8">` (matching layout of other pages). **Remaining sessions interpretation**: all appointments (past and future) count against the package — a booked session is a used session. If the requirement changes to count only completed sessions, add `.lte('starts_at', new Date().toISOString())` to the sessionCount query.

#### 2. Calendar client section

**File**: `src/app/(app)/calendar/CalendarClientSection.tsx`

**Intent**: `"use client"` state owner that holds modal visibility + selected event state, and connects `CalendarView`'s slot/event callbacks to the two modals.

**Contract**: Props `{ events: CalendarEvent[]; clients: { id: string; firstName: string; lastName: string }[] }`. State: `createModal: { open: boolean; prefillDate: Date | null }` and `detailModal: { open: boolean; event: CalendarEvent | null }`. Renders `<CalendarView onSlotClick={d => setCreateModal({ open: true, prefillDate: d })} onEventClick={e => setDetailModal({ open: true, event: e })} />`, `<CreateAppointmentModal />`, `<AppointmentDetailModal />`.

### Success Criteria:

#### Automated Verification:

- `npm run build` (full production build) succeeds with no errors
- `npm run lint` passes
- `npx tsc --noEmit` passes

#### Manual Verification:

- `/calendar` renders with real appointment data from Supabase
- Full flow works end-to-end: create → appears in calendar → click → client card visible → edit → updated → delete → gone
- Remaining sessions count is correct (matches `package.visit_count - appointment count for that client`)
- Mobile viewport auto-shows day view

---

## Phase 6: Testing

### Overview

Vitest unit tests for the three server actions (following the established `clients.test.ts` pattern), plus Playwright setup and one E2E test covering the full appointment lifecycle.

### Changes Required:

#### 1. Appointment unit tests

**File**: `src/app/actions/appointments/appointments.test.ts`

**Intent**: Verify the three server actions handle valid input, Zod validation errors, auth failures, and Supabase errors — following the exact pattern of `src/app/actions/clients/clients.test.ts`.

**Contract**: Three `describe` blocks:
- `appointmentSchema` — valid full input, valid with blank notes, missing `client_id`, invalid `duration` value
- `createAppointmentAction` — success (inserts with `trainer_id` and correctly computed `ends_at`), Zod error (no Supabase call), auth error, Supabase error (no `revalidatePath`)
- `updateAppointmentAction` — success with ownership check (`eq('id', id)` + `eq('trainer_id', userId)`), Zod error, auth error
- `deleteAppointmentAction` — success + `revalidatePath`, auth error (returns early without DB call)

Use the same `buildQueryChain` / `setupMockSupabase` helpers — copy and adapt from `src/app/actions/clients/clients.test.ts`.

#### 2. Playwright setup

**Files**: `playwright.config.ts`, `playwright/auth.setup.ts`, `playwright/.auth/` (gitignored)

**Intent**: Configure Playwright to run against the local dev server and authenticate via saved `storageState` so individual tests don't log in through the UI.

**Contract**:
- Install: `npm install --save-dev @playwright/test` + `npx playwright install chromium`
- `playwright.config.ts`: `baseURL: 'http://localhost:3000'`, a `setup` project running `playwright/auth.setup.ts`, authenticated tests declare `dependencies: ['setup']` and `storageState: 'playwright/.auth/user.json'`
- Add `playwright/.auth/` to `.gitignore`
- `playwright/auth.setup.ts`: navigate to `/login`, fill `PLAYWRIGHT_TEST_EMAIL` and `PLAYWRIGHT_TEST_PASSWORD` from env, submit, wait for redirect to `/dashboard`, save `storageState` to `playwright/.auth/user.json`
- Add `PLAYWRIGHT_TEST_EMAIL` and `PLAYWRIGHT_TEST_PASSWORD` to `.env.example` (values blank)

#### 3. Appointment lifecycle E2E test

**File**: `playwright/calendar.spec.ts`

**Intent**: Prove that appointment data survives the full create → view → click → delete cycle through the real UI and Supabase — the risk that a unit test cannot cover because it crosses multiple system boundaries.

**Contract**: Single test named `'appointment data persists and client card shows correct remaining sessions after create'`. Use a `const testId = \`test-\${Date.now()}\`` unique identifier set as the appointment notes — this distinguishes the test appointment from any pre-existing ones. Steps: `page.goto('/calendar')`, switch to week view (`getByRole('button', { name: 'Tydzień' })`), click a time slot, fill create modal via `getByLabel` locators (client select, date, start time, duration, notes = testId), submit, assert `getByText(testId)` appears in the calendar grid, click the event block, assert the detail modal shows `getByText(clientName)` and `getByText(/\d+ wizyt/)`, click delete (inline confirm, not AlertDialog), confirm, assert `getByText(testId)` is no longer in the grid. Add an `afterEach` hook: navigate to `/calendar`, search for `getByText(testId)`, click and delete if still present — ensures cleanup even if the test fails mid-way. Use `getByRole` and `getByLabel` throughout — no CSS selectors.

### Success Criteria:

#### Automated Verification:

- `npm run test` passes all unit tests including `appointments.test.ts`
- `npx playwright test` passes `calendar.spec.ts` against the local dev server

#### Manual Verification:

- Each test name clearly describes the risk it covers, not the implementation step
- E2E test failure output identifies which specific step failed (create, view, click, or delete)

---

---

## Phase 7: Overlap Guard + Appointment Status

### Overview

Two requirements added after initial implementation: (1) prevent the trainer from double-booking the same time slot; (2) track appointment attendance state so the trainer knows whether to collect payment.

### Changes Required:

#### 1. Migration — status column

**File**: `supabase/migrations/20260603000001_add_appointment_status.sql`

**Contract**:
```sql
ALTER TABLE public.appointments
  ADD COLUMN status text NOT NULL DEFAULT 'scheduled'
    CONSTRAINT appointments_status_check
      CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show'));
```

#### 2. schema.sql update

**File**: `supabase/schema.sql` — add `status` column to the `appointments` table definition.

#### 3. Types — AppointmentStatus + CalendarEvent.status

**File**: `src/app/(app)/calendar/types.ts`

**Contract**: Export `AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'`; add `status: AppointmentStatus` field to `CalendarEvent`.

#### 4. Server actions — overlap check + status action

**File**: `src/app/actions/appointments/index.ts`

**Contract**:
- `createAppointmentAction`: after computing `startsAt`/`endsAt`, query for overlapping appointments (`starts_at < endsAt AND ends_at > startsAt AND trainer_id = user.id`); return `_form` error if count > 0.
- `updateAppointmentAction`: same overlap query but exclude the current appointment with `.neq('id', id)`.
- New `updateAppointmentStatusAction(id, status)`: auth check → update `{ status }` with ownership check; `revalidatePath('/calendar')`.

#### 5. Page — fetch + map status

**File**: `src/app/(app)/calendar/page.tsx` — add `status` to the Supabase select and map it to `CalendarEvent.status`.

#### 6. AppointmentDetailModal — status badge + quick-change buttons

**File**: `src/app/(app)/calendar/AppointmentDetailModal.tsx`

**Contract**: In detail view, show a `StatusBadge` and a row of pill buttons for every status except the current one. Clicking calls `updateAppointmentStatusAction` via `useTransition`; on success update local state. Status labels (Polish): scheduled → "Zaplanowana", completed → "Odbyła się", cancelled → "Anulowana", no_show → "Nieobecność".

#### 7. MonthView + TimeGrid — status visual

**Files**: `src/app/(app)/calendar/MonthView.tsx`, `src/app/(app)/calendar/TimeGrid.tsx`

**Contract**: cancelled/no_show → muted chip with opacity-60, cancelled adds line-through on client name; completed → green tint; scheduled → original colour scheme.

### Success Criteria:

#### Automated Verification:

- `npm run build` passes (no TypeScript errors)
- `npm run lint` passes

#### Manual Verification:

- `npx supabase db push` applies the status migration without error
- Creating a second appointment that overlaps an existing one shows the error "Masz już wizytę w tym przedziale czasowym"
- Editing an appointment to overlap another shows the same error; editing the same appointment's time without conflict succeeds
- Clicking an appointment opens the detail modal showing the current status badge
- Status change buttons exclude the current status; clicking one updates the badge and calendar chip colour immediately
- Cancelled appointments appear muted with strikethrough in both month and time-grid views

---

## Testing Strategy

### Unit Tests:

- Zod schema: valid full input, valid with blank notes, missing `client_id`, invalid `duration` enum value
- `createAppointmentAction`: success path + `ends_at` computation, Zod error, auth error, Supabase insert error
- `updateAppointmentAction`: success + ownership check, Zod error, auth error
- `deleteAppointmentAction`: success, auth error (returns early)

### Integration Tests:

- Playwright E2E: create appointment → appear in calendar → click event → client card in modal → delete → gone

### Manual Testing Steps:

1. Create appointment via empty cell click in month view (only date pre-filled; manually enter time)
2. Create appointment via time-slot click in week view (date + time pre-filled to that slot)
3. Add a second appointment for the same client; verify remaining sessions counter decrements by 1
4. Add appointments until remaining sessions ≤ 2; verify the badge turns red
5. Edit appointment time; verify the event moves to the new time slot
6. Test on a mobile-size viewport (375px); verify day view activates automatically

## Performance Considerations

The page-load query fetches all appointments for the trainer without pagination. For a solo trainer with 5–20 active clients and weekly sessions this is realistically 50–200 rows — well within Supabase's response limits. The existing index on `(trainer_id, starts_at)` covers this query efficiently. No caching strategy is needed at this scale.

## Migration Notes

The migration adds `ends_at` with a `DEFAULT`, so existing appointment rows are safe — they receive `starts_at + 1 hour` automatically. PostgreSQL validates existing rows when the CHECK constraint is added (`ALTER TABLE ADD CONSTRAINT CHECK` without `NOT VALID` always runs a full table scan). This succeeds here because all existing appointments already satisfy `ends_at > starts_at` via the DEFAULT.

## References

- Research doc: `context/changes/calendar-appointments/research.md`
- Existing appointments schema: `supabase/schema.sql:28-35`
- Server action pattern: `src/app/actions/clients/index.ts`
- Zod schema pattern: `src/app/actions/clients/schema.ts`
- Unit test pattern: `src/app/actions/clients/clients.test.ts`
- Layout pattern: `src/app/(app)/clients/page.tsx`
- Client section pattern: `src/app/(app)/clients/ClientsClientSection.tsx`
- Dialog component: `src/components/ui/dialog.tsx`
- Tailwind v4 color tokens: `src/app/globals.css`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Database Migration

#### Automated

- [x] 1.1 Migration file contains both ADD COLUMN statements and CHECK constraint

#### Manual

- [ ] 1.2 `npx supabase db push` applies migration without error
- [ ] 1.3 Supabase Studio shows `ends_at` and `notes` columns on appointments table
- [ ] 1.4 Existing appointments have `ends_at = starts_at + 1 hour`

### Phase 2: Appointment Server Actions

#### Automated

- [x] 2.1 `npm run build` passes — all types check
- [x] 2.2 `npm run lint` passes

#### Manual

- [ ] 2.3 Zod schema rejects missing `client_id` and invalid `duration` values

### Phase 3: Custom Calendar Components

#### Automated

- [x] 3.1 `npm run build` passes with no TypeScript errors
- [x] 3.2 `npm run lint` passes

#### Manual

- [ ] 3.3 Calendar renders without crashing with an empty events array
- [ ] 3.4 Month/week/day views display correctly with correct day labels
- [ ] 3.5 Prev/next/today navigation moves the calendar date
- [ ] 3.6 Mobile viewport (`<640px`) auto-shows day view on mount
- [ ] 3.7 Slot click and event click handlers fire correctly (no cross-firing)

### Phase 4: Appointment Modals

#### Automated

- [x] 4.1 `npm run build` passes
- [x] 4.2 `npm run lint` passes

#### Manual

- [ ] 4.3 Slot click opens create modal with date pre-filled
- [ ] 4.4 Creating appointment via modal works end-to-end; event appears in calendar
- [ ] 4.5 Missing client field shows inline error; does not submit
- [ ] 4.6 Event click opens detail modal with correct client name and remaining sessions
- [ ] 4.7 Edit mode pre-fills all fields; successful update reflects in the calendar
- [ ] 4.8 Delete confirmation removes the event from the calendar

### Phase 5: Calendar Page Assembly

#### Automated

- [x] 5.1 `npm run build` (full production build) succeeds — 0a786c6
- [x] 5.2 `npm run lint` passes — 0a786c6
- [x] 5.3 `npx tsc --noEmit` passes — 0a786c6

#### Manual

- [ ] 5.4 `/calendar` renders with real appointment data from Supabase
- [ ] 5.5 Full create → view → click → edit → delete flow works without page reload
- [ ] 5.6 Remaining sessions count matches `package.visit_count - appointment count`
- [ ] 5.7 Mobile viewport (`<640px`) auto-shows day view

### Phase 6: Testing

#### Automated

- [ ] 6.1 `npm run test` passes all unit tests including `appointments.test.ts`
- [ ] 6.2 `npx playwright test` passes `calendar.spec.ts`

#### Manual

- [ ] 6.3 Each test name clearly describes the risk it covers
- [ ] 6.4 E2E test failure output identifies which specific step failed

### Phase 7: Overlap Guard + Appointment Status

#### Automated

- [x] 7.1 `npm run build` passes (no TypeScript errors)
- [x] 7.2 `npm run lint` passes

#### Manual

- [ ] 7.3 `npx supabase db push` applies status migration without error
- [ ] 7.4 Creating an overlapping appointment shows the conflict error message
- [ ] 7.5 Editing an appointment to overlap another also shows the conflict error
- [ ] 7.6 Status badge and quick-change buttons work correctly in the detail modal
- [ ] 7.7 Calendar chips show correct visual state for all four statuses
