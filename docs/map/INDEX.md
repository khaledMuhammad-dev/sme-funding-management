# 🗺️ Doc Map Index — SME Funding Management Platform (Demo)

> **How to use this file (AI agents):** This is the ONLY doc you load first. Find your task's module below,
> then load ONLY the listed files. NEVER read `docs/business/*` (full docs, hook-blocked, humans only).

## Foundation docs (load per the rules in CLAUDE.md)

| File | Load when the task touches… |
|---|---|
| `docs/map/foundation/tech-stack.md` | project setup, build, folder structure, routing |
| `docs/map/foundation/design-system.md` | any UI work, theming, dark mode, shadcn components |
| `docs/map/foundation/localization.md` | any user-facing text, RTL, fonts, language switch |
| `docs/map/foundation/data-model.md` | any data, fixtures, TanStack Query simulation |
| `docs/map/foundation/state-management.md` | zustand stores, cross-page state, filters |
| `docs/map/foundation/icons-animation.md` | icons, GSAP morph, Framer Motion transitions |

## Module docs

| # | Module | File | Depends on modules | Foundation needed |
|---|---|---|---|---|
| 1 | Application Portal (بوابة التقديم) | `modules/01-application-portal.md` | 2 (statuses), 9 (notify) | data-model, localization, design-system |
| 2 | Workflow & Application Management | `modules/02-workflow-management.md` | 1, 3, 9 | data-model, state-management |
| 3 | Auto Screening & Scoring | `modules/03-screening-scoring.md` | 2 | data-model |
| 4 | Interviews (المقابلات) | `modules/04-interviews.md` | 2, 9 | data-model, localization |
| 5 | Contracts & E-Signature | `modules/05-contracts-esign.md` | 2, 9 | data-model |
| 6 | Disbursement (الصرف المالي) | `modules/06-disbursement.md` | 2, 5, 9 | data-model |
| 7 | Post-Funding Follow-up | `modules/07-post-funding.md` | 2, 6, 9 | data-model |
| 8 | Dashboard & Reports | `modules/08-dashboard-reports.md` | 2, 3, 6, 7 | data-model, design-system (charts) |
| 9 | Notifications & Automation | `modules/09-notifications.md` | all (consumer) | data-model, localization |

## Loading recipe (keeps context small)

1. Read `CLAUDE.md` rules (auto-loaded) + this INDEX.
2. Read the ONE module file for your task.
3. Read ONLY the foundation files listed for that module in the table above.
4. If your module's "Depends on" section references a contract from another module
   (e.g. status enum, score shape), that contract is **repeated inline** in each module file —
   you normally do NOT need to open the other module.
5. Check `docs/FEATURES.md` for the exact checklist items you're implementing; tick them when done & verified.

## Shared contracts (single source of truth)

- **Status enum, all entity types, fixtures** → `foundation/data-model.md` (+ code: `src/data/types.ts`, `src/data/fixtures/`)
- **Route table** → `foundation/tech-stack.md`
- **Design tokens / theme** → `foundation/design-system.md` (+ code: `src/index.css`)
- **Translation keys convention** → `foundation/localization.md`
