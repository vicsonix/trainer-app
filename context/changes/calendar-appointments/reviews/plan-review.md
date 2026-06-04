<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Calendar Appointments Implementation Plan

- **Plan**: `context/changes/calendar-appointments/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-01
- **Verdict**: REVISE → SOUND (all findings triaged and fixed)
- **Findings**: 1 critical | 3 warnings | 2 observations

## Verdicts

| Dimension | Verdict |
|---|---|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | FAIL → FIXED |

## Grounding

5/5 paths ✓, 2/2 symbols (useActionState from 'react', Radix Dialog pattern) ✓, brief↔plan ✓

## Findings

### F1 — Progress section missing 2 manual items across 2 phases

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: ## Progress section (Phase 1 Manual, Phase 5 Manual)
- **Detail**: Phase 1 body had 3 manual items but Progress only had 1.2 + 1.3 (missing "Existing appointments have ends_at = starts_at + 1 hour"). Phase 5 body had 4 manual items but Progress only had 5.4 + 5.5 + 5.6 (missing "Mobile viewport auto-shows day view").
- **Fix**: Added `- [ ] 1.4` and `- [ ] 5.7` to the Progress section.
- **Decision**: FIXED

### F2 — Timezone bug: server action stores times 2 hours off for Polish users

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — createAppointmentAction contract
- **Detail**: `new Date(\`${date}T${start_time}\`)` on Cloudflare Workers (UTC default timezone) parses as UTC, not the trainer's local time. A Polish trainer (UTC+2 in summer) entering "10:00" would get an appointment stored as 10:00 UTC = 12:00 Warsaw — 2 hours off.
- **Fix A ⭐ Applied**: Added `tz` field (IANA timezone) to AppointmentSchema. Updated server action contract to use `@internationalized/date` for timezone-safe UTC conversion. Moved `npm install @internationalized/date` from Phase 3 to Phase 1 so it is available to Phase 2. Added hidden `tz` form field to CreateAppointmentModal contract.
- **Decision**: FIXED via Fix A

### F3 — AlertDialog nested inside Dialog: Radix `hideOthers` blocks the alert

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 4 — AppointmentDetailModal.tsx contract
- **Detail**: Radix Dialog calls `hideOthers()` on mount, marking all sibling DOM nodes (including subsequently-portalled AlertDialog content) as `aria-hidden`. No existing nested-modal precedent in the codebase. Both DeleteClientDialog and DeletePackageDialog run standalone.
- **Fix A ⭐ Applied**: Replaced nested AlertDialog with inline confirm UI — a `showDeleteConfirm: boolean` state toggles an inline "Czy na pewno? [Anuluj] [Usuń]" section inside the existing Dialog using standard Button components.
- **Decision**: FIXED via Fix A

### F4 — E2E test missing unique identifiers and afterEach cleanup

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 6 — playwright/calendar.spec.ts contract
- **Detail**: CLAUDE.md E2E rules require unique identifiers (timestamp suffix) and afterEach cleanup. Test used `getByText(clientName)` without uniqueness guarantee; no cleanup for mid-test failures.
- **Fix**: Updated E2E test contract to use `testId = \`test-${Date.now()}\`` as appointment notes. Updated assertion to use `getByText(testId)`. Added `afterEach` hook that deletes the test appointment if still present.
- **Decision**: FIXED

### F5 — Migration Notes contains incorrect PostgreSQL statement

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: ## Migration Notes
- **Detail**: "PostgreSQL does not retroactively validate the constraint against existing rows" is wrong — PG does validate unless `NOT VALID` is specified.
- **Fix**: Corrected to: "PostgreSQL validates existing rows when the CHECK constraint is added. This succeeds here because all existing appointments satisfy the constraint via the DEFAULT."
- **Decision**: FIXED

### F6 — Remaining sessions counts future appointments; PRD says 'completed'

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 5 — page.tsx contract
- **Detail**: PRD says "wizyt odbytych" (completed visits). Plan counts all appointments regardless of time. Deliberate design choice not acknowledged.
- **Fix**: Added explicit note to Phase 5 page.tsx contract: "all appointments (past and future) count against the package — a booked session is a used session" with the `.lte('starts_at', ...)` variant for future reference.
- **Decision**: FIXED
