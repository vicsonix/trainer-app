# Client Card Session View — Plan Brief

> Full plan: `context/changes/client-card-session-view/plan.md`
> Research: `context/changes/client-card-session-view/research.md`

## What & Why

S-05 closes the north-star user story US-01: a trainer opens the app on their phone five minutes before a session, taps an appointment, and immediately sees the full client card. S-04 already built the core of this; S-05 delivers the two remaining improvements — visible session counts on every calendar chip and a proper mobile bottom-sheet layout for the detail modal.

## Starting Point

`AppointmentDetailModal` already shows the full client card (package, remaining sessions, interview notes, plan link). Calendar chips show a ≤2 warning badge but no count for well-stocked packages. The Dialog is centred on all viewports, which is not ideal for a phone-first use case.

## Desired End State

Every scheduled event chip shows the remaining-sessions count regardless of how many remain (red when ≤2, neutral otherwise). Tapping an event on mobile opens the detail modal as a bottom sheet that slides up, fills the screen width, and is scrollable — no new dependencies added. Desktop behaviour is unchanged.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Training goals field | Consolidate into `interview_notes` | S-03 already built one field with goals in the placeholder; no schema change needed | Research |
| Chip badge threshold | Show count on all scheduled events | Trainer needs to see remaining sessions at a glance, not just a last-minute warning | User |
| Mobile modal pattern | CSS-only sheet variant (no vaul) | Project builds UI from scratch (custom calendar, no lib); swipe-to-dismiss not required | User + Research |
| Bottom-sheet implementation | `variant="sheet"` on `dialog.tsx` | Reuses existing Radix Dialog primitive; zero new dependencies | Plan |

## Scope

**In scope:**
- Remove ≤2 gate from chip badge in `MonthView.tsx` and `TimeGrid.tsx`
- Two-colour badge: red ≤2, neutral >2
- `variant="sheet"` prop on `DialogContent` in `dialog.tsx`
- `AppointmentDetailModal` opts in to `variant="sheet"`

**Out of scope:**
- `training_goals` DB column or form field
- Swipe-to-dismiss gesture
- Changes to create-appointment modal
- Changes to any other Dialog caller

## Architecture / Approach

Phase 1 is a two-file condition removal (MonthView + TimeGrid). Phase 2 adds a `variant` prop to the local `dialog.tsx` wrapper and uses `max-sm:` Tailwind breakpoints to apply bottom-anchoring, full-width, and slide-from-bottom animation — only the appointment detail modal opts in. No Radix internals are touched.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Session count badge | Badge on all chips, two colour tiers | Colour choice must match `AppointmentDetailModal` badge colours for consistency |
| 2. Mobile bottom-sheet | Sheet layout on `< 640px` | Tailwind `max-sm:` overrides must win over the centring transforms set in base DialogContent classes |

**Prerequisites:** S-04 complete (done) · `src/components/ui/dialog.tsx` exists (confirmed)  
**Estimated effort:** ~1 short session across 2 phases

## Open Risks & Assumptions

- The `max-sm:!translate-x-0 max-sm:!translate-y-0` important modifiers may be needed to override the base Dialog centering transforms — implementer should verify actual base classes in `dialog.tsx` before writing the variant.
- `bg-jungle-teal-500` is suggested for the neutral badge colour; implementer should cross-check with `AppointmentDetailModal.tsx:276–280` and use matching classes.

## Success Criteria (Summary)

- All scheduled chips show a session count (not just ≤2 warnings)
- Tapping an event on a 375px viewport shows a bottom sheet; desktop shows a centred modal
- `npm run build` and `npm run lint` pass with zero errors
