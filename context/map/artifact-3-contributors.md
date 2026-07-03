# Artifact 3 — Contributors & Deep-Dive: Appointment Status Write-Path

_Chosen area: the appointment `status` write-path — `updateAppointmentStatusAction` + `AppointmentDetailModal` + the three read surfaces (calendar, analytics, dashboard)._
_Reason: newest live coupling; the one place where "data must survive the full user path" is unproven. Replaces the previous deep-dive (AI route), now dormant after S-06 closed._
_Source: git log --follow -p, diff analysis, code read._
_Generated: 2026-07-03_

---

## Who Works Here

**Solo project — one human, one AI pair.**

| Person | Role | Note |
|--------|------|------|
| Victoria (`budziakvictoria@gmail.com` / `vicsonix`) | Author — owns all decisions, reviews, merges | 99 commits, both identities |
| Claude (Sonnet 4.6 ×59, Opus 4.7-1M ×13, Opus 4.8 ×1) | AI pair — research, code, plan-review | Co-author on nearly every commit |

Knowledge is concentrated in Victoria. The written record (per-change `research.md` / `plan.md` / reviews under `context/archive/`) is the authoritative "why."

---

## The write-path in one picture

```
AppointmentDetailModal.tsx  (UI: user taps "Odbyta" / "Nieobecność" / "Odwołana")
        │  calls
        ▼
updateAppointmentStatusAction(id, status)          actions/appointments/index.ts:182
        │  ── auth check (getUser)
        │  ── GUARD: completed|no_show require starts_at <= now  (line 191–201)
        │  ── supabase.update({ status }).eq(id).eq(trainer_id)
        │  ── revalidatePath('/calendar')          ⚠ ONLY /calendar
        ▼
appointments.status  (enum: scheduled | completed | cancelled | no_show)
        │
        ├─► calendar views     — overlap checks exclude cancelled/no_show
        ├─► analytics/page.tsx — completedCount, cancelledCount, noShowCount,
        │                        revenue (completed × price), cancellation-rate
        └─► dashboard/page.tsx — status-derived stat tiles
```

---

## Evolution of the status field (annotated)

### `20260603000001_add_appointment_status.sql` — 2026-06-04 (S-04)
Status column added to `appointments` with a default of `scheduled`. At this point status only affected calendar overlap logic.

### `368f... / calendar` — 2026-06-04 (S-04/S-05)
`AppointmentDetailModal` gains the status buttons. Overlap checks in `createAppointmentAction` / `updateAppointmentAction` start filtering `.neq('status','cancelled').neq('status','no_show')` — a cancelled slot frees the time.

### `f164aaa` — 2026-06-25 (S-07 p2) — the coupling tightens
The analytics page turns `status` into a **reporting primitive**: every KPI (completed sessions, cancellations, no-shows, revenue, cancellation-rate, top clients) is now a projection of this one column. In the **same commit**, a bug was fixed:

```
fixed future appointment status bug: hide completed/no_show buttons in UI
and add server-side guard in updateAppointmentStatusAction
```

Two enforcement points for one rule ("you can't mark a future appointment as attended"):
- **UI** — `AppointmentDetailModal.tsx` hides the completed/no_show buttons for future appointments.
- **Server** — `updateAppointmentStatusAction` re-checks `starts_at <= now` and returns an error otherwise (defense in depth; the UI hide is not trusted).

This is the pattern to respect: **the server guard is the source of truth; the UI hide is a convenience.** Do not remove either assuming the other suffices.

---

## The unproven part (why this area, not the AI route)

`updateAppointmentStatusAction` calls `revalidatePath('/calendar')` and nothing else. But `/analytics` and `/dashboard` derive from the very same `status` column. Three open questions the write-path does **not** answer on its own:

1. After marking an appointment completed in the calendar, does `/analytics` show the updated count on next visit, or a stale cached figure? (Depends on whether those pages are dynamically rendered / uncached — **unknown, must be confirmed**.)
2. Revenue counts `completed` appointments **with a non-null price** (`analytics/page.tsx:88`). Appointments whose `price` is null are silently excluded from revenue but still counted as completed — is that the intended "N of M priced" behavior, or a data hole?
3. The guard blocks *setting* completed/no_show on a future appointment. It does **not** re-validate if an already-completed appointment is later edited to a future `starts_at`. Can status and date drift out of agreement?

These are exactly the cross-boundary, survives-the-full-path risks that a unit test cannot see and an E2E test can — which is what makes this the right deep-dive target.

---

## Recurring patterns Victoria applies here

| Pattern | Example | Implication |
|---------|---------|-------------|
| **Defense in depth** | UI hides buttons **and** server guards `starts_at` | Keep both; server is source of truth |
| **Trainer-scoping on every query** | `.eq('trainer_id', user.id)` on read and write | Never drop it — it is the data-isolation NFR |
| **Polish user-facing strings** | `'Nie można oznaczyć przyszłej wizyty jako odbytej'` | New error paths need Polish copy |
| **`revalidatePath` after mutation** | `revalidatePath('/calendar')` | ⚠ Currently under-scoped — analytics/dashboard not invalidated |
| **Status enum is a closed set** | `scheduled | completed | cancelled | no_show` | A new status value must be handled in all 3 read surfaces + overlap logic |

---

## What to read before changing this area

| Document | What it holds |
|----------|---------------|
| `context/archive/2026-06-25-trainer-analytics/plan.md` | How each KPI is derived from status; the future-appointment bugfix rationale |
| `context/archive/2026-06-01-calendar-appointments/` | Original status column + overlap-exclusion design |
| `context/archive/2026-06-04-testing-appointment-action-baseline/` | The action test baseline — status guard tests live in `appointments.test.ts` |
| `playwright/analytics.spec.ts`, `playwright/calendar.spec.ts` | Existing E2E; **neither asserts calendar→analytics status consistency** |

---

## Test coverage of this path (current)

| Layer | Coverage | Gap |
|-------|----------|-----|
| Unit | `appointments.test.ts` — action + guard | Good on the write side |
| E2E | `calendar.spec.ts` (status change in calendar), `analytics.spec.ts` (reads KPIs) | **No test crosses the boundary**: change status in calendar → assert the number moved in analytics/dashboard |

The gap in the last row is the risk to hand to the E2E flow (see repo-map "First day" + "Constraints").

---

## Knowledge Concentration Risk

Built by one person. The status field crossed three domains in three different slices (S-04 calendar, S-07 analytics, S-08 dashboard) — no single document describes its full fan-out. This map (Artifact 2 "Data-level coupling" + this artifact) is currently the only place that captures it end-to-end. Before touching status handling, read the three archive folders above; the diff history is the rest of the record.
