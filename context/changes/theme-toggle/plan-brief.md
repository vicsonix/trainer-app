# Theme Toggle — Plan Brief

> Full plan: `context/changes/theme-toggle/plan.md`

## What & Why

The trainer app currently follows the OS dark mode preference but gives the user no way to override it. S-11 wires a Sun/Moon toggle so the trainer can switch between light and dark independently of their OS setting, with the preference remembered across sessions.

## Starting Point

`next-themes@0.4.6` is already installed. Dark tokens are defined in `globals.css` inside a `@media (prefers-color-scheme: dark)` block. All `dark:` Tailwind classes are already authored throughout the app — zero styling work remains. No `ThemeProvider` wraps the app and no `dark` class is ever set on `<html>`.

## Desired End State

A Sun/Moon icon button sits at the bottom of the desktop sidebar and inside the mobile top bar button group. One click flips the theme; the choice survives a hard reload with no flash of the wrong theme. New users default to their OS preference.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Toggle states | Light ↔ dark (2 states) | Simpler mental model; no need to re-enable OS-following in this app |
| Default theme | System (follow OS) | Matches current behavior so existing users see no change on first load |
| Placement | Sidebar bottom + MobileHeader | Reachable on both breakpoints; consistent with where settings-style controls live |
| Toggle appearance | Icon only (Sun/Moon) | Compact, standard iconography, matches sidebar's icon-button pattern |
| FOUC prevention | next-themes built-in inline script | Library handles it via `suppressHydrationWarning` + script injection |

## Scope

**In scope:**
- `@variant dark` declaration in `globals.css` (class strategy)
- Move dark CSS variable block from media query to `.dark {}` selector
- `ThemeProvider` in root layout with `attribute="class"` + `suppressHydrationWarning`
- `src/components/ThemeToggle.tsx` — new Client Component
- Placement in `(app)/layout.tsx` sidebar and `MobileHeader.tsx`

**Out of scope:**
- Dark mode styling on any page (already complete)
- Toggle on login/register pages
- System option in the toggle cycle
- Server-side cookie persistence

## Architecture / Approach

next-themes manages the `dark` class on `<html>` via an injected inline script (FOUC-free). Tailwind's `@variant dark` directive re-targets all `dark:` utilities to fire on `.dark` ancestry instead of the OS media query. `ThemeToggle` reads `resolvedTheme` (handles the `system` default correctly) and calls `setTheme` on click.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Wire everything | ThemeProvider + CSS switch + toggle button + both placements | `@variant dark` syntax in Tailwind v4 — verify it compiles correctly |

**Prerequisites:** next-themes already installed ✓; all dark: classes already present ✓  
**Estimated effort:** ~1 session, 5 file edits

## Open Risks & Assumptions

- `@variant dark (&:where(.dark, .dark *))` is the correct Tailwind v4 CSS-first syntax — verify at build time; if the variant name conflicts, the fallback is `@custom-variant dark (...)`
- `resolvedTheme` is `undefined` on the server; the `ThemeToggle` must gate rendering behind a `mounted` flag to avoid hydration mismatch

## Success Criteria (Summary)

- Toggle is visible and functional on desktop (sidebar) and mobile (top bar)
- Theme persists across reload with no FOUC
- All existing pages render correctly in both themes
