<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This is Next.js 16 (App Router). APIs, conventions, and file structure may all differ from your training data. Check https://nextjs.org/docs before writing any code.

Key breaking areas to watch:
- Pages Router, `getServerSideProps`, and `getStaticProps` are legacy — use Server Components and `fetch` instead.
- Data fetching happens in Server Components by default; Client Components are opt-in via `"use client"`.
- Route Handlers replace API Routes (`app/api/.../route.ts`, not `pages/api/`).

Do not use deprecated Next.js APIs. If a deprecated API is the only option, note the migration path in a comment and flag it in your response.

# Module structure

Every module must contain:
- `types.ts` — all TypeScript types and interfaces for that module
- `__tests__/` — all tests for that module

Do not place types inline in component or service files. Do not place test files outside `__tests__/`.

# Imports

Always use the `@/` path alias for project imports. Never use relative paths with `../`.

```ts
// correct
import { createClient } from "@/lib/supabase/client";

// wrong
import { createClient } from "../../lib/supabase/client";
```
<!-- END:nextjs-agent-rules -->
