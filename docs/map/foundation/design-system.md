# Foundation — Design System

Award-level polish. Professional fintech/government-grant aesthetic; warm, trustworthy, feminine-leaning
accents (program serves women entrepreneurs) without being stereotypical.

## Theming

- Tailwind v4 + shadcn tokens defined in `src/index.css` under `@theme` / CSS vars.
- **Light + dark mode** via `class` strategy; `ThemeToggle` in header; persisted in localStorage (`theme`).
- Primary: deep teal `oklch(0.45 0.09 190)`; accent: warm gold; status colors:
  `new` sky · `incomplete` amber · `under_review` violet · `awaiting_interview` cyan ·
  `approved` green · `rejected` red · `disbursed` teal · `follow_up` slate.
- Radius `0.75rem`; generous whitespace; cards with soft shadows (`shadow-sm`, hover `shadow-md`).

## Components

- shadcn/ui primitives in `src/components/ui/` — add via `npx shadcn@latest add <name>`.
  Needed set: button card input select textarea dialog sheet dropdown-menu badge tabs table form
  calendar popover progress avatar separator skeleton sonner tooltip switch checkbox radio-group chart sidebar breadcrumb.
- Shared components (`src/components/shared/`):
  - `DataTable` — TanStack Table wrapper: sorting, column filters, global search, pagination,
    row selection + bulk actions, row action menu. Fully RTL-aware. Reused by every admin list page.
  - `StatusBadge` — maps `ApplicationStatus` → color + translated label + morph icon.
  - `PageHeader`, `EmptyState`, `StatCard` (KPI tile with trend), `Timeline` (vertical, for application history).
- Admin layout: shadcn `sidebar` (collapsible, icons = GSAP morph icons) + breadcrumb header.
- Portal layout: top nav, hero landing, max-w container, mobile-first.

## Motion rules (Framer Motion)

- Page transitions: fade+slide 12px, 0.25s, `AnimatePresence` on route change.
- Lists/cards: stagger children 0.04s on first mount only.
- Dialogs/sheets: shadcn defaults (already animated) — don't double-animate.
- Numbers on dashboard: count-up on mount.
- Respect `prefers-reduced-motion`.

## Quality bar

- No layout shift on load — skeletons match final layout.
- Empty/loading/error states designed for every list & detail page.
- Keyboard focus visible; aria-labels on icon-only buttons.
