# ✅ FEATURES.md — Demo Build Checklist

> AI agents: this file IS loadable (small). Tick `[x]` ONLY after the feature is implemented **and verified
> in the browser (both AR/EN + dark mode for UI features)**. Never delete/reword items without user approval.
> Each section header names its module doc — load it before working on that section.

## Phase 0 — Foundation (`docs/map/foundation/*`)
- [x] F0.1 Tailwind v4 + shadcn/ui initialized, theme tokens (status palette) in `src/index.css`
- [x] F0.2 Dark/light mode with animated `ThemeToggle` (moon↔sun GSAP morph), persisted
- [x] F0.3 i18n AR (default, RTL) + EN, `LangSwitch`, fonts (IBM Plex Sans Arabic / Inter), `dir` switching
- [x] F0.4 `src/data/types.ts` + status flow + all fixtures (25 applications, consistent related entities)
- [x] F0.5 Simulated API layer (`simulateFetch`, query/mutation hooks) + `useDemoDataStore`
- [x] F0.6 `MorphIcon` engine + full icon set (nav, status, actions)
- [x] F0.7 Shared components: `DataTable` (sort/filter/search/paginate/select/actions), `StatusBadge`, `StatCard`, `Timeline`, `PageHeader`, `EmptyState`
- [x] F0.8 Layouts + routing: portal layout, admin sidebar layout, page transitions (Framer Motion)

## Module 1 — Application Portal (`modules/01-application-portal.md`)
- [x] F1.1 Landing page (hero, journey steps, eligibility cards, CTAs)
- [x] F1.2 Wizard step 1–2: personal + project forms (zod + RHF, localized errors)
- [x] F1.3 Wizard step 3: document uploads per kind w/ validation
- [x] F1.4 Wizard step 4: T&C scroll + electronic acceptance
- [x] F1.5 Wizard step 5: review & submit → ref number success screen; draft persistence between steps
- [x] F1.6 Track page: ref lookup, status stepper, timeline, missing-docs re-upload, interview info

## Module 2 — Workflow (`modules/02-workflow-management.md`)
- [x] F2.1 Applications DataTable with status tabs + counts, filters, bulk actions
- [x] F2.2 Application detail page with all tabs + quick-actions header
- [x] F2.3 Status transition engine (allowed transitions only, confirm dialog + reason, timeline event)
- [x] F2.4 Documents tab: preview dialog, mark-missing → `incomplete` flow

## Module 3 — Screening & Scoring (`modules/03-screening-scoring.md`)
- [x] F3.1 Completeness check + eligibility rules checklist UI
- [x] F3.2 Weighted ScoreCard: gauge, criteria bars, verdict, recalculate animation
- [x] F3.3 Settings: editable criteria weights → live re-scoring

## Module 4 — Interviews (`modules/04-interviews.md`)
- [x] F4.1 Interviews list + week calendar view
- [x] F4.2 Schedule dialog (slots, interviewer, fake meet link) → `awaiting_interview` + notification
- [x] F4.3 Notes sheet with verdict chips + recommendation; done/no-show handling

## Module 5 — Contracts & E-sign (`modules/05-contracts-esign.md`)
- [x] F5.1 Contract auto-generation + official-looking preview (bilingual)
- [x] F5.2 Signing simulation: signature pad + OTP mock → signed state
- [x] F5.3 Contracts list + archive filter + print/PDF export

## Module 6 — Disbursement (`modules/06-disbursement.md`)
- [x] F6.1 Queue tabs (pending/ordered/paid) + KPI strip, masked IBAN
- [x] F6.2 Payment order dialog + bulk issue
- [x] F6.3 Mark-paid → app `disbursed` + notification + first follow-up scheduled

## Module 7 — Post-funding (`modules/07-post-funding.md`)
- [x] F7.1 Beneficiary follow-up form (mobile-first)
- [x] F7.2 Monitoring table: health badges, overdue, sparklines
- [x] F7.3 Project detail sheet: history, impact chart, photos, reminder + mark-defaulted actions

## Module 8 — Dashboard & Reports (`modules/08-dashboard-reports.md`)
- [x] F8.1 KPI row (6 stats, count-up, live-derived)
- [x] F8.2 Charts: status donut, timeline area, regions bar, disbursement bar, impact line
- [x] F8.3 Staff performance table + recent activity feed
- [x] F8.4 Reports page: filters, 4 report tabs, CSV + print export

## Module 9 — Notifications (`modules/09-notifications.md`)
- [x] F9.1 Trigger matrix wired into all store mutators + templates (AR/EN, interpolation)
- [x] F9.2 Admin bell + popover center (morph bell rings on new)
- [x] F9.3 Phone-frame SMS/WhatsApp preview dialog
- [x] F9.4 Beneficiary notifications list on `/track`; channel toggles in settings

## Polish (award pass)
- [x] P1 Skeletons/empty/error states everywhere; zero layout shift
- [x] P2 Full RTL audit (both languages, every page) + dark-mode audit
- [x] P3 Reduced-motion support; keyboard focus audit
- [x] P4 Demo script dry-run: full lifecycle walkthrough with no dead ends
