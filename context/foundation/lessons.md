# Lessons

Recurring rules accepted by the team. Every implementation run must internalize these before writing any code.

---

## Component Directory Convention

shadcn/ui generated components live in `src/components/ui/` (the default shadcn output path). Hand-written application components go directly in `src/components/` — not nested inside `ui/`.

This keeps generated/third-party UI primitives visually separated from custom business components so it is immediately clear which files are owned vs. scaffolded.

---

## Color Palette

Five custom families registered as Tailwind utilities via `@theme inline` in `src/app/globals.css`. Use these — do not reach for generic Tailwind colors (zinc, slate, gray, etc.).

| Family | Token prefix | Role |
|---|---|---|
| Lobster Pink | `lobster-pink-*` | Primary actions, brand accent, focus rings |
| Soft Linen | `soft-linen-*` | Backgrounds, warm neutrals, input fills |
| Carbon Black | `carbon-black-*` | Text, dark mode surfaces |
| Jungle Teal | `jungle-teal-*` | Secondary accent, success states |
| Tiger Orange | `tiger-orange-*` | Gradient accents, warnings, energy highlights |

**Semantic token mapping** (defined in `globals.css` `:root`):

| Token | Light | Dark |
|---|---|---|
| `--background` | soft-linen-50 `#f7f4ee` | carbon-black-950 `#111212` |
| `--foreground` | carbon-black-900 `#191a1a` | soft-linen-50 `#f7f4ee` |
| `--primary` | lobster-pink-500 `#d22d3d` | lobster-pink-400 `#db5764` |
| `--primary-foreground` | white | white |
| `--muted` | soft-linen-100 `#efe9dc` | carbon-black-800 `#313335` |
| `--muted-foreground` | carbon-black-500 `#7c8083` | carbon-black-400 `#96999c` |
| `--border` | soft-linen-200 `#ded3ba` | carbon-black-700 `#4a4d4f` |
| `--input` | soft-linen-300 `#cebe97` | carbon-black-800 `#313335` |
| `--ring` | lobster-pink-400 `#db5764` | lobster-pink-500 `#d22d3d` |
| `--accent` | jungle-teal-100 `#e0ebe7` | jungle-teal-900 `#141f1b` |
| `--destructive` | lobster-pink-600 `#a82431` | lobster-pink-300 `#e4818b` |

---

## UI Styling Patterns

### Page backgrounds
Full-height pages use a solid `bg-soft-linen-50 dark:bg-carbon-black-950` base with **blurred color blobs** for depth. Standard blob set:

```tsx
<div className="absolute -top-28 -left-28 w-96 h-96 rounded-full bg-lobster-pink-300 dark:bg-lobster-pink-700 opacity-30 dark:opacity-20 blur-3xl" />
<div className="absolute -top-10 -right-16 w-72 h-72 rounded-full bg-jungle-teal-300 dark:bg-jungle-teal-600 opacity-25 dark:opacity-20 blur-3xl" />
<div className="absolute -bottom-20 -left-12 w-80 h-80 rounded-full bg-tiger-orange-200 dark:bg-tiger-orange-600 opacity-30 dark:opacity-15 blur-3xl" />
<div className="absolute -bottom-10 -right-10 w-64 h-64 rounded-full bg-lobster-pink-200 dark:bg-lobster-pink-800 opacity-25 dark:opacity-20 blur-3xl" />
<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-64 rounded-full bg-soft-linen-300 dark:bg-carbon-black-800 opacity-40 dark:opacity-30 blur-3xl" />
```

The page wrapper must be `relative overflow-hidden`; content goes in a `relative z-10` child.

### Cards / form containers
Use glass-morphism: semi-transparent background + backdrop blur + frosted border.

```tsx
<div className="rounded-2xl border border-white/60 dark:border-carbon-black-700/60 shadow-xl overflow-hidden bg-white/70 dark:bg-carbon-black-900/70 backdrop-blur-md">
```

Top accent stripe on cards (lobster-pink → tiger-orange gradient):
```tsx
<div className="h-1 bg-gradient-to-r from-lobster-pink-600 via-lobster-pink-400 to-tiger-orange-400" />
```

### Inputs inside glass cards
Semi-transparent fill to maintain the layered feel:
```tsx
className="h-11 px-3 bg-white/60 dark:bg-carbon-black-800/60 border-soft-linen-300 dark:border-carbon-black-600"
```

### Primary buttons
Use `bg-primary text-primary-foreground` (lobster-pink) with `hover:bg-lobster-pink-600`.

### Brand logo mark
Rounded square with lobster-pink gradient, used as the app icon on auth pages:
```tsx
<div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-lobster-pink-400 to-lobster-pink-700 flex items-center justify-center shadow-lg">
  <span className="text-white font-bold text-2xl tracking-tight">T</span>
</div>
```
