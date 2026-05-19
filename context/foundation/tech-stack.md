---
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
---

## Why this stack

Solo developer building a personal trainer management web app in 6 after-hours weeks. Custom path chosen because the user explicitly requested Next.js and TypeScript over the JS recommended default (10x-astro-starter). Next.js with App Router clears all four agent-friendly gates (typed, convention-based, popular in training data, well-documented) and has verified bootstrapper confidence. Supabase is added post-scaffold to provide managed PostgreSQL, built-in email+password auth (covering FR-001/002 without writing auth from scratch), and storage — eliminating operational overhead critical for a solo timeline. Auth and AI feature flags are true; the AI assistant (FR-015–017) calls an LLM over structured client data using Next.js API routes, requiring no separate backend service. Vercel deployment integrates natively with Next.js; GitHub Actions with auto-deploy-on-merge matches a solo shipping cadence. NestJS was considered and declined — the additional service overhead is unjustified at this scale and timeline.
