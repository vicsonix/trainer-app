---
run_date: 2026-05-19
project_name: trainer-app
language_family: js
health_status: needs-attention
---

## Summary

| Gate | Result |
|------|--------|
| Lockfile | ✓ present (`package-lock.json`) |
| Audit | 0 CRITICAL · 0 HIGH · 2 MODERATE (transitive) |
| Outdated | 3 packages with major version gaps |
| Test runner | ✗ not detected |
| CI/CD | ✗ not detected |
| Git repository | ✗ not initialized |
| Supabase config | ✗ env vars are placeholders |

---

## Dependency audit

**Tool:** `npm audit --json`  
**Exit code:** 1 (vulnerabilities present — informational)

| Severity | Count | Direct / Transitive |
|----------|-------|---------------------|
| CRITICAL | 0 | — |
| HIGH | 0 | — |
| MODERATE | 2 | both transitive (`next → postcss`) |
| LOW | 0 | — |

Both MODERATE findings are the same `postcss < 8.5.10` XSS advisory (GHSA-qx2v-qp2m-jg93, CVSS 6.1) already documented in `context/changes/bootstrap-verification/verification.md`. The npm-suggested fix is a major downgrade to Next.js 9 — inappropriate. Wait for a patch in the Next.js 16 line. No action required now.

---

## Outdated packages (major gaps only)

| Package | Installed | Latest | Gap |
|---------|-----------|--------|-----|
| `@types/node` | 20.19.41 | 25.9.0 | **5 major versions** |
| `eslint` | 9.39.4 | 10.4.0 | **1 major version** |
| `typescript` | 5.9.3 | 6.0.3 | **1 major version** |
| `react` / `react-dom` | 19.2.4 | 19.2.6 | minor — no action needed |

TypeScript 6 and ESLint 10 are recent major releases — check their migration guides before upgrading. `@types/node` v25 tracks Node 25, but your runtime is likely Node 20 LTS — stay pinned to `@types/node@^20` intentionally.

---

## Test infrastructure

**Test runner detected:** No  
No `vitest.config.*`, `jest.config.*`, `playwright.config.*`, or test scripts found in `package.json`.

No `test` script is defined. The agent cannot verify its own changes without a test runner — this is the highest-impact Category A gap.

---

## CI/CD configuration

No `.github/workflows/` directory found. CI setup is deferred to the infrastructure lesson (Category B).

---

## Configuration gaps

| File | Status | Severity |
|------|--------|----------|
| `tsconfig.json` (`strict: true`) | ✓ present | — |
| `.gitignore` | ✓ present | — |
| `eslint.config.mjs` | ✓ present | — |
| `.editorconfig` | ✗ missing | low |
| Prettier / Biome formatter config | ✗ missing | medium |
| `.env.example` | ✗ missing | low |
| `CLAUDE.md` / `AGENTS.md` | Category B | see below |

---

## Category A — Fix before agent work

These are actionable now, ordered by impact on agent collaboration.

### 1. Initialize git repository
**What:** No `.git` directory — the project is not version-controlled.  
**Why it matters:** Without git, there is no safety net. Agent-assisted changes cannot be reviewed, rolled back, or diffed. This is the prerequisite for everything else.  
**Fix:**
```bash
cd trainer-app
git init
git add .
git commit -m "Initial scaffold: Next.js 16, Supabase SSR, TypeScript strict"
```
**Effort:** quick (< 5 min)

---

### 2. Add a test runner (Vitest)
**What:** No test runner is configured. No `test` script in `package.json`.  
**Why it matters:** The agent verifies its own changes by running tests. Without a test runner, every agent-generated code change is unverifiable — you must manually confirm correctness every time.  
**Fix:**
```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event
```
Then add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```
And create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom' },
})
```
**Effort:** moderate (15–30 min)

---

### 3. Fix `package.json` name
**What:** `"name": "bootstrap-scaffold"` — the scaffold temp directory name was not updated.  
**Why it matters:** Low functional impact but confusing in logs, error messages, and npm scripts. Fix it before the first real commit.  
**Fix:** In `package.json`, change:
```json
"name": "bootstrap-scaffold"
```
to:
```json
"name": "trainer-app"
```
**Effort:** quick (< 5 min)

---

### 4. Configure Supabase environment variables
**What:** `.env.local` contains placeholder values (`your-project-url`, `your-anon-key`). The middleware and Supabase clients use `!` non-null assertions — they will throw at runtime with invalid URLs.  
**Why it matters:** The app cannot start correctly until real values are provided. Auth middleware redirects all routes to `/login`, which doesn't exist yet — every page load 404s after Supabase fails.  
**Fix:**
1. Create a project at [supabase.com](https://supabase.com) (free tier)
2. Copy the project URL and anon key from Project Settings → API
3. Update `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```
**Effort:** moderate (15–30 min, includes Supabase project creation)

---

### 5. Create `.env.example`
**What:** No `.env.example` to document required environment variables.  
**Why it matters:** Without a template, anyone (including future-you) cloning the repo won't know what env vars to set.  
**Fix:** Create `trainer-app/.env.example`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```
Ensure `.env.local` is in `.gitignore` (it already is via the scaffold's `.gitignore`).  
**Effort:** quick (< 5 min)

---

### 6. Add a code formatter (Prettier)
**What:** No Prettier or Biome config found. ESLint is present but does not enforce formatting.  
**Why it matters:** Without a formatter, agent-generated code will have inconsistent style compared to existing code — diffs become noisy and reviews harder.  
**Fix:**
```bash
npm install -D prettier eslint-config-prettier
```
Create `.prettierrc`:
```json
{ "semi": false, "singleQuote": true, "tabWidth": 2 }
```
Add to `package.json` scripts:
```json
"format": "prettier --write ."
```
**Effort:** quick (< 5 min)

---

### 7. Review major dependency version gaps (advisory)
**What:** `@types/node` is 5 major versions behind latest; TypeScript and ESLint are 1 major behind.  
**Why it matters:** Major gaps accumulate breaking changes — the longer you wait, the harder the upgrade. Not urgent today, but worth scheduling.  
**Fix (for @types/node — keep on Node 20 LTS):** Leave `@types/node@^20` intentionally. The `^25` latest tracks Node 25, which you are not running. No change needed.  
**Fix (TypeScript 6):** Check [TypeScript 6 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html) for breaking changes before upgrading.  
**Fix (ESLint 10):** Check [ESLint 10 migration guide](https://eslint.org/docs/latest/use/migrate-to-10.0.0) — the flat config you already use (`eslint.config.mjs`) is the 10.x default, so the upgrade may be smooth.  
**Effort:** moderate (15–30 min per package, do separately)

---

## Category B — Addressed in upcoming lessons

These are real gaps but expected at this stage — you haven't been taught them yet. Frame them as next stops, not blockers.

### CI/CD pipeline
No `.github/workflows/` directory. Local tests cover agent verification for now.  
**Covered in:** [Sprint Zero z Agentem: infrastruktura, walking skeleton i pierwszy deploy (M1L5)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l5)

### Agent instruction files (CLAUDE.md / AGENTS.md)
`AGENTS.md` is present (moved by the scaffold) but `CLAUDE.md` was sidelined as `CLAUDE.md.scaffold`. Agent-specific rules and memory architecture are set up in the next lesson.  
**Covered in:** [Agent Onboarding: Agents.md, AI Rules i feedback loops (M1L4)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l4)

### Vercel deployment configuration
No `vercel.json` or deployment-specific env setup. Deployment wiring is done alongside CI.  
**Covered in:** [Sprint Zero z Agentem: infrastruktura, walking skeleton i pierwszy deploy (M1L5)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l5)

---

## What's already in good shape

- `tsconfig.json` has `strict: true` — agent generates type-safe code by default
- ESLint is configured via `eslint.config.mjs` — linting works out of the box
- Supabase SSR clients and auth middleware are wired (`src/lib/supabase/`, `src/middleware.ts`) — the auth skeleton is ready, just needs real env vars
- `@supabase/supabase-js` and `@supabase/ssr` are already installed
- `package-lock.json` is present — reproducible installs
- No CRITICAL or HIGH security advisories

---

## Suggested order of operations

1. `git init` + first commit (5 min) — safety net before anything else
2. Fix `package.json` name → `trainer-app` (1 min)
3. Create `.env.example` (2 min)
4. Configure Supabase with real env vars (15–30 min) — unblocks local dev
5. Add Vitest (20 min) — unblocks agent-assisted development
6. Add Prettier (5 min) — keeps diffs clean
7. Then start building application features
