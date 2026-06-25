---
change_id: testing-appointment-action-baseline
title: Appointment action baseline — Vitest integration coverage for overlap, status, and ownership
status: archived
created: 2026-06-04
updated: 2026-06-25
archived_at: 2026-06-25T17:57:48Z
---

## Notes

Rollout Phase 1 of context/foundation/test-plan.md: "Appointment action baseline".
Risks covered: #4 (appointment overlap constraint / status logic silently
broken — zero test coverage) and #5 (IDOR — appointment action returns or
mutates another trainer's record because ownership check is missing).
Test types planned: Vitest integration tests with Supabase mock.
Risk response intent:
- Risk #4: prove that a second appointment at the same time slot is
  rejected; prove that a cancelled/no_show appointment does NOT block
  the slot; prove the status state machine is validated correctly.
- Risk #5: prove that each appointment action (create, update, delete)
  calls the ownership filter so trainer A cannot touch trainer B's records.
