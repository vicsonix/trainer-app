# Client Card Session View — Implementation Plan

## Overview

S-05 is almost entirely delivered by S-04's AppointmentDetailModal. This plan covers the two remaining improvements the team decided on: (1) show the remaining-sessions badge on **all** calendar chips (not just the ≤2 warning), and (2) add a **mobile bottom-sheet** layout to the appointment detail modal, which is the primary S-05 UX surface (US-01 is a phone-before-session use case).

No database changes. No new dependencies. No new server actions.

## Current State Analysis

- `AppointmentDetailModal.tsx` already renders the full client card: client name, package, remaining sessions with ≤2 red badge, interview notes (which covers training goals per team decision), plan link, status badge, edit/delete.
- Calendar chips (`MonthView.tsx:139–143`, `TimeGrid.tsx:200–204`) show the remaining-sessions badge **only** when `remainingSessions <= 2 && status === 'scheduled'`. Sessions with more than 2 remaining show no count at all.
- `AppointmentDetailModal` renders as a Radix UI Dialog (via `src/components/ui/dialog.tsx`) — centred on all viewport sizes. No sheet/drawer primitive exists in the project.

## Desired End State

1. Every scheduled appointment chip in month view and time grid shows the remaining-sessions count — red badge when ≤2, neutral badge when >2.
2. Tapping an appointment on a mobile device (`< 640px`) opens the detail modal as a bottom sheet that slides up from the bottom, fills the screen width, and is scrollable. Desktop behaviour is unchanged.

### Key Discoveries

- `MonthView.tsx:139–143` and `TimeGrid.tsx:200–204` — both have the `remainingSessions <= 2` threshold in the badge visibility condition. TimeGrid also has a height gate (`height > SLOT_HEIGHT * 1.5`) that should stay.
- `src/components/ui/dialog.tsx` — local shadcn wrapper around Radix UI Dialog; accepts a `className` prop on `DialogContent` and can be extended with a `variant` prop without touching Radix internals.
- Colour palette (from `lessons.md`): red warning = existing `bg-red-500`; neutral count → use `bg-jungle-teal-500 text-white` (jungle teal is the project's secondary/success accent).
- `AppointmentDetailModal.tsx` already constrains content in a scrollable area — the mobile sheet just needs to reposition and cap height.

## What We're NOT Doing

- No `training_goals` DB column — `interview_notes` covers both (team decision, S-03 design).
- No swipe-to-dismiss gesture — CSS-only bottom sheet, no vaul or new dependency.
- No changes to the create-appointment modal.
- No changes to the chip rendering for `cancelled` / `no_show` / `completed` events — badge stays off for those statuses (existing logic).
- No changes to `CalendarEvent` types or server actions.

## Implementation Approach

Two small, independent phases. Phase 1 is a two-file condition removal. Phase 2 adds a `variant` prop to `dialog.tsx` and uses it in `AppointmentDetailModal`. Either phase can be reviewed standalone.

## Critical Implementation Details

**Sheet variant animation**: The existing `DialogContent` applies `slide-in-from-top` and `slide-out-to-top` animations via Tailwind `data-[state]` utilities. The sheet variant must override these with `slide-in-from-bottom` / `slide-out-to-bottom` at `max-sm`. Tailwind's `max-sm:` breakpoint (`@media (max-width: 639px)`) is the correct prefix for "mobile only". Also override the `translate-x-[-50%] translate-y-[-50%]` centering transforms which conflict with bottom-anchored positioning.

**Badge colour consistency**: `AppointmentDetailModal.tsx` already uses `bg-blue-100 text-blue-800` for the >2 session count in the modal. The chip badge should use a similar neutral tone — check the exact classes used in the modal (around line 276) and mirror them for the >2 chip badge so the language is consistent.

---

## Phase 1: Session Count Badge on All Chips

### Overview

Remove the `remainingSessions <= 2` threshold from both MonthView and TimeGrid badge visibility checks so every scheduled appointment shows its session count.

### Changes Required:

#### 1. Month view chip badge

**File**: `src/app/(app)/calendar/MonthView.tsx`

**Intent**: Show remaining-sessions badge on every scheduled event, not just those at the ≤2 warning threshold. The ≤2 red style stays; >2 gets a neutral colour.

**Contract**: In the badge visibility condition (around line 139), remove the `remainingSessions <= 2` predicate. Keep `remainingSessions !== null` and `status === 'scheduled'`. Apply two colour variants: `bg-red-500 text-white` when `remainingSessions <= 2`, neutral (matching the `>2` style used in `AppointmentDetailModal.tsx:276–280`) when `> 2`.

#### 2. Time-grid card badge

**File**: `src/app/(app)/calendar/TimeGrid.tsx`

**Intent**: Same change as MonthView for the week/day view event cards.

**Contract**: In the badge condition (around line 200), remove `remainingSessions <= 2`. Keep `remainingSessions !== null` and the height gate (`height > SLOT_HEIGHT * 1.5`). Apply the same two-colour logic as above.

### Success Criteria:

#### Automated Verification:

- `npm run build` passes with no TypeScript errors
- `npm run lint` passes (0 errors)

#### Manual Verification:

- A scheduled event with >2 remaining sessions shows a neutral badge with the count on the chip in both month and week/day views
- A scheduled event with ≤2 remaining shows the existing red badge
- Cancelled, no-show, and completed events show no badge (behaviour unchanged)
- In week/day view, a short event card (30 min) does not show the badge; a 60-min card does

---

## Phase 2: Mobile Bottom-Sheet for Appointment Detail Modal

### Overview

Make `AppointmentDetailModal` render as a bottom sheet on mobile viewports (`< 640px`) by extending `DialogContent` with a `variant="sheet"` option, then opting the modal into it.

### Changes Required:

#### 1. Dialog component — sheet variant

**File**: `src/components/ui/dialog.tsx`

**Intent**: Add a `"sheet"` variant to `DialogContent` so any modal can opt into mobile-bottom-sheet positioning without touching Radix internals or adding dependencies.

**Contract**: Add a `variant?: "default" | "sheet"` prop to `DialogContent` (default: `"default"`). When `"sheet"`:
- At `max-sm` breakpoint: anchor to `bottom-0 left-0 right-0`, `w-full`, `max-w-full`, `rounded-t-2xl rounded-b-none`, `max-h-[90dvh] overflow-y-auto`. Override the centering transforms (`translate-x-[-50%] translate-y-[-50%]`) and the `left-[50%] top-[50%]` positioning. Override default slide animations with `slide-in-from-bottom` (open) and `slide-out-to-bottom` (close).
- At `sm+`: identical to `"default"` — centred dialog, `max-w-lg`, `rounded-lg`.

Use Tailwind `max-sm:` prefixes to scope all overrides to mobile only. The `"default"` variant emits no additional classes (zero behaviour change for existing callers).

#### 2. Appointment detail modal — opt in

**File**: `src/app/(app)/calendar/AppointmentDetailModal.tsx`

**Intent**: Use the new sheet variant so the modal renders as a bottom sheet on mobile.

**Contract**: Add `variant="sheet"` to the `DialogContent` element. No other changes to content, logic, or props.

### Success Criteria:

#### Automated Verification:

- `npm run build` passes with no TypeScript errors
- `npm run lint` passes (0 errors)

#### Manual Verification:

- On a 375px-wide viewport (phone): tapping an event opens the modal as a bottom sheet that slides up from the bottom, fills the screen width, has rounded top corners, and is scrollable when content overflows
- Tapping the backdrop or pressing Escape dismisses the sheet
- On desktop (1024px): modal appears centred as before — no visual change
- All modal interactions (view detail, switch to edit, delete confirmation, status change buttons) work identically on both viewports

---

## Testing Strategy

### Unit Tests:

None required — no new logic, no new actions, no schema changes.

### Manual Testing Steps:

1. Open `/calendar` in a desktop browser. Verify all scheduled events show the sessions badge (not just those with ≤2). Verify red for ≤2, neutral for >2.
2. Switch to week view. Click an event with a tall card (60+ min). Verify badge appears. Click a 30-min event. Verify badge is hidden on the short card.
3. Resize browser to 375px width. Click an event. Verify the modal slides up from the bottom as a sheet.
4. On the mobile sheet: scroll through the content, tap backdrop to dismiss, tap the event again, use edit and delete to confirm all interactions still work.
5. Resize back to desktop. Verify modal still centred.

## Performance Considerations

No performance impact — the changes are purely presentational (CSS class logic, no new data fetching or computation).

## References

- Research doc: `context/changes/client-card-session-view/research.md`
- Month view badge: `src/app/(app)/calendar/MonthView.tsx:139–143`
- Time grid badge: `src/app/(app)/calendar/TimeGrid.tsx:200–204`
- Dialog component: `src/components/ui/dialog.tsx`
- Appointment detail modal: `src/app/(app)/calendar/AppointmentDetailModal.tsx:268–306`
- Colour palette: `context/foundation/lessons.md` (Jungle Teal for neutral accent)

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Session Count Badge on All Chips

#### Automated

- [x] 1.1 `npm run build` passes with no TypeScript errors — 78f6cc9
- [x] 1.2 `npm run lint` passes (0 errors; 2 pre-existing warnings unrelated to this change) — 78f6cc9

#### Manual

- [ ] 1.3 Scheduled events with >2 sessions show neutral badge; ≤2 show red badge
- [ ] 1.4 Cancelled/no-show/completed events show no badge
- [ ] 1.5 Short cards (30 min) in time-grid hide the badge; 60-min cards show it

### Phase 2: Mobile Bottom-Sheet for Appointment Detail Modal

#### Automated

- [x] 2.1 `npm run build` passes with no TypeScript errors — 9c7b83e
- [x] 2.2 `npm run lint` passes — 9c7b83e

#### Manual

- [x] 2.3 Mobile viewport (375px): modal slides up as bottom sheet with rounded top corners — 9c7b83e
- [x] 2.4 Backdrop tap and Escape both dismiss the sheet — 9c7b83e
- [x] 2.5 Desktop viewport: modal remains centred, no visual change — 9c7b83e
- [x] 2.6 All modal interactions (edit, delete, status change) work on both viewports — 9c7b83e
