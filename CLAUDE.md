# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start dev server on :3000
npm run build        # production build
npm run lint         # ESLint
npm run test         # Vitest single run
npm run test:watch   # Vitest watch mode
npm run format       # Prettier
```

Run a single test file: `npx vitest run src/path/to/file.test.tsx`

## Architecture

Next.js 16 App Router, TypeScript, Tailwind CSS v4, Supabase (auth + PostgreSQL).

**Auth flow** — `src/middleware.ts` intercepts every request (except static assets). It calls `supabase.auth.getUser()` on the server and redirects:
- unauthenticated → `/login`
- authenticated user on `/login` or `/register` → `/dashboard`

Public routes are only `/login` and `/register`. Everything else requires a session.

**Supabase clients** — two separate factories, never swap them:
- `src/lib/supabase/client.ts` — `createBrowserClient`, use in Client Components
- `src/lib/supabase/server.ts` — `createServerClient` with cookie plumbing, use in Server Components and Route Handlers

**Path alias** — `@/*` resolves to `src/*` (configured in both `tsconfig.json` and `vitest.config.ts`).

## Environment variables

Copy `.env.example` to `.env.local` and fill in both values before running the dev server:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Without these the middleware redirects every request in a loop and Supabase calls throw.
