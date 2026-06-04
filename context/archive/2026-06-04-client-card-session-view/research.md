---
date: 2026-06-04T13:20:00+00:00
researcher: Claude Sonnet 4.6
git_commit: ac014a473d5d6e6877d69b89fc5aa94e6f34bf84
branch: feature/calendar-appointments
repository: trainer-app
topic: "What is already implemented for S-05 (client-card-session-view)"
tags: [research, codebase, calendar, client-card, appointments, s-05]
status: complete
last_updated: 2026-06-04
last_updated_by: Claude Sonnet 4.6
---

# Research: What is already implemented for S-05 (client-card-session-view)

**Date**: 2026-06-04  
**Git Commit**: ac014a473d5d6e6877d69b89fc5aa94e6f34bf84  
**Branch**: feature/calendar-appointments  
**Repository**: trainer-app

## Research Question

Check what is already implemented for the `client-card-session-view` change (S-05).

## Summary

**S-05 is almost entirely implemented by S-04's AppointmentDetailModal.** Every hard requirement from FR-012, FR-014, and US-01 is satisfied with one nuance: the PRD's US-01 lists "training goals" (cele treningowe) and "interview notes" (notatki z wywiadu) as separate items, but the database was designed with a single `interview_notes` field whose placeholder text explicitly includes goals ("Cele, ograniczenia, historia zdrowotna…"). Whether to add a separate `training_goals` column is the one open decision.

**Remaining sessions on calendar chips** (the second half of FR-014) is also done — both MonthView and TimeGrid show a badge when `remainingSessions ≤ 2`.

**NFR: 2-second load on mobile** — data is fetched server-side with the page (no separate request on tap), so this should be met without additional work.

## Detailed Findings

### FR-012: Trainer clicks appointment → sees full client card

`src/app/(app)/calendar/AppointmentDetailModal.tsx` — **DONE**

The modal detail view renders a full client card section (lines 268–306):

| Data point | Field | Line |
|---|---|---|
| Client name | `event.clientName` | 249 (modal title) |
| Package name | `event.packageName` | 272 |
| Remaining sessions | `event.remainingSessions` | 278 |
| "Ending soon" red badge (≤2) | badge condition `remainingSessions <= 2` | 276 |
| Interview notes | `event.client.interviewNotes` | 290 |
| Plan link | `event.client.planUrl` | 297 |
| Appointment date/time range | `event.startsAt / event.endsAt` | 309–314 |
| Status badge + quick-change | `event.status` | 317–337 |
| Appointment notes | `event.notes` | 339–346 |

### FR-014: Remaining visits shown on client card AND on calendar

Both surfaces are implemented:

**In the modal** (`AppointmentDetailModal.tsx:276–280`): remaining sessions badge, red when ≤ 2, blue otherwise. Label: "N wizyt".

**On calendar chips** — two surfaces:
- `MonthView.tsx:139–143`: badge shown only when `remainingSessions !== null && remainingSessions <= 2 && status === 'scheduled'`
- `TimeGrid.tsx:200–204`: same logic, additionally gated on card height `> SLOT_HEIGHT * 1.5` (card must be tall enough to fit the badge)

Note: the chip only shows the badge when ≤ 2 (the "ending soon" signal). Normal remaining-sessions count is not shown on the chip when > 2 — this is intentional (reduces noise).

### US-01 checklist

> Trainer opens app on phone, taps a session in weekly calendar, immediately sees: assigned package with remaining visits, interview notes, training goals, plan link.

| US-01 item | Implemented? | Notes |
|---|---|---|
| Tap session in weekly calendar | ✅ | TimeGrid slot click opens CreateModal, event click opens DetailModal |
| Assigned package with remaining visits | ✅ | Package name + session badge in modal |
| "Ending soon" flag (≤2) | ✅ | Red badge in modal AND on chip |
| Interview notes | ✅ | `client.interviewNotes`, scrollable, max-h-28 |
| Training goals | ⚠️ | See "Training Goals Gap" below |
| Plan link | ✅ | External link with ExternalLink icon |

### Training Goals Gap

The PRD US-01 lists "notatki z wywiadu" and "cele treningowe" as two separate items. The database (`supabase/schema.sql:15–26`) has a single column:

```sql
interview_notes text
```

The `ClientForm.tsx` (lines 164–176) renders one Textarea with label "Notatki z wywiadu" and placeholder:

```
"Cele, ograniczenia, historia zdrowotna…"
```

**Interpretation**: The development team deliberately consolidated "interview notes" and "training goals" into one `interview_notes` field. The placeholder explicitly lists goals as one of the things the trainer writes there. The PRD enumeration describes *what the field contains*, not that they must be separate DB columns.

**Decision needed for planning**: Accept the consolidation (no new DB column, S-05 is essentially done as a feature) OR add a separate `training_goals` text column, a new form field in ClientForm, and a separate display section in the modal. The former is lower effort; the latter matches the PRD literally.

### CalendarEvent type coverage

`src/app/(app)/calendar/types.ts` — the `CalendarEvent.client` sub-object carries:

```typescript
client: {
  id: string
  firstName: string
  lastName: string
  phone: string | null
  email: string | null
  interviewNotes: string | null
  planUrl: string | null
}
```

`phone` and `email` are available but not displayed in the detail modal. The modal does not show contact info (intentional — the trainer already knows their clients).

## Code References

- `src/app/(app)/calendar/AppointmentDetailModal.tsx:268–306` — client card section in detail view
- `src/app/(app)/calendar/AppointmentDetailModal.tsx:249` — client name in modal title
- `src/app/(app)/calendar/types.ts:5–28` — CalendarEvent shape including client sub-object
- `src/app/(app)/calendar/MonthView.tsx:139–143` — remaining sessions badge on month chip
- `src/app/(app)/calendar/TimeGrid.tsx:200–204` — remaining sessions badge on time-grid card
- `supabase/schema.sql:15–26` — clients table (no separate training_goals column)
- `src/app/(app)/clients/ClientForm.tsx:164–176` — single interview_notes field with goals in placeholder

## Architecture Insights

- Data is fetched **once at page load** (Server Component `page.tsx`) and passed to `CalendarClientSection` → `CalendarView`. No per-tap network request — the client card renders instantly from already-loaded data. This satisfies the 2-second NFR without any additional optimization.
- The `CalendarEvent.client` sub-object is a denormalized snapshot of client data embedded in each event. Any new client fields (e.g., `training_goals`) would need to be: (1) added to the DB, (2) added to the Supabase select in `page.tsx`, (3) added to `CalendarEvent.client` in `types.ts`, and (4) rendered in `AppointmentDetailModal`.
- The modal is already architected for expansion — the client card section is a clearly delineated block that can accept new fields with minimal refactor.

## Historical Context

- `context/archive/2026-06-01-calendar-appointments/plan.md` — S-04 implementation included FR-012 and FR-013 in its scope. The AppointmentDetailModal was built as part of Phase 4 of that plan, deliberately implementing the full client card display. FR-014 (remaining sessions on calendar) was also covered in Phases 5 and 7.
- The single `interview_notes` field consolidating goals was a design decision made during S-03 (client-management), not a gap introduced by S-04.

## Open Questions

1. **Training goals as a separate field?** Accept `interview_notes` as covering both (S-05 is done except for this decision) or add `training_goals` column + form field? This is the only substantive planning decision for S-05.
2. **Chip badge threshold** — current chips only show remaining-sessions badge when ≤ 2. The roadmap says "flagged ending soon when ≤ 2 remain" — this matches. But should the full count also be visible in the modal header (not just the badge)? Currently it shows "N wizyt" as the badge text which does convey the count.
3. **Mobile UX** — US-01 is framed as a phone use-case ("opens app on phone 5 minutes before training"). The modal renders inside a Dialog which is not mobile-optimized with a bottom-sheet pattern. Is the current Dialog UX acceptable for this primary use case?
