---
date: 2026-06-01T00:00:00+00:00
researcher: Claude Sonnet 4.6
git_commit: ab22001e93287ba3354119be7b5e2bed94929a91
branch: feature/calendar-appointments
repository: trainer-app
topic: "Interactive calendar libraries compatible with Next.js 16 / React 19 / Tailwind v4"
tags: [research, calendar, react-19, tailwind-v4, schedule-x, fullcalendar, react-big-calendar]
status: complete
last_updated: 2026-06-01
last_updated_by: Claude Sonnet 4.6
---

# Research: Interactive Calendar Libraries for trainer-app

**Date**: 2026-06-01  
**Researcher**: Claude Sonnet 4.6  
**Git Commit**: `ab22001e93287ba3354119be7b5e2bed94929a91`  
**Branch**: `feature/calendar-appointments`  
**Repository**: trainer-app

## Research Question

Which interactive calendar library can be used in the trainer-app given the current tech stack, with the following requirements:
1. Click on each day (to create/view appointments)
2. Switch between month / week / day views
3. Render custom events (client name, remaining package sessions counter)
4. Fully styleable with Tailwind CSS v4

## Summary

Two libraries meet all four requirements and are compatible with the stack: **@schedule-x/react** (recommended) and **@fullcalendar/react** (battle-tested fallback). Two classic options — `react-calendar` and `react-day-picker` — self-eliminate because they are date pickers with no week/day views. `react-big-calendar` meets the feature requirements but carries a severe bundle-size penalty from five bundled date libraries. A **custom-built** weekly calendar is a viable MVP path given the PRD's explicit preference for the weekly view.

**Stack constraints that narrowed the field:**
- **React 19** — eliminates any library that neither declares `^19` nor works at runtime
- **Tailwind v4** (CSS-first, no `tailwind.config.js`) — eliminates any library whose styles cannot be overridden via CSS custom properties or className injection
- **Cloudflare edge deployment** — eliminates large Node.js-specific dependencies; client-only bundles must be lean
- **Mobile-first** — the PRD explicitly says the trainer uses the app on a smartphone 5–10 minutes before sessions

**PRD note (FR-011):** The monthly view was *rejected* in the PRD ("trainer plans weekly"). The research covers month/week/day as requested, but the MVP hard requirement is the **weekly view**. This matters for the custom-built option estimate.

## Detailed Findings

### Project Structure (relevant to calendar implementation)

- Route `/calendar` is already wired in the nav (`src/app/(app)/layout.tsx:11`) and dashboard card — the page file does not yet exist
- No calendar library is installed
- Tailwind v4 CSS-first setup: `@import "tailwindcss"` in `src/app/globals.css`, no `tailwind.config.ts`
- Color system uses CSS custom properties: `--color-lobster-pink-*`, `--color-jungle-teal-*`, `--color-tiger-orange-*`, `--color-soft-linen-*`
- Component pattern: CVA + `cn()` (clsx + tailwind-merge) + Radix UI primitives
- Page pattern: Server Component fetches from Supabase → Client Component manages state + modals
- Existing UI components ready to reuse: `Button`, `Card`, `Dialog`, `Select`, `Input`, `Textarea`

### Option 1: @schedule-x/react — RECOMMENDED

**Packages:**
```
@schedule-x/react           v4.1.0   (React wrapper)
@schedule-x/calendar        v4.6.0   (core engine)
@schedule-x/theme-default   (base CSS — overridable via CSS vars)
@schedule-x/events-service  (CRUD API for events)
```

**React 19 compatibility:** Explicitly declared — `react: "^16.7.0 || ^17 || ^18 || ^19"`. No workarounds needed.

**Architecture caveat:** The core engine (`@schedule-x/calendar`) is **Preact-based** with `@preact/signals` for reactivity. The React wrapper bridges the two frameworks. This means:
- Preact (~3 KB gzipped) ships alongside React in your bundle
- If React 19's concurrent rendering interacts unexpectedly with Preact signals, debugging is harder
- `temporal-polyfill` is pinned at **exactly `0.3.0`** — any other package in your dep tree pulling a different version causes a peer conflict. Check with `npm ls temporal-polyfill` after install.

**Tailwind v4 styling:** Best fit among library options. The theming system is CSS-variable-based, which is exactly how Tailwind v4 works:
```css
/* src/app/globals.css — override Schedule-X tokens */
:root {
  --sx-color-primary: var(--color-lobster-pink-600);
  --sx-color-primary-container: var(--color-lobster-pink-50);
  --sx-color-on-primary: #fff;
  --sx-border-radius: var(--radius);
}
```
Custom event components (via `customComponents`) receive full React + Tailwind access — you render whatever JSX you want inside the event block.

**Views:** Month grid, week, day — all built in. Views are imported from the core:
```ts
import { createViewDay, createViewWeek, createViewMonthGrid } from '@schedule-x/calendar'
```

**Mobile:** Responsive by design — better than the alternatives. The month grid collapses cleanly on narrow screens.

**Risks:**
- Single maintainer (`tomosterlund`) — bus-factor risk for production dependency
- Younger project (post-2023) — fewer Stack Overflow answers, fewer edge cases documented
- Preact/React boundary bugs could surface in React 19 concurrent mode

**Install (verify React 19 explicitly before committing):**
```bash
npm install @schedule-x/react @schedule-x/calendar @schedule-x/theme-default @schedule-x/events-service
```

---

### Option 2: @fullcalendar/react — BATTLE-TESTED FALLBACK

**Packages:**
```
@fullcalendar/react         v6.1.x
@fullcalendar/core          v6.1.x
@fullcalendar/daygrid       v6.1.x   (month/week grid)
@fullcalendar/timegrid      v6.1.x   (day/week time slots)
@fullcalendar/interaction   v6.1.x   (click, drag)
```

**React 19 compatibility:** Peer dep declares `react: "^17.0.0 || ^18.0.0"` — React 19 is **not listed**. Runtime works (FullCalendar only uses stable APIs), but npm install throws `ERESOLVE`. Fix:
```json
// package.json
{
  "overrides": {
    "@fullcalendar/react": {
      "react": "$react",
      "react-dom": "$react-dom"
    }
  }
}
```
Or install with `--legacy-peer-deps`. Verify the GitHub issues page for current React 19 status.

**Tailwind v4 styling:** Cannot fully suppress FullCalendar's injected CSS (it's co-bundled, not optional). Two-layer approach:
1. Override structure/colors via FullCalendar's CSS custom properties in `globals.css`:
   ```css
   :root {
     --fc-border-color: var(--color-soft-linen-200);
     --fc-today-bg-color: var(--color-lobster-pink-50);
     --fc-button-bg-color: var(--color-lobster-pink-600);
     --fc-event-bg-color: var(--color-jungle-teal-500);
     --fc-event-border-color: transparent;
   }
   ```
2. Use `eventContent` render prop for full React/Tailwind control over event cards:
   ```tsx
   <FullCalendar
     eventContent={(info) => (
       <div className="flex flex-col gap-0.5 px-2 py-1 text-xs rounded">
         <span className="font-semibold">{info.event.title}</span>
         <span className="text-lobster-pink-200">
           {info.event.extendedProps.remainingSessions} wizyt
         </span>
       </div>
     )}
   />
   ```

**Next.js App Router:** Requires `"use client"` + dynamic import with `ssr: false` to prevent hydration errors:
```tsx
"use client";
import dynamic from 'next/dynamic';
const FullCalendar = dynamic(() => import('@fullcalendar/react'), { ssr: false });
```

**Bundle size:** ~75–85 KB gzipped (all 5 packages). Loaded as a lazy chunk via dynamic import — acceptable.

**Mobile:** Poor out of the box. Implement view-switching on small screens:
```tsx
const isMobile = useMediaQuery('(max-width: 640px)');
// pass initialView={isMobile ? 'timeGridDay' : 'timeGridWeek'} to <FullCalendar />
```

**Cloudflare:** No issue — FullCalendar is client-only; the `"use client"` boundary prevents edge execution.

---

### Option 3: react-big-calendar — NOT RECOMMENDED

**Version:** 1.20.0 (actively maintained — published 2026-06-01)  
**React 19:** Explicitly declared `^19` ✓

**Dealbreaker — bundle bloat:** The library declares all five date adapters as direct `dependencies` (not optional):
- `moment` — 4.35 MB unpacked
- `moment-timezone`
- `dayjs`
- `luxon`
- `globalize`

Even if you only call `dayjsLocalizer()`, all five ship in `node_modules`. Whether your bundler eliminates the unused ones depends on its dead-code elimination — Webpack/Turbopack may or may not tree-shake the commonjs moment build. **Verify with `npm run build && npx @next/bundle-analyzer`** before adopting.

**Tailwind v4 styling:** Must import `react-big-calendar/lib/css/react-big-calendar.css` for layout — not optional (the week/day time-slot positioning is CSS-grid-dependent). Override visuals on top with Tailwind classes via the `components` prop.

**Mobile:** Week/day grid overflows on narrow screens. Requires significant custom CSS to fix.

Use only if Schedule-X and FullCalendar are both blocked by compatibility issues and bundle size is not a concern.

---

### Options 4 & 5: react-calendar / react-day-picker — ELIMINATED

Both self-eliminate for the same structural reason: **no week or day view**.

| | react-calendar v6.0.1 | react-day-picker v10.0.1 |
|---|---|---|
| React 19 | Explicit `^19` ✓ | Open range ✓ |
| Tailwind v4 | No default CSS (great) | `classNames` prop map (great) |
| Week/day view | **NO** | **NO** |
| Events | Tile content only | Day modifiers only |

Fine as date-picker fields in a form (e.g., "pick appointment date"). Not usable as the main calendar view.

---

### Option 6: Custom-built with @internationalized/date

**When to choose this:** If Schedule-X's Preact complexity or FullCalendar's CSS friction is unacceptable, and if the PRD's weekly-primary requirement means you can ship a one-view MVP first.

**Date math library:** `@internationalized/date` v3.12.2 — pure utility, no React dependency, locale + timezone aware. Used internally by Adobe's react-aria Calendar.

**Effort breakdown:**

| Component | Effort |
|---|---|
| Month grid (7-col, 6-row, with event dots) | 1–2 days |
| Week view — time slots, positioned event blocks | 2–3 days |
| Overlap layout algorithm (multiple events same slot) | 1 day |
| Day view (simpler variant of week) | 0.5 day |
| View switcher + prev/next navigation | 0.5 day |
| Mobile responsiveness | 1 day |
| **Total (all views)** | **6–8 days** |
| **Weekly-only MVP** (FR-011 minimum) | **~3–4 days** |

**Tailwind v4:** Completely native — every pixel is your Tailwind class. The existing CVA + `cn()` + color system integrates perfectly.

**Cloudflare / SSR:** Zero risk — no browser-API dependencies, renders as a standard React tree.

**Recommended headless approach:** `@internationalized/date` for date math + native `Date` for `new Date()` comparisons + your own component tree using the existing `Card`, `Button`, `Dialog` components.

## Code References

- `src/app/(app)/layout.tsx:11` — Calendar nav link (already wired)
- `src/app/(app)/dashboard/page.tsx:24-29` — Dashboard card pointing to `/calendar`
- `src/app/globals.css` — Tailwind v4 config and color system (target for library CSS variable overrides)
- `src/lib/utils.ts` — `cn()` helper for all calendar component classes
- `src/components/ui/dialog.tsx` — Reuse for appointment create/edit modal
- `src/components/ui/button.tsx` — Reuse for view-switcher and nav buttons
- `src/app/(app)/clients/ClientsClientSection.tsx` — Reference pattern for "Client Component with server-fetched data + modal"
- `src/app/(app)/packages/page.tsx` — Reference pattern for server-fetching Supabase data

## Architecture Insights

**Page pattern for `/calendar`:**
1. `src/app/(app)/calendar/page.tsx` — Server Component: fetches appointments + clients from Supabase, passes as props
2. `src/app/(app)/calendar/CalendarClientSection.tsx` — `"use client"`: owns view state, modal state, renders the library component

**Supabase schema needed (not yet created):**
- `appointments` table: `id`, `trainer_id`, `client_id`, `start_at` (timestamptz), `end_at` (timestamptz), `notes`
- Join with `clients` for name and `packages`/`package_sessions` for remaining session count

**Event data shape for any library:**
```ts
type CalendarEvent = {
  id: string;
  title: string;           // client full name
  start: Date;
  end: Date;
  extendedProps: {
    clientId: string;
    remainingSessions: number;  // for FR-014
    clientName: string;
  };
};
```

## Decision Matrix

| Criterion | @schedule-x | FullCalendar | react-big-calendar | Custom |
|---|---|---|---|---|
| React 19 declared | ✓ | ✗ (works) | ✓ | ✓ |
| Tailwind v4 native | CSS vars ✓ | CSS vars (limited) | Partial | Full ✓ |
| Month/Week/Day | ✓ | ✓ | ✓ | Build |
| Custom events | ✓ | ✓ | ✓ | Full |
| Mobile | Good | Poor (DIY) | Poor (DIY) | Full |
| Bundle impact | Moderate | ~80 KB gz | Heavy (moment) | Minimal |
| Time to working | Hours | Hours | Hours | 3–8 days |
| Risk | Preact core, 1 maintainer | Peer dep override | Bundle bloat | None |

## Open Questions

1. **@schedule-x React 19 concurrent mode**: Does `@preact/signals` interact correctly with React 19's `startTransition` / concurrent rendering when the view switches? Test with a minimal reproduction before committing. Check https://github.com/schedule-x/schedule-x/issues.

2. **temporal-polyfill version conflict**: After `npm install @schedule-x/calendar`, run `npm ls temporal-polyfill` to confirm exactly `0.3.0` and no version conflict with other packages.

3. **FullCalendar React 19 timeline**: Check https://github.com/fullcalendar/fullcalendar/issues for a PR/release that adds `^19` to peer deps. If merged, the `overrides` workaround becomes unnecessary.

4. **Supabase schema for appointments**: Is the `appointments` table already designed / migrated? The calendar UI research is complete; the blocker may now be the database schema. See FR-010–014 in `context/foundation/prd.md`.

5. ~~**PRD scope reconciliation**~~ — Resolved: FR-011 updated to include month/week/day views as must-have. All three views are in scope for S-04. The custom weekly-only shortcut is no longer applicable.
