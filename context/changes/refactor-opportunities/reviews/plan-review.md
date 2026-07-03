<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Appointment status write-path refactor

- **Plan**: context/changes/refactor-opportunities/plan.md
- **Mode**: Deep
- **Date**: 2026-07-03
- **Verdict**: REVISE (borderline SOUND — fundamentally solid; findings are refinements, none block)
- **Findings**: 0 critical · 3 warnings · 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | WARNING |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

8/8 paths ✓ · guard (`index.ts:191-201`, revalidate `:211`), AI tool (`ai/tools/appointments.ts:138-142`), `makeChain:49` omits `single`, no `export const dynamic/revalidate` on analytics/dashboard ✓ · brief↔plan ✓

## Findings

### F1 — Phase 5 asserts a trainer-global aggregate; needs an in-test baseline

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 5 — Cross-boundary E2E
- **Detail**: "Sesji ukończonych" (`analytics/page.tsx:187`) renders `completedCount` = `appointments.filter(status==='completed').length` over the trainer's whole period-scoped set — a shared aggregate the unique timestamped seed does not isolate. "Assert the count increased" only holds if a baseline is read in-test right before the mark AND this stays the only spec mutating completed-count for the shared storageState user. Plan doesn't pin the baseline read; Playwright runs spec files in parallel.
- **Fix**: Capture the baseline count in-test immediately before marking completed and assert baseline+1; note this must remain the sole completed-count-mutating E2E (or use a dedicated user). Alternatively assert the specific seeded row shows the completed badge — deterministic regardless of other data.
- **Decision**: PENDING

### F2 — Phase 2's automated "no throw on revalidation" is decorative

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — item 3 / Success Criteria 2.2
- **Detail**: The suite mocks next/cache (`appointments.test.ts:4`, `revalidatePath: vi.fn()`). A mocked revalidatePath cannot throw regardless of context, so "AI-tool execute asserts no throw on revalidation" (2.2) proves nothing about the plan's own open risk — whether revalidatePath is callable inside the AI SDK tool's streaming `execute` in `/api/ai/chat`. Only the manual step (2.5) exercises it.
- **Fix**: Drop 2.2 as evidence for the context concern (keep only as a trivial smoke check, or remove it). Make the manual/integration run (2.5) the named verification for revalidatePath-in-tool-context.
- **Decision**: PENDING

### F3 — New mock helper duplicates existing setupDualCallMock

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 1 — item 1 (setupChains example, plan lines 70-74)
- **Detail**: The plan invents a queue-based `setupChains` helper, but `appointments.test.ts` already ships `setupDualCallMock` (two-`from()`-call mock, `:56-66`) and `setupSingleCallMock`. The guard's "read starts_at → update" is exactly the two-call shape setupDualCallMock models. A third parallel helper is pattern proliferation.
- **Fix**: Add `'single'` to makeChain's method list (`:49`) and reuse/extend setupDualCallMock (first chain resolves `{ data: { starts_at } }`) for the guard-path tests. No new helper.
- **Decision**: PENDING

### F4 — UI already client-side hides future completed/no_show buttons

- **Severity**: 🔷 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phases 3.5 / manual guard checks
- **Detail**: `AppointmentDetailModal.tsx:332-335` already filters completed/no_show out of the button list for future appointments. So the manual UI checks "calendar still blocks future completion" verify the CLIENT filter, not the refactored SERVER guard — the server guard could regress and these UI steps still pass. The server guard is meaningfully covered only by the unit tests (and the AI path, which has no client filter — which is exactly why Phase 4 matters).
- **Fix**: Note in the manual steps that server-guard proof comes from the unit tests; the UI check only confirms no client-filter regression.
- **Decision**: PENDING

### F5 — Phase 5 E2E does not actually validate RO-D revalidation

- **Severity**: 🔷 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 5 vs Phase 2
- **Detail**: /analytics and /dashboard render dynamically (grounding confirms no `export const dynamic/revalidate`; analytics reads cookies via the server client). The E2E shows the fresh count whether or not Phase 2's /analytics + /dashboard revalidation exists — so it proves RO-E (calendar→analytics consistency) but not RO-D. The plan already frames RO-D as latent insurance, so this is consistent, just worth stating so Phase 5 isn't read as RO-D coverage.
- **Fix**: One-line comment in the spec that RO-D's value is preventive (future static/ISR), verified manually — not by this E2E.
- **Decision**: PENDING

### F6 — Past-dated seed conflicts with the slot-click booking convention

- **Severity**: 🔷 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 5 — item 1
- **Detail**: The plan says "book a past-dated appointment following calendar.spec conventions," but that convention clicks a current-week time slot (`calendar.spec.ts:16`) which pre-fills the current week. The date input is a plain `<input type="date">` with no `min` (`CreateAppointmentModal.tsx:143-150`) — so a past date is bookable, but only by typing into the `Data` field, then navigating the calendar to that past week to open the event and mark it completed.
- **Fix**: Specify the seed steps explicitly: open create modal, overwrite the Data field with a past date (e.g. yesterday), save; then navigate to that week to open the chip and click "Odbyła się". Select the 'all' analytics period if the seed crosses the current month.
- **Decision**: PENDING
