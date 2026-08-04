# ✅ FEATURES.md — Demo Build Checklist

> AI agents: this file IS loadable (small). Tick `[x]` ONLY after the feature is implemented **and verified
> in the browser (both AR/EN + dark mode for UI features)**. Never delete/reword items without user approval.
> Each section header names its module doc — load it before working on that section.

## Phase 0 — Foundation (`docs/map/foundation/*`)
- [ ] F0.1 Tailwind v4 + shadcn/ui initialized, theme tokens (status palette) in `src/index.css`
- [ ] F0.2 Dark/light mode with animated `ThemeToggle` (moon↔sun GSAP morph), persisted
- [ ] F0.3 i18n AR (default, RTL) + EN, `LangSwitch`, fonts (IBM Plex Sans Arabic / Inter), `dir` switching
- [ ] F0.4 `src/data/types.ts` + status flow + all fixtures (25 applications, consistent related entities)
- [ ] F0.5 Simulated API layer (`simulateFetch`, query/mutation hooks) + `useDemoDataStore`
- [ ] F0.6 `MorphIcon` engine + full icon set (nav, status, actions)
- [ ] F0.7 Shared components: `DataTable` (sort/filter/search/paginate/select/actions), `StatusBadge`, `StatCard`, `Timeline`, `PageHeader`, `EmptyState`
- [ ] F0.8 Layouts + routing: portal layout, admin sidebar layout, page transitions (Framer Motion)

## Module 1 — Application Portal (`modules/01-application-portal.md`)
- [ ] F1.1 Landing page (hero, journey steps, eligibility cards, CTAs)
- [ ] F1.2 Wizard step 1–2: personal + project forms (zod + RHF, localized errors)
- [ ] F1.3 Wizard step 3: document uploads per kind w/ validation
- [ ] F1.4 Wizard step 4: T&C scroll + electronic acceptance
- [ ] F1.5 Wizard step 5: review & submit → ref number success screen; draft persistence between steps
- [ ] F1.6 Track page: ref lookup, status stepper, timeline, missing-docs re-upload, interview info

## Module 2 — Workflow (`modules/02-workflow-management.md`)
- [ ] F2.1 Applications DataTable with status tabs + counts, filters, bulk actions
- [ ] F2.2 Application detail page with all tabs + quick-actions header
- [ ] F2.3 Status transition engine (allowed transitions only, confirm dialog + reason, timeline event)
- [ ] F2.4 Documents tab: preview dialog, mark-missing → `incomplete` flow

## Module 3 — Screening & Scoring (`modules/03-screening-scoring.md`)
- [ ] F3.1 Completeness check + eligibility rules checklist UI
- [ ] F3.2 Weighted ScoreCard: gauge, criteria bars, verdict, recalculate animation
- [ ] F3.3 Settings: editable criteria weights → live re-scoring

## Module 4 — Interviews (`modules/04-interviews.md`)
- [ ] F4.1 Interviews list + week calendar view
- [ ] F4.2 Schedule dialog (slots, interviewer, fake meet link) → `awaiting_interview` + notification
- [ ] F4.3 Notes sheet with verdict chips + recommendation; done/no-show handling

## Module 5 — Contracts & E-sign (`modules/05-contracts-esign.md`)
- [ ] F5.1 Contract auto-generation + official-looking preview (bilingual)
- [ ] F5.2 Signing simulation: signature pad + OTP mock → signed state
- [ ] F5.3 Contracts list + archive filter + print/PDF export

## Module 6 — Disbursement (`modules/06-disbursement.md`)
- [ ] F6.1 Queue tabs (pending/ordered/paid) + KPI strip, masked IBAN
- [ ] F6.2 Payment order dialog + bulk issue
- [ ] F6.3 Mark-paid → app `disbursed` + notification + first follow-up scheduled

## Module 7 — Post-funding (`modules/07-post-funding.md`)
- [ ] F7.1 Beneficiary follow-up form (mobile-first)
- [ ] F7.2 Monitoring table: health badges, overdue, sparklines
- [ ] F7.3 Project detail sheet: history, impact chart, photos, reminder + mark-defaulted actions

## Module 8 — Dashboard & Reports (`modules/08-dashboard-reports.md`)
- [ ] F8.1 KPI row (6 stats, count-up, live-derived)
- [ ] F8.2 Charts: status donut, timeline area, regions bar, disbursement bar, impact line
- [ ] F8.3 Staff performance table + recent activity feed
- [ ] F8.4 Reports page: filters, 4 report tabs, CSV + print export

## Module 9 — Notifications (`modules/09-notifications.md`)
- [ ] F9.1 Trigger matrix wired into all store mutators + templates (AR/EN, interpolation)
- [ ] F9.2 Admin bell + popover center (morph bell rings on new)
- [ ] F9.3 Phone-frame SMS/WhatsApp preview dialog
- [ ] F9.4 Beneficiary notifications list on `/track`; channel toggles in settings

## Polish (award pass)
- [ ] P1 Skeletons/empty/error states everywhere; zero layout shift
- [ ] P2 Full RTL audit (both languages, every page) + dark-mode audit
- [ ] P3 Reduced-motion support; keyboard focus audit
- [ ] P4 Demo script dry-run: full lifecycle walkthrough with no dead ends
