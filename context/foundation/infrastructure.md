---
project: trainer-app
researched_at: 2026-05-21
recommended_platform: Cloudflare Workers (via OpenNext adapter)
runner_up: Render
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Next.js 16 (App Router)
  runtime: Node.js / Cloudflare Workers (Edge-compatible)
  database: Supabase (external, managed PostgreSQL)
---

## Recommendation

**Deploy on Cloudflare Workers via the OpenNext adapter.**

For a cost-sensitive solo developer on a 6-week after-hours timeline, Cloudflare's free tier (100k Worker invocations/day) handles the trainer app's low traffic indefinitely at $0/month. The `wrangler` CLI provides the strongest agent-operational story of any evaluated platform — including a native `wrangler rollback` command that no other shortlisted platform matched. Documentation is published as machine-readable `llms-full.txt` per product scope, making it the most agent-friendly platform in the pool. SSE streaming for the AI assistant is a first-class pattern with no effective duration limit. The primary ongoing risk is the OpenNext adapter's community-maintenance model and the 3 MiB free-tier bundle limit, both of which are manageable at MVP scale.

## Platform Comparison

| Platform | CLI-first | Managed/Serverless | Agent docs | Stable deploy API | MCP/Integration | Cost at low traffic |
|---|---|---|---|---|---|---|
| **Cloudflare Workers** | Pass | Pass | Pass | Pass | Partial (Beta) | **$0** (free tier) |
| **Render** | Partial | Pass | Pass | Pass | Pass (GA) | $7/month |
| **Railway** | Partial | Pass | Partial | Pass | Partial (Preview) | $5–8/month |
| Vercel | Pass | Pass | Pass | Pass | Partial (Beta) | $20/month (Pro required for commercial) |
| Netlify | Partial | Pass | Partial | Pass | Partial (Preview) | Free hard cap / $20/month Pro |
| Fly.io | Partial | Partial | Partial | Pass | Partial (Exp.) | $4–5/month (no free tier) |

"Partial" on CLI-first = no native rollback CLI command (dashboard/REST only).
"Partial" on Agent docs = no llms.txt or partial index only.
Netlify free tier cuts the site off hard when 300 credits/month are exhausted — unsuitable for production.
Vercel Hobby plan is prohibited for commercial use by ToS; Pro ($20/month) is required.

### Shortlisted Platforms

#### 1. Cloudflare Workers + OpenNext (Recommended)

Wins on cost (free tier), docs quality (`llms-full.txt` scoped per product), native `wrangler rollback`, and SSE with no duration limit. The OpenNext adapter is now stable on Next.js 16.2+ (Adapter API became stable in 16.2, ending the need to reverse-engineer build output). The primary risk is the 3 MiB gzipped bundle limit on free tier and the community-maintenance dependency for OpenNext patches.

#### 2. Render

Best MCP story of any platform — GA since August 2025 with 20+ tools covering logs, metrics, read-only SQL, and env var management. Persistent Node.js process eliminates SSE concerns entirely (100-minute maximum). At $7/month Starter it's the lowest cost among always-on paid platforms. Loses to Cloudflare on free tier price and CLI rollback (Render has no `render rollback` CLI command).

#### 3. Railway

Simple DX, EU region (Amsterdam), $5–8/month including subscription. The 5-minute hard HTTP connection limit for SSE is workable — LLM responses rarely exceed that ceiling, and the standard mitigation (periodic keep-alive comments + client EventSource reconnect) is well-documented. Loses to Render on MCP maturity (Railway MCP is explicitly labelled "a work in progress") and to Cloudflare on cost and docs.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **3 MiB gzipped bundle limit on free tier.** Next.js 16 + Supabase SDK + Anthropic SDK combined easily approaches this ceiling. Adding any dependency can silently push you over and block the next deploy. Paid Workers ($5/month) raises it to 10 MiB, but bundle monitoring becomes permanent maintenance.
2. **OpenNext is community-maintained, not first-party Cloudflare support.** When Next.js releases a security patch, you cannot safely deploy it until OpenNext validates compatibility. A poorly-timed patch during the 6-week sprint can block deployment for days.
3. **The existing `middleware.ts` uses `@supabase/ssr` cookie operations — Edge compatibility must be tested explicitly.** OpenNext does not support Node.js-only middleware; the Supabase SSR middleware must be fully Edge-compatible. `@supabase/ssr` is designed for Edge but cookie lifecycle interactions between Next.js 16 and Cloudflare's request model have historically had subtle issues.
4. **EU Worker execution is Enterprise-only.** Workers run globally by default including US data centers. For a Polish trainer managing client health data and training history under GDPR, the processing location matters — not just storage. Cloudflare's Regional Services (EU-only execution) is Enterprise tier only.
5. **`NEXT_PUBLIC_*` environment variables are baked into the Worker bundle at build time.** Rotating the Supabase anon key requires a full rebuild and redeploy — no hot-swap via `wrangler secret put` for client-side env vars.

### Pre-mortem — How This Could Fail

*Six months later, the Cloudflare Workers choice was a complete disaster.* The bundle issue hit first — adding the Anthropic SDK pushed the gzipped bundle past 3 MiB on free tier. Upgrading to paid Workers added $5/month and the developer moved on. Then Next.js 16.2.8 patched a security vulnerability. The developer updated without checking OpenNext compatibility. `wrangler deploy` succeeded, but the Supabase middleware started silently dropping sessions — users hit `/login` on every request. A change in Next.js 16.2.8's cookie handling had broken the OpenNext middleware shim's interaction with `@supabase/ssr`. `wrangler rollback` reverted production in seconds (a genuine win), but the developer was pinned to a vulnerable Next.js version for four days waiting for an OpenNext patch. When the trainer asked "where is my clients' data processed?" before signing a GDPR compliance form, the answer — "globally, including US data centers" — was a problem. The primary failure mode: treating OpenNext as equivalent to first-party support when it is community-maintained with variable patch latency.

### Unknown Unknowns

1. **The 10 ms CPU time limit per Worker invocation on free tier.** SSE for AI streaming is I/O-bound, so the limit rarely fires. But the monthly statistics page (aggregating appointments and revenue) does CPU work — a complex computation could hit the ceiling silently on free tier. Paid Workers includes 30M CPU-ms/month.
2. **No persistent log history on free tier.** `wrangler tail` streams live logs but provides no queryable history. For a production app, error investigation after the fact requires Sentry or Cloudflare Logpush (both paid/external).
3. **`wrangler versions list` shows numeric version IDs, not commit SHAs.** Correlating a Cloudflare deployment version to a git commit requires explicit `--message` labels at deploy time or maintaining the mapping externally.
4. **100k Worker invocations/day free tier counts every SSR page, every API call, every middleware execution.** For 20 clients each making 5 AI assistant calls/day plus regular app navigation, you're well within budget. But a load test or traffic spike could exhaust free tier before alerting kicks in.
5. **Health checks are not built in.** Unlike Render or Railway, Cloudflare has no automatic restart on a malfunctioning Worker. A hung middleware does not trigger automatic recovery — you rely on Cloudflare's edge network routing around failures, which is not the same as a health-check loop.

## Operational Story

- **Preview deploys**: Every `wrangler deploy` without `--env production` creates a preview Worker on a `*.workers.dev` subdomain. Preview URLs are available instantly and do not require access protection by default — add Cloudflare Access if preview URLs must be private.
- **Secrets**: Environment variables and secrets live in Cloudflare's encrypted secret store. Set with `wrangler secret put NEXT_PUBLIC_SUPABASE_URL` (note: NEXT_PUBLIC vars are baked at build time for client-side code; server-side secrets are read at runtime). Rotation: `wrangler secret put <KEY>` → `wrangler deploy` to rebuild client-side bundle if needed.
- **Rollback**: `wrangler rollback` (no version ID needed) immediately promotes the previous deployment. Target a specific version: `wrangler rollback <VERSION_ID>` from `wrangler versions list`. Time-to-revert: seconds. DB migrations do not roll back automatically — coordinate schema changes separately.
- **Approval**: `wrangler deploy --env production` requires a Cloudflare API token scoped to the target account and zone. The agent may perform deploys and rollbacks unattended with a properly scoped token. Destructive actions (delete Worker, delete KV namespace) should be blocked at the token permission level.
- **Logs**: `wrangler tail` streams live invocation logs to the terminal. Filter by status: `wrangler tail --format json | jq 'select(.outcome != "ok")'`. Persistent structured log history via **Axiom** (`@axiomhq/js`, dataset `trainer-app`) — ingest from within Workers using `logger.ingest()`. Axiom free tier covers 500 GB/month. Set `AXIOM_TOKEN` as a Worker secret via `wrangler secret put AXIOM_TOKEN`.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| OpenNext patch lag blocks Next.js security updates | Pre-mortem | M | H | Pin Next.js version in `package.json`; monitor OpenNext releases before upgrading Next.js |
| `middleware.ts` + `@supabase/ssr` Edge compatibility breaks silently | Devil's advocate | M | H | Test auth flow on Workers locally (`wrangler dev`) before first production deploy |
| 3 MiB bundle limit hit as dependencies grow | Devil's advocate | M | M | Add `wrangler deploy --dry-run` to CI to surface bundle size before merge; upgrade to paid ($5/mo) proactively |
| GDPR concern: Worker execution outside EU | Devil's advocate | L | M | Document processing locations in privacy policy; use Supabase EU region for data storage; accept EU execution is not guaranteed below Enterprise |
| `NEXT_PUBLIC_*` var rebuild required on key rotation | Unknown unknowns | L | M | Document the rotation procedure: `wrangler secret put` + `wrangler deploy` to rebuild bundle |
| Free tier 100k/day exhausted by load test or spike | Unknown unknowns | L | L | Set Cloudflare usage alerting; upgrade to paid Workers ($5/mo) before any load testing |
| No persistent log history on Cloudflare free tier | Unknown unknowns | H | M | Axiom (`@axiomhq/js`) is wired as the structured logger — set `AXIOM_TOKEN` secret before first deploy; use `wrangler tail --format json` for live debugging in parallel |

## Getting Started

1. **Install Wrangler:**
   ```bash
   npm install -g wrangler
   wrangler login
   ```

2. **Add the OpenNext Cloudflare adapter:**
   ```bash
   npm install @opennextjs/cloudflare
   ```
   Add to `next.config.ts` — follow the OpenNext Cloudflare setup guide at https://opennext.js.org/cloudflare.

3. **Initialize the Worker config:**
   ```bash
   wrangler init --from-dash  # if you already created the Worker in the dashboard
   # or manually create wrangler.toml with your account_id and compatibility_date >= "2024-09-23"
   ```
   Ensure `compatibility_flags = ["nodejs_compat"]` is set in `wrangler.toml`.

4. **Test locally before first deploy:**
   ```bash
   wrangler dev
   ```
   Verify: auth middleware redirects to `/login`, Supabase session is set correctly, SSE from the AI assistant streams without error.

5. **Deploy to production:**
   ```bash
   wrangler deploy --env production
   ```
   Set production secrets:
   ```bash
   wrangler secret put NEXT_PUBLIC_SUPABASE_URL
   wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY
   wrangler secret put AXIOM_TOKEN
   ```

6. **Wire GitHub Actions** (when ready): use `cloudflare/wrangler-action` in `.github/workflows/deploy.yml` with a scoped API token stored as a GitHub Secret.

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup (`.github/workflows/`)
- Production-scale architecture (multi-region, HA, DR, Enterprise Data Localization)
