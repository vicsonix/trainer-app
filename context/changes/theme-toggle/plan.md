# Theme Toggle — Implementation Plan

## Overview

Add a light/dark theme toggle so the trainer can override the OS preference and have their choice persisted across sessions. `next-themes` is already installed; the work is wiring it up and placing a Sun/Moon icon button in the sidebar and mobile header.

## Current State Analysis

`globals.css` drives dark mode via `@media (prefers-color-scheme: dark)` — the user has no control. All `dark:` Tailwind utility classes are already authored throughout the codebase. `next-themes@0.4.6` is installed but only `useTheme()` is referenced in `sonner.tsx`; no `ThemeProvider` wraps the app and no `dark` class is ever set on `<html>`.

## Desired End State

A Sun/Moon icon button appears at the bottom of the desktop sidebar (between the email line and logout) and in the `MobileHeader` button group. Clicking it toggles between light and dark. The preference is persisted in `localStorage` and applied on next load without a flash of the wrong theme. New users (no saved preference) follow the OS setting.

### Key Discoveries

- `globals.css:27-49` — dark tokens live inside `@media (prefers-color-scheme: dark)`; must move to `.dark {}` selector
- Tailwind v4 uses `@variant dark (...)` in CSS to switch dark mode strategy from media-query to class
- `src/app/layout.tsx:27` — `<html>` has no `suppressHydrationWarning`; next-themes requires it to avoid hydration mismatch
- `src/app/(app)/layout.tsx:61-73` — sidebar bottom section (email + logout form) is the insertion point for the desktop toggle
- `src/components/MobileHeader.tsx:21-38` — `div.flex.items-center.gap-1.5` is the button group for the mobile toggle
- `useTheme().resolvedTheme` (not `theme`) gives the actual active theme when `defaultTheme="system"`

## What We're NOT Doing

- No changes to any page's dark mode styling — all `dark:` classes are already in place
- No system/OS option in the toggle cycle — two states only (light ↔ dark)
- No theme switcher on the login/register pages — auth pages already respect OS via CSS media query and that's fine
- No animation or transition on theme switch (`disableTransitionOnChange` keeps it instant)
- No server-side cookie persistence — localStorage is sufficient for a single-user trainer app

## Implementation Approach

1. Update `globals.css` to declare the class-based dark variant and move the dark token block from the media query to a `.dark {}` selector.
2. Wrap the root layout with `ThemeProvider` (attribute="class", defaultTheme="system") and add `suppressHydrationWarning` to `<html>`.
3. Create `src/components/ThemeToggle.tsx` — a Client Component that reads `resolvedTheme` and calls `setTheme`.
4. Import and render `<ThemeToggle />` in the sidebar bottom and in `MobileHeader`.

---

## Phase 1: Wire ThemeProvider, CSS, Toggle Component, and Placement

### Overview

All four changes ship together: the CSS and ThemeProvider are prerequisites for the toggle to work, and the toggle component and placements are the visible deliverable.

### Changes Required

#### 1. globals.css — class-based dark variant + move dark tokens

**File**: `src/app/globals.css`

**Intent**: Switch Tailwind's dark variant from the OS media query to the `dark` class that next-themes will manage, and move the CSS variable block accordingly.

**Contract**: After `@import "tailwindcss"` (line 1), add:

```css
@variant dark (&:where(.dark, .dark *));
```

Replace the entire `@media (prefers-color-scheme: dark) { :root { … } }` block (lines 27–49) with:

```css
.dark {
  --background: #111212;
  --foreground: #f7f4ee;
  --card: #191a1a;
  --card-foreground: #f7f4ee;
  --popover: #191a1a;
  --popover-foreground: #f7f4ee;
  --primary: #db5764;
  --primary-foreground: #ffffff;
  --secondary: #313335;
  --secondary-foreground: #efe9dc;
  --muted: #313335;
  --muted-foreground: #96999c;
  --accent: #141f1b;
  --accent-foreground: #a2c3b8;
  --destructive: #e4818b;
  --border: #4a4d4f;
  --input: #313335;
  --ring: #d22d3d;
  --event-hover: #252829;
}
```

---

#### 2. Root layout — ThemeProvider + suppressHydrationWarning

**File**: `src/app/layout.tsx`

**Intent**: Wrap the app in `ThemeProvider` so next-themes can manage the `dark` class on `<html>` and inject its FOUC-prevention inline script.

**Contract**: Import `ThemeProvider` from `next-themes`. Add `suppressHydrationWarning` to the `<html>` tag (next-themes sets the class before React hydrates — without this flag React warns about a class mismatch). Wrap `{children}` (and `<Toaster />`) with:

```tsx
<ThemeProvider attribute="class" defaultTheme="system" disableTransitionOnChange>
  {children}
  <Toaster />
</ThemeProvider>
```

`disableTransitionOnChange` prevents CSS transition flicker during the theme switch.

---

#### 3. ThemeToggle component

**File**: `src/components/ThemeToggle.tsx` (new file)

**Intent**: Client Component that reads the resolved theme and toggles between light and dark on click, styled to match the sidebar's existing icon-button pattern.

**Contract**: Named export `ThemeToggle`. Uses `useTheme()` from `next-themes` — specifically `resolvedTheme` (not `theme`) so it works correctly when `defaultTheme="system"`. Clicking sets theme to `'light'` if currently dark, `'dark'` if currently light. Renders a `Sun` icon (lucide-react) in dark mode, `Moon` in light mode. Button must have `aria-label="Przełącz motyw"`. Style to match the logout button in the sidebar: `rounded-lg px-3 py-2 text-sm text-carbon-black-600 hover:bg-soft-linen-100 dark:text-carbon-black-300 dark:hover:bg-carbon-black-800 transition-colors`. Since `resolvedTheme` is `undefined` on the server, render `null` until mounted (use a `mounted` state flag via `useEffect`).

---

#### 4. Sidebar — desktop toggle placement

**File**: `src/app/(app)/layout.tsx`

**Intent**: Add the toggle to the sidebar bottom section so desktop users can reach it alongside logout.

**Contract**: Import `ThemeToggle` from `@/components/ThemeToggle`. In the sidebar bottom `<div>` (the one with `border-t … p-3 space-y-2`, line 61), add `<ThemeToggle />` as the first child, before the email `<p>` and logout `<form>`.

---

#### 5. MobileHeader — mobile toggle placement

**File**: `src/components/MobileHeader.tsx`

**Intent**: Add the toggle to the right-side button group in the mobile top bar.

**Contract**: Import `ThemeToggle` from `@/components/ThemeToggle`. In the `div.flex.items-center.gap-1.5` (line 21), add `<ThemeToggle />` between the Asystent button and the logout form.

---

### Success Criteria

#### Automated Verification

- TypeScript compilation passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Build completes without error: `npm run build`

#### Manual Verification

- Sun/Moon toggle button is visible in the desktop sidebar (bottom section) and in the mobile top bar
- Clicking the toggle switches between light and dark mode immediately
- Theme preference persists across page reload (localStorage)
- First load with no saved preference matches the OS setting (system default)
- No flash of wrong theme on reload when a preference is saved
- Analytics, calendar, clients, and dashboard pages all render correctly in both themes
- `sonner.tsx` toast notifications still render correctly in both themes

**Implementation Note**: After completing this phase and automated checks pass, pause for manual confirmation before considering the change done.

---

## Testing Strategy

### Manual Testing Steps

1. Open `/dashboard` in a browser with no saved theme preference. Confirm it matches your OS setting.
2. Click the toggle — confirm the theme flips immediately.
3. Hard-reload — confirm the chosen theme is restored without flicker.
4. Switch OS dark mode — when no localStorage preference is set, confirm the app follows. When a preference is set, confirm the app ignores the OS change.
5. Resize to mobile — confirm the toggle is visible and functional in the top bar.
6. Navigate to every main page (dashboard, analytics, calendar, clients, packages, assistant) — confirm no styling regressions in either theme.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-11)
- next-themes: `node_modules/next-themes`
- Globals CSS: `src/app/globals.css:1-49`
- Root layout: `src/app/layout.tsx`
- App layout: `src/app/(app)/layout.tsx:61-73`
- Mobile header: `src/components/MobileHeader.tsx:21-38`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Wire ThemeProvider, CSS, Toggle Component, and Placement

#### Automated

- [x] 1.1 TypeScript compilation passes: `npx tsc --noEmit`
- [x] 1.2 Linting passes: `npm run lint`
- [x] 1.3 Build completes without error: `npm run build`

#### Manual

- [x] 1.4 Toggle visible in desktop sidebar and mobile header
- [x] 1.5 Clicking toggle switches theme immediately
- [x] 1.6 Theme persists across page reload
- [x] 1.7 First load with no preference follows OS setting
- [x] 1.8 No flash of wrong theme on reload
- [x] 1.9 No styling regressions on any page in either theme
- [x] 1.10 Toast notifications render correctly in both themes
