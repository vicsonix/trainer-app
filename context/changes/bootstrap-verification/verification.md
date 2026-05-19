---
run_date: 2026-05-18
starter_id: next
project_name: trainer-app
phase_3_status: ok
---

## Hand-off

```yaml
starter_id: next
package_manager: npm
project_name: trainer-app
hints:
  language_family: js
  team_size: solo
  deployment_target: vercel
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: verified
  path_taken: custom
  quality_override: false
  self_check_answers:
    typed: true
    from_official_starter: true
    conventions: true
    docs_current: true
    can_judge_agent: false
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
```

**Why this stack:** Solo developer building a personal trainer management web app in 6 after-hours weeks. Custom path chosen because the user explicitly requested Next.js and TypeScript over the JS recommended default (10x-astro-starter). Next.js with App Router clears all four agent-friendly gates (typed, convention-based, popular in training data, well-documented) and has verified bootstrapper confidence. Supabase is added post-scaffold to provide managed PostgreSQL, built-in email+password auth (covering FR-001/002 without writing auth from scratch), and storage — eliminating operational overhead critical for a solo timeline. Auth and AI feature flags are true; the AI assistant (FR-015–017) calls an LLM over structured client data using Next.js API routes, requiring no separate backend service. Vercel deployment integrates natively with Next.js; GitHub Actions with auto-deploy-on-merge matches a solo shipping cadence. NestJS was considered and declined — the additional service overhead is unjustified at this scale and timeline.

---

## Pre-scaffold verification

| Signal | Value | Severity |
|--------|-------|----------|
| npm package | `create-next-app` | — |
| Latest version | 16.2.6 | — |
| npm time.modified | checked at run time | fresh |
| GitHub docs_url | `github.com/vercel/next.js` | — |
| GitHub pushed_at | active repository | fresh |

**Summary:** create-next-app@16.2.6 — fresh. No stale signals.

---

## Scaffold log

**Strategy:** scaffold into a temp directory then move files up (`subdir-then-move`)

**Command resolved:**
```
npx create-next-app@latest bootstrap-scaffold --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

**Note:** Initial attempt used `.bootstrap-scaffold` (with dot prefix). `create-next-app` rejected this name due to npm naming restrictions on leading-dot packages. Retried with `bootstrap-scaffold` (without dot) — exit code 0.

**Exit code:** 0

**Files moved from `bootstrap-scaffold/` to cwd:**

| File/Directory | Outcome |
|----------------|---------|
| `.gitignore` | moved silently |
| `AGENTS.md` | moved silently |
| `eslint.config.mjs` | moved silently |
| `next-env.d.ts` | moved silently |
| `next.config.ts` | moved silently |
| `package-lock.json` | moved silently |
| `package.json` | moved silently |
| `postcss.config.mjs` | moved silently |
| `README.md` | moved silently |
| `tsconfig.json` | moved silently |
| `.next/` | moved silently |
| `node_modules/` | moved silently |
| `public/` | moved silently |
| `src/` | moved silently |
| `CLAUDE.md` | **conflict** → sidelined as `CLAUDE.md.scaffold` |

**Conflicts:** 1 — `CLAUDE.md` (existing 10xDevs lesson instructions in cwd; scaffold's copy sidelined as `CLAUDE.md.scaffold`)

**`.gitignore` handling:** moved silently (no existing `.gitignore` in cwd prior to scaffold)

**Temp directory cleanup:** `bootstrap-scaffold/` deleted after move-up.

---

## Post-scaffold audit

**Tool:** `npm audit --json`
**Exit code:** 1 (vulnerabilities found — informational only)

| Severity | Count | Direct/Transitive |
|----------|-------|-------------------|
| CRITICAL | 0 | — |
| HIGH | 0 | — |
| MODERATE | 2 | both transitive |
| LOW | 0 | — |

**Moderate findings:**

1. **postcss < 8.5.10** — XSS via unescaped `</style>` in CSS stringify output (CVE GHSA-qx2v-qp2m-jg93, CVSS 6.1). Transitive: `next → postcss`. Fix listed by npm is `next@9.3.3` (a major version downgrade — not appropriate). The vulnerability is in the CSS stringifier used at build time; it does not affect runtime HTML output served to users in a typical Next.js app.

**Assessment:** No CRITICAL or HIGH findings. Both MODERATE findings are transitive through `next`'s bundled `postcss` build tooling. The suggested "fix" (downgrade to Next.js 9) is inappropriate — wait for a patch release in the current major line. No action required before development begins.

---

## Hints recorded but not acted on

The following hints from the hand-off were read but not acted on in v1 of the bootstrapper:

| Hint | Value | Note |
|------|-------|------|
| `hints.deployment_target` | `vercel` | Read; not used to configure any deployment files. CI/CD wiring deferred to future skill. |
| `hints.ci_provider` | `github-actions` | Read; no `.github/workflows/` generated. CI setup deferred. |
| `hints.ci_default_flow` | `auto-deploy-on-merge` | Read; not acted on. Deferred. |
| `hints.team_size` | `solo` | Read; no compensating action in v1. |
| `hints.has_auth` | `true` | Read; Supabase auth integration not wired. Auth setup is implementation work, not scaffold. |
| `hints.has_ai` | `true` | Read; no LLM SDK added. AI integration is implementation work, not scaffold. |
| `hints.has_payments` | `false` | No action required. |
| `hints.has_realtime` | `false` | No action required. |
| `hints.has_background_jobs` | `false` | No action required. |
| `hints.self_check_answers.can_judge_agent` | `false` | Heads-up recorded; no compensating action in v1. |

---

## Next steps

Your project is scaffolded and verified — happy hacking.

A future skill will set up agent context (`CLAUDE.md`, `AGENTS.md`) as part of the Memory Architecture lesson.

Immediate next steps for development:
- Add Supabase: `npm install @supabase/supabase-js @supabase/ssr`
- Set up environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Configure Supabase auth middleware for route protection (covers FR-001/002)
- Schema design: `packages`, `clients`, `appointments` tables with RLS policies per trainer account
