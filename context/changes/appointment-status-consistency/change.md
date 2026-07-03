---
change_id: appointment-status-consistency
title: Appointment status write-path consistency across calendar, analytics, and dashboard
status: preparing
created: 2026-07-03
updated: 2026-07-03
archived_at: null
---

## Notes

**Target:** appointment `status` write-path — entry: `actions/appointments/index.ts:182` (`updateAppointmentStatusAction` — server guard + single `revalidatePath('/calendar')`) → `AppointmentDetailModal.tsx` (UI that mirrors the guard) → `analytics/page.tsx` + `dashboard/page.tsx` (both derive every KPI from the same `status` column) — selected because the regenerated map (2026-07-03) marks this as the hardest current coupling: one writer, one DB enum, three independent read surfaces, and the write invalidates only `/calendar`.

First unknowns to confirm/refute (from `context/map/repo-map.md` → Constraints):
- **U1 — cache/revalidation:** are `/analytics` and `/dashboard` dynamically rendered (refetch on visit) or do they show stale status-derived numbers after a status change?
- **U2 — migrations on prod:** `conversations` + `pgvector` migrations exist on disk; confirm they are applied to the live Supabase instance.
- **U3 — revenue data hole:** revenue sums `completed` appointments with non-null `price` only — intentional "N of M priced", or a gap?
- **U4 — status/date drift:** does editing an already-completed appointment's date into the future re-validate the guard?

Supersedes the earlier `ai-approval-flow` change folder (deleted) — that target went dormant after S-06 closed.

---
