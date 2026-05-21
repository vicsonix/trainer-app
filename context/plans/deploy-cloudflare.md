# Deploy trainer-app to Cloudflare Workers

## Context

The trainer-app is a Next.js 16 (App Router) + TypeScript + Supabase application. The infrastructure decision (recorded in `context/foundation/infrastructure.md`) selects **Cloudflare Workers via the OpenNext adapter** as the deployment platform — free tier, native `wrangler rollback`, and first-class SSE support for the AI assistant feature. Axiom (`@axiomhq/js`, already installed) provides persistent structured logs to compensate for Cloudflare's ephemeral log story.

No Cloudflare config exists yet (`wrangler.toml`, `open-next.config.ts`, GitHub Actions workflow are all absent). This plan wires everything needed to go from local dev to a live Cloudflare Workers URL.

---

## What needs to be done

### 0. Save plan to project context

Copy this plan to `context/plans/deploy-cloudflare.md` so it lives alongside the other foundation documents (`prd.md`, `tech-stack.md`, `infrastructure.md`).

### 1. Install missing dependencies

`@opennextjs/cloudflare` and `wrangler` are not yet installed.

```bash
npm install --save-dev @opennextjs/cloudflare wrangler
```

### 2. Create `open-next.config.ts` (project root)

Minimal config — `defineCloudflareConfig()` with no overrides is correct for a standard Next.js 16 App Router app.

```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
```

### 3. Create `wrangler.toml` (project root)

```toml
#:schema node_modules/wrangler/config-schema.json
name = "trainer-app"
main = ".open-next/worker.js"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = ".open-next/assets"
binding = "ASSETS"
```

`compatibility_date >= 2024-09-23` is required for `nodejs_compat` to expose the Node.js APIs that `@supabase/ssr` depends on.

### 4. Update `package.json` scripts

Add three new scripts; keep existing ones unchanged.

```json
"build:worker": "opennextjs-cloudflare build",
"preview":      "opennextjs-cloudflare preview",
"deploy":       "opennextjs-cloudflare deploy"
```

`build:worker` runs `next build` then compiles the Cloudflare bundle into `.open-next/`.
`preview` uses `wrangler dev` under the hood against the compiled bundle.
`deploy` calls `wrangler deploy` with the compiled output.

### 5. Create `src/lib/logger.ts`

`@axiomhq/js` is already in `dependencies` (v1.6.1). Wire a thin module-level client; flush with `next/after` so logs are not lost when the Worker terminates before async work completes.

```ts
import { Axiom } from "@axiomhq/js";
import { after } from "next/server";

const axiom = new Axiom({ token: process.env.AXIOM_TOKEN! });

type Level = "info" | "warn" | "error";

export function log(
  level: Level,
  message: string,
  fields?: Record<string, unknown>
) {
  axiom.ingest("trainer-app", [
    { _time: new Date().toISOString(), level, message, ...fields },
  ]);
  after(async () => { await axiom.flush(); });
}
```

`after()` registers a callback that runs after the response is sent — the correct pattern for fire-and-forget side effects in App Router / Workers. **Do not call `axiom.flush()` inline** in route handlers; it will block the response.

`AXIOM_TOKEN` is a runtime secret — read from the Worker environment at request time, not baked into the bundle.

### 6. Create `.github/workflows/deploy.yml`

Triggers on push to `main`. `NEXT_PUBLIC_*` vars must be injected at build time because they are baked into the Worker bundle.

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - run: npm ci

      - name: Build for Cloudflare Workers
        run: npm run build:worker
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}

      - name: Deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

`AXIOM_TOKEN` is NOT passed here — it lives as a Worker secret set via `wrangler secret put`, not an env var baked at build time.

---

## Manual gates (human action required)

### A. Create a Cloudflare account and log in with Wrangler

1. Go to **https://dash.cloudflare.com/sign-up** and create a free account.
2. In the terminal, inside the `trainer-app` directory:
   ```bash
   npx wrangler login
   ```
3. A browser window opens asking you to authorise Wrangler. Click **Allow**.
4. The terminal prints `Successfully logged in.` — you are done.
5. Find your **Account ID**:
   - In the Cloudflare dashboard, click any domain or go to **Workers & Pages**.
   - The Account ID is shown in the right-hand sidebar (32-character hex string).
   - Copy it — you will need it for GitHub Secrets.

### B. Create an Axiom account and dataset

1. Go to **https://app.axiom.co** and sign up for a free account.
2. In the Axiom dashboard, click **Datasets → New dataset**.
3. Name it exactly `trainer-app` and click **Create**.
4. Go to **Settings → API Tokens → New API token**.
5. Give it a name (e.g. `trainer-app-worker`), set scope to **Ingest** on dataset `trainer-app`, and click **Create**.
6. Copy the token — it is shown only once.

### C. Set Worker secrets

> **If `CLOUDFLARE_API_TOKEN` is already set as an env var**, `wrangler login` is skipped — that's fine, you are already authenticated via the token.

Run each command **one at a time**. Paste the secret value when prompted and press Enter. Since `wrangler.toml` does not exist yet at this stage, pass the worker name explicitly with `--name`:

```bash
npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL --name trainer-app
```
*(paste your Supabase Project URL, press Enter)*

```bash
npx wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY --name trainer-app
```
*(paste your Supabase anon key, press Enter)*

```bash
npx wrangler secret put AXIOM_TOKEN --name trainer-app
```
*(paste your Axiom token, press Enter)*

Supabase values come from your Supabase project dashboard → **Project Settings → API**.

Once `wrangler.toml` is created (Step 3 of the implementation), you can omit `--name trainer-app` in future secret commands.

### D. Add GitHub Secrets (before CI can run)

In your GitHub repository go to **Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret name | Where to find the value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → Create Token (see permissions below) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard sidebar (32-char hex) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public key |

**Cloudflare API token permissions:**

1. Go to **https://dash.cloudflare.com/profile/api-tokens → Create Token → Create Custom Token**.
2. Name it `trainer-app-github-actions`.
3. Add permissions:

   | Resource | Permission |
   |---|---|
   | Account → Workers Scripts | Edit |
   | Account → Workers KV Storage | Edit |
   | Account → Cloudflare Pages | Edit |

4. Account Resources → **Include → your account**.
5. Click **Continue to summary → Create Token** and copy immediately.

---

## Files created / modified

| File | Action |
|---|---|
| `context/plans/deploy-cloudflare.md` | Created (this file) |
| `open-next.config.ts` | Created |
| `wrangler.toml` | Created |
| `src/lib/logger.ts` | Created |
| `.github/workflows/deploy.yml` | Created |
| `package.json` | Modified — added `build:worker`, `preview`, `deploy` scripts |

---

## Verification

### Local (before deploy)

```bash
npm run build:worker   # builds Next.js + Cloudflare bundle into .open-next/
npm run preview        # runs locally against compiled bundle
```

Check: `/` redirects to `/login`, `/login` renders without 404.

### Bundle size check

```bash
npx wrangler deploy --dry-run --outdir dist
```

If gzipped Worker script exceeds 3 MiB, upgrade to paid Workers ($5/month).

### Production deploy

```bash
npm run deploy
```

Verify the `*.workers.dev` URL: auth redirect works, `wrangler tail` shows requests, Axiom dashboard shows log entries.

### CI verification

Push to `main` → GitHub Actions "Deploy" workflow passes → new version visible in Cloudflare dashboard → Workers & Pages → `trainer-app`.
