# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-04

---

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the
   team is worried about X, and the failure would surface somewhere in
   <area>" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase signal (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/`, `supabase/` (29 commits/30d).

---

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user/business
terms, not test names. The Source column cites the evidence that surfaced
this risk — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|-------------------------|--------|------------|-------------------------------|
| 1 | AI assistant presents fabricated or wrong client data as fact — wrong goals, wrong visit count, especially when the client context is truncated | High | Medium | Interview Q1 (user's #1 fear), PRD Business Logic (grounding rule), S-06 roadmap risk note |
| 2 | Calendar renders an appointment at the wrong time or the wrong day — timezone bug in the Cloudflare Workers edge runtime | High | Medium | Interview Q1 (#2 fear), interview Q3 (changes without confidence), PRD Guardrail ("calendar must always display the correct week"), infrastructure risk register |
| 3 | Package visit counter shows incorrect remaining visits — query counts wrong appointment statuses (e.g. includes `cancelled` instead of only `completed`) | High | Medium | Interview Q4 (hard to verify), PRD Business Logic (remaining = visit_count − completed appointments), S-05 roadmap risk note |
| 4 | Appointment overlap constraint or status logic silently broken — no test catches a regression | Medium | High | Interview Q2 (burned here), interview Q4 (biggest untested gap), hot-spot dir `src/app/actions/` (20 commits/30d, appointments sub-dir has zero tests) |
| 5 | IDOR — appointment or client action returns or mutates a record owned by another trainer, because the ownership check is missing or incomplete | High | Low-Medium | PRD NFR (explicit guardrail: "trainer data never visible from another account"), hot-spot dir `src/app/actions/` (each new action is a potential IDOR surface) |
| 6 | AI route builds context without a trainer-scoped filter — returns or synthesises another trainer's client records | High | Low | PRD NFR, interview Q1 (data isolation), abuse lens: authorization pattern (ownership check vs. authentication check) |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| #1 | When context is truncated at the 8000-char limit, the AI responds "I don't have that information" rather than fabricating an answer | "The system prompt says cite only provided data" — LLMs still hallucinate under truncation; the test must verify behavior under truncation, not just that the prompt is present | How the context payload is assembled; field ordering; what gets cut first; the system prompt text and grounding instruction | Vitest integration for the route handler (mock Supabase, supply oversized context) + Playwright E2E for UI grounding behavior | Testing only the happy path with a small context where all client data is present |
| #2 | An appointment stored at `09:00 UTC+2` appears in the 09:00 slot on the correct calendar day in the rendered UI — not shifted by the UTC offset | "It works locally" — Cloudflare Workers runs UTC; the browser may differ; local-passing tests may not reflect edge behavior | How `WeekView`/`CalendarView` converts `timestamptz` to display slots; which timezone library method is called; whether the edge runtime timezone is assumed | Unit tests for date utility functions in `src/app/(app)/calendar/utils/` + Playwright E2E for rendered calendar display | Testing the component with hard-coded dates without verifying the timezone conversion path from database-stored `timestamptz` |
| #3 | Remaining visits shown on client card = `package.visit_count − count(appointments WHERE status = 'completed')` — cancelled and no_show appointments do NOT reduce the counter | "Remaining = total visits minus all appointments" — PRD says completed; if the query omits the status filter, a cancellation wrongly reduces the counter | The actual Supabase query that calculates remaining visits; which status filter is applied; whether the display query is separate from the write path | Unit test for the counter calculation + Vitest integration for the query (Supabase mock) | Asserting the displayed number without verifying the status filter is present and correct |
| #4 | A second appointment at the same time slot is rejected with a clear error; a `cancelled` or `no_show` appointment does NOT block the slot | "Cancelled appointments should still block the slot" — verify which statuses exempt the overlap check; also challenge that the error is surfaced to the user, not silently swallowed | The actual overlap validation logic; which statuses are included or excluded from the overlap query; how the error state is returned | Vitest integration tests for appointment actions (Supabase mock — same pattern as `src/app/actions/clients/clients.test.ts`) | Testing only that an error is returned without verifying which specific statuses trigger or exempt the overlap |
| #5 | Server action called by trainer A cannot read, modify, or delete a record owned by trainer B, even when provided trainer B's record ID | "All actions already have `.eq('trainer_id', user.id)`" — verify this is present on every appointment action, not only the ones modelled after client actions | Which appointment actions exist; whether each has the ownership double-check; whether RLS is the true guard or the action-layer check is | Vitest integration — verify the ownership filter chain fires for each action | Testing only that an error is returned, not that the ownership predicate actually fired |
| #6 | POST to `/api/ai/chat` without a valid session returns 401; an authenticated request only receives context from that trainer's own records | "The route calls `getUser()` at the top" — does the context-building step also apply a trainer filter to every Supabase query it issues? | Which queries build the context payload; whether `trainer_id` filter is applied to each; the system prompt content and grounding constraint | Vitest integration for the route handler (mock `createClient`; verify 401 on unauthenticated request + scoped context on authenticated) | Testing only that the route returns 200 for an authenticated user, without verifying the context is scoped to that trainer |

---

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|------------|-----------------|---------------|------------|--------|---------------|
| 1 | Appointment action baseline | Add Vitest integration coverage for all appointment CRUD actions — schema validation, overlap constraint, status logic, and ownership checks | #4, #5 | Vitest integration (Supabase mock) | change opened | context/changes/testing-appointment-action-baseline/ |
| 2 | Visit counter + calendar time E2E | Prove the visit counter filters by `completed` status; prove the calendar renders appointments at the correct time/day in Edge-compatible timezone | #2, #3 | Unit tests for date utils + Vitest integration for counter query + Playwright E2E for calendar display | not started | — |
| 3 | AI assistant correctness | Prove the AI route scopes context to the authenticated trainer; prove grounding holds under context truncation; E2E for progress indicator and grounding behavior | #1, #6 | Vitest integration for route handler + Playwright E2E for assistant UI | not started | — |
| 4 | CI quality gates | Wire Vitest + Playwright into `.github/workflows/deploy.yml`; add `wrangler deploy --dry-run` bundle-size guard as a merge gate | cross-cutting | CI pipeline | not started | — |

---

## 4. Stack

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| Unit + integration | Vitest | ^4.1.6 | jsdom environment; `@testing-library/react` 16 + `@testing-library/user-event` 14; `@/` alias wired in `vitest.config.ts` |
| Supabase mocking | `vi.mock('@/lib/supabase/server')` | — | Established pattern in `src/app/actions/clients/clients.test.ts`; mock `createClient` → `{ auth: { getUser }, from }` |
| E2E | Playwright | ^1.60.0 | `playwright/` dir; `storageState` auth via `playwright/auth.setup.ts`; `webServer: npm run dev`; single Chromium project |
| Playwright MCP | not available in current session | — | Use Playwright CLI (`npx playwright test`) instead |
| Visual diff | none yet | — | Not planned; deterministic E2E assertions preferred over snapshot tests (see §7) |

**Stack grounding tools (current session):**
- Docs: Context7 MCP — available; not queried for this plan (framework APIs not in scope of risk analysis); checked: 2026-06-04
- Search: Exa.ai MCP — available; not queried (local manifest evidence sufficient); checked: 2026-06-04
- Runtime/browser: Playwright MCP — not available in current session; Playwright CLI installed in project
- Provider/platform: no GitHub, Cloudflare, or Supabase MCP available — not used; checked: 2026-06-04

---

## 5. Quality Gates

| Gate | Where | Required? | Catches |
|------|-------|-----------|---------|
| Lint + typecheck (`npm run lint` + `tsc --noEmit`) | local + CI | required now | syntactic / type drift |
| Unit + integration (`npm run test`) | local + CI | required after §3 Phase 1 | logic regressions in server actions, schema validation |
| E2E on critical flows (`npx playwright test`) | CI on PR | required after §3 Phase 2 | broken calendar display, visit counter, AI assistant UX |
| Bundle-size guard (`wrangler deploy --dry-run`) | CI on PR | required after §3 Phase 4 | Cloudflare Workers 3 MiB free-tier bundle limit |

---

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase N."

### 6.1 Adding a Vitest integration test for a server action

TBD — see §3 Phase 1. Will document the Supabase mock setup, `makeFormData` helper, ownership-check assertion pattern, and `revalidatePath` spy.

### 6.2 Adding a unit test for a pure utility function

TBD — see §3 Phase 2. Will document file placement, naming convention, and the date/timezone utility test pattern.

### 6.3 Adding a Playwright E2E test

TBD — see §3 Phase 2. Will document how to use the existing `storageState` auth, unique `testId` isolation, `afterEach` cleanup, and `getByRole`-first locator conventions. Reference seed: `playwright/calendar.spec.ts` (fix anti-pattern #1 in Phase 2 before using as exemplar).

### 6.4 Adding a test for a new API route

TBD — see §3 Phase 3. Will document the Vitest integration pattern for Next.js route handlers — mock `createClient`, assert 401 on unauthenticated, assert scoped response on authenticated.

### 6.5 Per-rollout-phase notes

(Filled in by `/10x-implement` after each phase lands.)

---

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **UI snapshot tests** — break on every style or copy change and catch no business regressions. Re-evaluate only if a visual regression escapes deterministic E2E assertions. (Source: interview Q5.)
- **Rate limiting on `/api/ai/chat`** — no rate-limiting implementation exists in v1; tests against a missing safeguard are speculative. Add tests if rate limiting is implemented in a future slice. (Source: Challenger pass — speculative risk.)
- **Auth registration form mechanics** — Supabase-owned flow; no hand-written logic to break. Re-evaluate if the registration form gains custom validation or a custom UI. (Source: stack analysis.)
- **Internal admin tooling** — none exists in v1; solo-trainer model only per PRD §Non-Goals.

---

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-04
- Stack versions last verified: 2026-06-04
- AI-native tool references last verified: 2026-06-04

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
