# Foundation — Tech Stack & Project Structure

Frontend-only demo. **No backend, no database.** All data is static fixtures served through
simulated async calls (TanStack Query + artificial latency). Purpose: show the client the final UX.

## Stack

| Concern | Tool | Notes |
|---|---|---|
| Build | Vite + React 19 + TypeScript | strict mode |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) + shadcn/ui | tokens in `src/index.css` |
| Animation | GSAP (icon path morphing) + Framer Motion (layout/page/element transitions) | see `icons-animation.md` |
| Forms | react-hook-form + zod (`@hookform/resolvers`) | schemas in `src/lib/schemas/` |
| Server-state | TanStack Query | `src/lib/api/` simulated endpoints |
| Tables | TanStack Table | one reusable `<DataTable>` (sort/filter/paginate/row-select/actions) |
| Client-state | zustand | `src/stores/` |
| Routing | react-router-dom v7 | route table below |
| i18n | i18next + react-i18next | AR (default, RTL) + EN; see `localization.md` |
| Toasts | sonner | |
| Charts | recharts (via shadcn charts) | dashboard only |

## Folder structure

```
src/
  app/                 # route pages (thin — compose features)
    portal/            # beneficiary-facing (apply, track, follow-up)
    admin/             # staff-facing (dashboard, applications, interviews, contracts, disbursement, reports)
  components/
    ui/                # shadcn primitives (generated — don't hand-edit heavily)
    shared/            # DataTable, StatusBadge, PageHeader, EmptyState, LangSwitch, ThemeToggle…
    icons/             # GSAP morph icon system (see icons-animation.md)
  features/<module>/   # module components (one folder per doc-map module)
  data/
    types.ts           # ALL entity types + status enums (single source of truth)
    fixtures/          # static demo data per entity
  lib/
    api/               # simulateFetch + per-module query fns & hooks
    schemas/           # zod schemas
    i18n/              # i18next setup + locales/{ar,en}.json
    utils.ts           # cn() etc.
  stores/              # zustand stores
```

## Route table

| Path | Page | Audience |
|---|---|---|
| `/` | Landing (program intro, CTA to apply) | public |
| `/apply` | Application wizard | beneficiary |
| `/track` | Track my application (by ID) | beneficiary |
| `/follow-up/:id` | Periodic follow-up form | beneficiary |
| `/admin` | Dashboard (KPIs) | staff |
| `/admin/applications` | Applications table + filters | staff |
| `/admin/applications/:id` | Application detail (tabs: data, docs, score, interview, contract, disbursement, follow-ups, timeline) | staff |
| `/admin/interviews` | Interview scheduling board | staff |
| `/admin/contracts` | Contracts list + e-sign preview | staff |
| `/admin/disbursements` | Disbursement queue | staff |
| `/admin/follow-up` | Post-funding monitoring | staff |
| `/admin/reports` | Reports & exports | staff |
| `/admin/settings` | Scoring criteria config, notification templates | staff |

## Conventions

- Path alias `@/` → `src/`.
- Components: PascalCase files; hooks `useX.ts`; fixtures typed with `satisfies`.
- Every user-facing string goes through i18n — **no hardcoded copy**.
- Simulated mutations update an in-memory store (zustand) so the demo feels live within a session.
