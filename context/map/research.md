**Target:** tool call → approval flow — entry: `ChatPanel.tsx` (`useChat` config) → `route.ts` (`makeTools`, `streamText`) → `lib/ai/tools/` (write tools with `needsApproval`) → streaming response back to UI — selected because map marks this as the highest-churn area (7 touches, active unstaged changes) and plan-review F3 caught a silent stall in the approval path.

---
