<!-- PLAN-REVIEW-REPORT -->
# Plan Review: AI Assistant (S-06) Implementation Plan

- **Plan**: `context/changes/ai-assistant/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-04
- **Verdict**: SOUND (after fixes)
- **Findings**: 0 critical | 3 warnings | 2 observations

## Verdicts

| Dimension | Verdict |
|---|---|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING → PASS (F2, F3 fixed) |
| Plan Completeness | WARNING → PASS (F1, F4, F5 fixed) |

## Grounding

7/7 paths ✓, MAX_CONTEXT_CHARS (1 importer, blast radius contained) ✓, brief↔plan ✓, Progress↔Phase ✓

## Findings

### F1 — get_client spec contradicts Critical Implementation Details

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real bug; undercount for clients with >10 total appointments
- **Dimension**: Plan Completeness
- **Location**: Phase 2 → get_client + Critical Implementation Details
- **Detail**: Phase 2 spec said `LIMIT 10 + JS filter`; Critical Implementation Details said "two COUNT queries". Both wrong vs production. calendar/page.tsx:57-63 uses all appointments + JS filter.
- **Fix Applied**: Removed LIMIT 10; replaced with fetch-all + JS filter matching calendar/page.tsx. Removed conflicting COUNT query text from Critical Implementation Details.
- **Decision**: FIXED

### F2 — Phase 5 truncation test is structurally broken

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — test would pass even if truncation were deleted
- **Dimension**: Blind Spots
- **Location**: Phase 5 → Vitest integration: grounding under truncation
- **Detail**: Plan said "mock buildTrainerContext to return a long string, assert route truncates it." But truncation is INSIDE buildTrainerContext — mocking it bypasses truncation entirely. The route handler doesn't re-truncate.
- **Fix Applied**: Replaced with unit test of buildTrainerContext directly in context.test.ts; route.test.ts keeps 401 + scoping tests. Grounding instruction test stays in route.test.ts.
- **Decision**: FIXED via Fix A

### F3 — sendAutomaticallyWhen missing from useChat configuration

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — tool approval flow silently stalls after user clicks Approve
- **Dimension**: Blind Spots
- **Location**: Phase 3 → ChatPanel contract
- **Detail**: Phase 3 specified `useChat({ api: '/api/ai/chat' })`. Without `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses`, the client holds the approval response locally but does not auto-send it, so the conversation stalls.
- **Fix Applied**: Added `sendAutomaticallyWhen` to both ChatPanel.tsx and assistant/page.tsx contracts.
- **Decision**: FIXED

### F4 — "NOT modifying server actions" contradicts Phase 4

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — misleading wording, no implementation risk
- **Dimension**: Plan Completeness
- **Location**: What We're NOT Doing + Phase 4.4
- **Detail**: "NOT Doing" said "Modifying existing server actions" but Phase 4 modifies clients/index.ts to add embedding generation.
- **Fix Applied**: Rephrased to "Reusing the FormData-based server action signatures in tool execute functions."
- **Decision**: FIXED

### F5 — data-testid="typing-indicator" not specified in Phase 3

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — Phase 5 E2E test fails silently if Phase 3 skips the attribute
- **Dimension**: Plan Completeness
- **Location**: Phase 3 → ChatPanel + Phase 5 → E2E test
- **Detail**: Phase 5 E2E uses `getByTestId('typing-indicator')` but Phase 3 contract never mentioned the attribute.
- **Fix Applied**: Added `data-testid="typing-indicator"` requirement to Phase 3 ChatPanel contract.
- **Decision**: FIXED

## Scope Addition

**Conversation history (Phase 6)** added per user request during review. The plan previously listed "Conversation persistence" as explicitly out of scope. Phase 6 adds:
- `conversations` + `conversation_messages` tables (Supabase migration)
- Server actions for CRUD (create, save, load, list, rename, delete)
- ChatPanel updated: loads most recent conversation on mount, saves messages via onFinish
- `/assistant` page: thread-list sidebar (desktop) / sheet (mobile)
- Auto-title from first user message (60 chars)
