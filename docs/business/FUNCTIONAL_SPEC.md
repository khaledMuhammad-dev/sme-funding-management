# 📗 Functional Specification — SME Funding Management Platform (Demo)

> **⚠️ HUMAN-ONLY DOCUMENT.** AI agents must NOT load this file (hook-enforced). AI agents use `docs/map/INDEX.md` + the per-module files instead.
> This document is **assembled from** `docs/map/` (foundation + modules) — those files are the source of truth.
> To regenerate after editing map files: `bash docs/build-spec.sh`

**Version:** 1.0 · **Date:** 2026-08-05

---

# Part A — Foundation

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


---

# Foundation — Design System

Award-level polish. Professional fintech/government-grant aesthetic; warm and trustworthy
accents without being stereotypical.

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


---

# Foundation — Localization (AR default / EN)

## Setup

- i18next + react-i18next + browser-languagedetector; persisted in localStorage (`lang`).
- **Arabic is the default** language and the primary demo language (client is Arabic-speaking).
- Locale files: `src/lib/i18n/locales/ar.json`, `en.json`. Nested keys by module:
  `common.*`, `landing.*`, `apply.*`, `track.*`, `admin.nav.*`, `applications.*`, `status.*`,
  `scoring.*`, `interviews.*`, `contracts.*`, `disbursement.*`, `followUp.*`, `reports.*`, `notifications.*`, `validation.*`.

## RTL

- `<html dir>` + `lang` switch on language change (effect in `I18nProvider`).
- Tailwind: use **logical properties** (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`) — never `ml/mr/pl/pr/left/right` for layout.
- Directional icons (chevrons/arrows) flip with `rtl:rotate-180` where semantically needed.
- DataTable, sidebar, sheets must be verified in both directions.

## Fonts

- Arabic: **IBM Plex Sans Arabic** (weights 400/500/600/700).
- English: **Inter** (400/500/600/700).
- Self-host via `@fontsource/ibm-plex-sans-arabic` + `@fontsource-variable/inter` (no CDN flicker).
- `font-family` switches by `:lang()` / html[lang] CSS: `html[lang='ar'] { font-family: 'IBM Plex Sans Arabic', … }`.

## Rules

- Every user-visible string via `t()`. Zod error messages localized through `validation.*` keys
  (pass `t` into schema factory functions: `makeApplySchema(t)`).
- Numbers: keep Western digits (٠١٢ not required); currency `SAR` formatted with `Intl.NumberFormat(locale, {style:'currency', currency:'SAR'})`.
- Dates: `Intl.DateTimeFormat` with active locale.
- `LangSwitch` component in both layouts (portal header + admin sidebar footer).


---

# Foundation — Data Model & Simulated API (single source of truth)

Code lives in `src/data/types.ts` + `src/data/fixtures/`. If this doc and code disagree, fix the code.

## Status enum (used everywhere — DO NOT invent new statuses)

```ts
export type ApplicationStatus =
  | 'new'            // جديد
  | 'incomplete'     // ناقص
  | 'under_review'   // تحت الدراسة
  | 'awaiting_interview' // بانتظار المقابلة
  | 'approved'       // معتمد
  | 'rejected'       // مرفوض
  | 'disbursed'      // تم الصرف
  | 'follow_up';     // متابعة
```

Allowed transitions: `new → incomplete|under_review` · `incomplete → under_review` ·
`under_review → awaiting_interview|rejected` · `awaiting_interview → approved|rejected` ·
`approved → disbursed` · `disbursed → follow_up`. Encode in `src/data/statusFlow.ts`.

## Core entities (abridged — full shapes in `src/data/types.ts`)

```ts
interface Beneficiary { id; fullName; nationalId; phone; email; region; city; iban; hasCommercialRegister; commercialRegisterNo? }
interface Application {
  id; ref: string;              // e.g. 'APP-2026-0042'
  beneficiary: Beneficiary;
  project: { name; sector; description; requestedAmount; monthlyIncome; experienceYears };
  documents: UploadedDoc[];     // kind: 'national_id'|'iban_cert'|'commercial_register'|'feasibility_study'|'photos'
  termsAccepted: boolean;
  status: ApplicationStatus;
  score?: ScoreCard;
  timeline: TimelineEvent[];    // every status change + notification, with timestamps
  createdAt; updatedAt;
}
interface ScoreCard { total: number /*0-100*/; verdict: 'eligible'|'ineligible'|'manual_review';
  criteria: { key: CriterionKey; label; weight; value: number }[] }
type CriterionKey = 'income_stability'|'project_experience'|'seriousness'|'repayment_ability'|'data_completeness';
interface Interview { id; applicationId; scheduledAt; meetingUrl; status: 'scheduled'|'done'|'no_show'; notes?; interviewer }
interface Contract { id; applicationId; templateId; status: 'draft'|'sent'|'signed'; signedAt?; pdfUrl /* fake */ }
interface Disbursement { id; applicationId; orderNo; amount; status: 'pending'|'ordered'|'paid'; paidAt? }
interface FollowUp { id; applicationId; dueDate; submittedAt?; performance: { revenue; employees; growthPct };
  photos: string[]; healthStatus: 'on_track'|'at_risk'|'defaulted'; notes? }
interface AppNotification { id; applicationId; channel: 'sms'|'whatsapp'|'email';
  trigger: 'received'|'incomplete'|'interview_scheduled'|'approved'|'rejected'|'contract_signed'|'disbursed'|'follow_up_due';
  body; sentAt }
```

## Fixtures

- `fixtures/applications.ts` — **25 applications** spread across ALL statuses & regions (Riyadh, Jeddah, Dammam, Abha, Madinah…), realistic Arabic names & project types (home bakery, tailoring, beauty salon, catering, crafts, online store…).
- Each disbursed app has 1–3 follow-ups; ≥2 projects `at_risk`, 1 `defaulted`.
- `fixtures/notifications.ts`, `fixtures/interviews.ts`, `fixtures/contracts.ts`, `fixtures/disbursements.ts` consistent with application statuses.
- Deterministic IDs/dates (no `Math.random()` at module top-level) so UI is stable between reloads.

## Simulated API layer (`src/lib/api/`)

```ts
// simulateFetch.ts
export async function simulateFetch<T>(data: T, opts?: { delayMs?: number; failRate?: number }): Promise<T>
// default delay 400–800ms; failRate 0 (keep 0 for client demo)
```

- Per-module hooks: `useApplications(filters)`, `useApplication(id)`, `useUpdateStatus()`, `useScheduleInterview()`, …
- Mutations write to `useDemoDataStore` (zustand) — the fixtures are its initial state — then invalidate queries. Session-persistent only (no localStorage for data; localStorage only for theme+lang).
- Query keys: `['applications', filters]`, `['application', id]`, `['interviews']`, etc.


---

# Foundation — State Management (zustand)

Server-ish data lives in TanStack Query (see `data-model.md`). Zustand holds **client/UI state + the demo's in-memory "database"**.

## Stores (`src/stores/`)

| Store | State | Notes |
|---|---|---|
| `useDemoDataStore` | `applications, interviews, contracts, disbursements, followUps, notifications` + mutator actions (`updateStatus`, `addApplication`, `scheduleInterview`, `signContract`, `issueDisbursement`, `submitFollowUp`, `pushNotification`) | Initialized from fixtures. The simulated API reads/writes here. Every mutator also appends a `TimelineEvent` and auto-creates the matching `AppNotification` (see module 09). |
| `useUiStore` | `theme ('light'|'dark')`, `lang ('ar'|'en')`, `sidebarCollapsed` | theme+lang persisted (zustand `persist`, localStorage) |
| `useApplyWizardStore` | current step, draft form values per step | lets the wizard survive step navigation; cleared on submit |
| `useSettingsStore` | scoring criteria weights (editable in admin settings), notification template toggles | demo of "customizable criteria" |

## Rules

- Components never mutate `useDemoDataStore` directly — always through the simulated API mutation hooks
  (`src/lib/api/*`), so TanStack Query invalidation stays correct and latency is simulated.
- Selectors: subscribe narrowly (`useDemoDataStore(s => s.applications)`) to avoid re-renders.
- No data persistence across reloads (fresh demo each load) — only theme/lang persist.


---

# Foundation — Icon System (GSAP path morph) & Animation

## Icon system (`src/components/icons/`)

Every app icon (nav, status, actions) is a **custom inline SVG with raw `<path d>` data** so GSAP can
morph between states. Do NOT use lucide components for these (lucide is only a fallback inside shadcn primitives).

### Contract

```tsx
// MorphIcon.tsx — the single engine component
interface MorphIconProps {
  paths: { idle: string; active: string };  // same number of points preferred
  active?: boolean;      // morphs to active shape + accent color when true (e.g. current nav route)
  size?: number;         // default 20
  strokeWidth?: number;  // default 1.8; icons are stroke-based, fill="none", viewBox 0 0 24 24
  className?: string;
}
```

- Engine: `gsap` + `MorphSVGPlugin` (free since GSAP 3.13 — `import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin'`, register once in `src/lib/gsap.ts`).
- Behavior: on `hover` → morph idle→active (0.35s, `power2.out`) and back on leave;
  when `active` prop is true → stay morphed (skip hover reversal).
- Each concrete icon is a thin wrapper exporting its two path sets:
  `HomeIcon, ApplicationsIcon, InterviewIcon, ContractIcon, DisbursementIcon, FollowUpIcon,
  ReportsIcon, SettingsIcon, BellIcon, UserIcon, SearchIcon, MoonSunIcon (theme toggle morphs moon↔sun),
  LangIcon, CheckIcon, XIcon, ClockIcon, DocumentIcon, UploadIcon` — status icons for `StatusBadge` too.
- Design idle/active pairs to be meaningfully different (e.g. bell → bell-ringing with waves;
  document → document-with-check). Author both paths with the same point count where possible for clean morphs.
- Respect `prefers-reduced-motion`: snap-swap paths instead of tweening.

## Framer Motion usage

- Route transitions, list stagger, KPI count-up, wizard step slide (direction-aware: RTL flips slide direction).
- Never animate the same element with both GSAP and Framer Motion.
- GSAP is ONLY for SVG path morphing; Framer Motion for everything else.


---

# Part B — Functional Modules

# Module 01 — Application Portal (بوابة التقديم الإلكترونية)

**Audience:** beneficiary (المستفيد). **Routes:** `/`, `/apply`, `/track`.
**Load with:** `foundation/data-model.md`, `foundation/localization.md`, `foundation/design-system.md`.

## Purpose
Public portal where a woman entrepreneur applies for funding, uploads documents, accepts terms,
and tracks her application status.

## Screens & behaviors

### 1. Landing `/`
- Hero (program value prop, AR-first), steps-of-journey section (4 steps with morph icons),
  eligibility summary cards, CTA → `/apply`, secondary CTA → `/track`.

### 2. Application wizard `/apply` — 5 steps (`useApplyWizardStore` keeps drafts between steps)
1. **Personal** — fullName, nationalId (10 digits, starts 1/2), phone (+9665…), email, region (select), city.
2. **Project** — name, sector (select), description, requestedAmount (5k–200k SAR), monthlyIncome, experienceYears.
3. **Documents** — upload dropzones per kind: `national_id`, `iban_cert`, `commercial_register` (only if `hasCommercialRegister`), `feasibility_study`, `photos` (multi). Demo: accept file, store name+size only, show preview chip. Validate required kinds present.
4. **Terms** — scrollable T&C (static AR/EN text), checkbox "أوافق على الشروط والأحكام" required.
5. **Review & submit** — read-only summary of all steps, edit links back to steps, submit button.

- Validation: zod schema per step (`src/lib/schemas/apply.ts`, factory taking `t`), react-hook-form, errors inline.
- Submit → simulated mutation `useSubmitApplication()` → creates Application with `status:'new'`,
  generates ref `APP-2026-XXXX`, fires `received` notification → success screen showing **the ref number**
  ("save this to track your application") + confetti-lite motion.

### 3. Track `/track`
- Input for ref number → `useApplication(ref)` lookup. Unknown ref → friendly error.
- Result: status stepper (8 statuses, current highlighted, RTL-aware), timeline of events,
  documents state; if `incomplete` → list of missing items + "re-upload" simulated action;
  if `awaiting_interview` → show interview datetime + meeting link (module 04 provides the data — read it
  from the application's interview, don't re-derive).

## Dependencies (contracts used, defined elsewhere)
- Status enum + Application shape → `data-model.md` (module 02 owns transitions; portal only reads status).
- Notifications auto-created by `useDemoDataStore` mutators → module 09.

## Acceptance criteria
- Full flow AR + EN, RTL-perfect wizard (direction-aware step slide).
- Refresh mid-wizard keeps draft (store), submit clears it.
- Submitted application appears immediately in admin table (shared demo store).


---

# Module 02 — Application Management & Workflow (إدارة الطلبات وسير العمل)

**Audience:** staff. **Routes:** `/admin/applications`, `/admin/applications/:id`.
**Load with:** `foundation/data-model.md`, `foundation/state-management.md`, `foundation/design-system.md` (DataTable).

## Purpose
Staff manage the full application lifecycle through the 8-status workflow with automatic
beneficiary notifications on every transition. **This module owns the status flow.**

## Screens & behaviors

### 1. Applications list `/admin/applications`
- `<DataTable>` (shared component) columns: ref, beneficiary name, project name, sector, region,
  requestedAmount (SAR formatted), score (badge, — if unscored), status (`StatusBadge`), createdAt, actions.
- Out of the box: sort, per-column filter (status multi-select, region select, amount range), global search,
  pagination (10/25/50), row selection → bulk actions (e.g. bulk move `new → under_review`), row action menu
  (view, change status, schedule interview shortcut).
- Status filter tabs above table with live counts per status.

### 2. Application detail `/admin/applications/:id`
Tabs: **Data** (personal+project, editable read-only demo) · **Documents** (list w/ kind, fake preview dialog,
mark-missing action → sets `incomplete` + notification) · **Score** (module 03 panel) ·
**Interview** (module 04 panel) · **Contract** (module 05 panel) · **Disbursement** (module 06 panel) ·
**Follow-ups** (module 07 panel) · **Timeline** (vertical `Timeline` of all events).
- Header: ref, StatusBadge, beneficiary, quick actions bar with **allowed** next transitions only.

### 3. Status transition rules (owned here — `src/data/statusFlow.ts`)
```
new → incomplete | under_review
incomplete → under_review
under_review → awaiting_interview | rejected
awaiting_interview → approved | rejected
approved → disbursed        (via module 06 only)
disbursed → follow_up       (auto after first follow-up scheduled)
```
- Transition UI = dropdown of allowed targets + confirm dialog (reason textarea required for `rejected`/`incomplete`).
- Every transition: `useUpdateStatus()` → store mutator appends TimelineEvent + auto-notification (module 09) + sonner toast.

## Acceptance criteria
- Illegal transitions impossible from UI. Counts/tabs update live after mutation.
- Bulk action shows progress + result toast. Table state (filters/page) survives navigation via `useUiStore` or search params.


---

# Module 03 — Auto Screening & Scoring (الفرز والتقييم الآلي)

**Audience:** staff. **Surface:** Score tab in `/admin/applications/:id` + criteria config in `/admin/settings`.
**Load with:** `foundation/data-model.md`, `foundation/state-management.md`.

## Purpose
Automatic completeness check, eligibility rules, and a weighted score per applicant with
**customizable criteria weights**.

## Behaviors

### 1. Completeness check (runs on submit + on demand)
- All required fields present + all required document kinds uploaded + terms accepted.
- Fail → suggest `incomplete` status with the list of missing items (feeds module 02's transition dialog).

### 2. Eligibility rules (`src/features/scoring/eligibility.ts`)
Demo rules (pure functions, visible in UI as pass/fail checklist):
- Age of data: nationalId valid format · requestedAmount within 5k–200k ·
  monthlyIncome > 0 · experienceYears ≥ 0 · region within program coverage.
- Any hard-fail → verdict `ineligible` (UI shows which rule failed).

### 3. Weighted score (`ScoreCard` shape → data-model.md)
| Criterion key | Default weight |
|---|---|
| `income_stability` | 25 |
| `project_experience` | 20 |
| `seriousness` | 15 |
| `repayment_ability` | 25 |
| `data_completeness` | 15 |

- Each criterion scored 0–100 (deterministic demo formulas from application fields, e.g.
  experienceYears → project_experience curve). `total = Σ(weight% × value)`.
- Verdict: `total ≥ 70` eligible · `50–69` manual_review · `< 50` ineligible.
- Weights editable in `/admin/settings` (`useSettingsStore`); "Recalculate" button re-scores
  visibly (animated number + radar/bar breakdown chart).

### Score tab UI
- Big total gauge + verdict badge, criteria breakdown bars w/ weight chips, eligibility checklist,
  "Recalculate" + "Apply suggested status" (eligible → `under_review` fast-track hint).

## Acceptance criteria
- Changing weights in settings immediately changes recalculated totals (demo wow-moment).
- Scoring is deterministic — same input, same score.


---

# Module 04 — Interviews (المقابلات الإلكترونية)

**Audience:** staff (+ beneficiary sees her slot in `/track`). **Routes:** `/admin/interviews` + Interview tab in application detail.
**Load with:** `foundation/data-model.md`, `foundation/localization.md`.

## Purpose
Book interview slots, send meeting links, record notes — for applications in `under_review`/`awaiting_interview`.

## Screens & behaviors

### 1. Interviews board `/admin/interviews`
- Two views (tabs): **Upcoming list** (DataTable: applicant, datetime, interviewer, meeting link, status, actions)
  and **Week calendar** (shadcn calendar + slots column; click slot → schedule dialog).
- Filters: interviewer, status (`scheduled|done|no_show`), date range.

### 2. Schedule dialog (also reachable from application detail & applications-table row action)
- Pick application (searchable select of `under_review` apps) → date (calendar) → time slot (chips 9:00–16:00, 30min)
  → interviewer (select from static staff list) → auto-generated fake meeting URL (`https://meet.demo/xyz`).
- Confirm → `useScheduleInterview()`: creates Interview, transitions app to `awaiting_interview`
  (module 02 flow), fires `interview_scheduled` notification (module 09), toast + calendar refresh.

### 3. Interview execution
- On interview row: "Open meeting" (fake link), "Record notes" → sheet with rich textarea +
  quick verdict chips (متميزة/جيدة/تحتاج دعم) + recommendation radio (approve/reject/needs-info).
- Saving notes marks interview `done`; recommendation pre-fills the transition dialog in module 02.
- `no_show` action → keeps app in `awaiting_interview`, offers reschedule.

## Acceptance criteria
- Cannot double-book the same slot+interviewer. Beneficiary `/track` shows datetime + link once scheduled.
- All datetimes localized (AR/EN), calendar RTL-correct.


---

# Module 05 — Approval, Contracts & E-Signature (الاعتماد والتوقيع الإلكتروني)

**Audience:** staff (+ simulated beneficiary signing view). **Routes:** `/admin/contracts` + Contract tab in application detail.
**Load with:** `foundation/data-model.md`.

## Purpose
Auto-generate a funding contract for `approved` applications, simulate e-signature, "send" as PDF, archive.

## Screens & behaviors

### 1. Contracts list `/admin/contracts`
- DataTable: contract no, applicant, amount, created, status (`draft|sent|signed`), signedAt, actions
  (preview, send, open signing simulation, download PDF*).

### 2. Contract generation (from application detail, app must be `approved`)
- "Generate contract" → template merge: applicant name, nationalId, project, amount (in words + digits AR),
  repayment terms (static demo clauses), date (Hijri-style label optional, Gregorian value).
- Preview dialog: rendered contract (styled HTML page that looks like an official doc, bilingual header, program logo placeholder).

### 3. E-signature simulation
- "Send for signature" → status `sent` + `contract_signed`-pending notification.
- "Open signing view" → full-screen simulation of what the beneficiary sees: contract scroll,
  signature pad (canvas draw — pointer events, works with mouse/touch), OTP mock step (any 4 digits), confirm.
- On sign: status `signed`, signature image embedded in preview, timeline event, `contract_signed` notification.

### 4. PDF & archive
- *Download PDF: demo via `window.print()` on the styled contract view (print stylesheet) — no PDF lib needed;
  label it "تصدير PDF". Signed contracts move to "Archive" filter tab with search.

## Acceptance criteria
- Contract only generatable for `approved` apps; signing flow feels real (pad draws smoothly, RTL layout).
- After signing, Disbursement tab (module 06) unlocks its "transfer to finance" action.


---

# Module 06 — Financial Disbursement (إدارة الصرف المالي)

**Audience:** staff (finance role, demo — no auth). **Routes:** `/admin/disbursements` + Disbursement tab in application detail.
**Load with:** `foundation/data-model.md`.

## Purpose
Queue of approved+signed applications for finance: issue payment orders, mark paid, flip application status.

## Screens & behaviors

### 1. Disbursement queue `/admin/disbursements`
- Tabs by `Disbursement.status`: **Pending** (approved & contract signed, awaiting order) ·
  **Ordered** · **Paid**. DataTable: applicant, IBAN (masked `SA** **** 1234`), amount, contract no, order no, dates, actions.
- KPI strip on top: total pending amount, total paid this month, count per tab.

### 2. Issue payment order (Pending → Ordered)
- Row action → dialog: shows beneficiary bank details, amount (editable within ±0 for demo, read-only),
  auto order no `PO-2026-XXX`, approver select. Confirm → status `ordered`, timeline event.
- Bulk: select rows → "Issue orders" bulk action.

### 3. Confirm payment (Ordered → Paid)
- "Mark as paid" → sets `paidAt`, Disbursement `paid`, **application status → `disbursed`** (module 02 flow),
  fires `disbursed` notification (module 09), success animation on row.
- Auto-schedules first follow-up due date (+30 days) → module 07 picks it up.

## Acceptance criteria
- An application appears here ONLY when `approved` AND its contract is `signed` (module 05).
- After "paid": application detail shows `disbursed`, dashboard totals (module 08) update.


---

# Module 07 — Post-Funding Follow-up (المتابعة بعد التمويل)

**Audience:** staff `/admin/follow-up` + beneficiary `/follow-up/:id`.
**Load with:** `foundation/data-model.md`, `foundation/design-system.md` (charts).

## Purpose
Periodic follow-up forms from beneficiaries, project performance tracking, funding-impact measurement,
and monitoring of struggling (متعثرة) projects.

## Screens & behaviors

### 1. Beneficiary follow-up form `/follow-up/:id` (id = application ref)
- Simple mobile-first form: monthly revenue, employees count, growth self-assessment,
  project photos upload (demo chips), challenges textarea, "need support?" toggle.
- zod + RHF; submit → `useSubmitFollowUp()` → appends FollowUp, computes `growthPct` vs previous,
  sets `healthStatus` (`on_track` if revenue trend ≥ 0, `at_risk` if declining, `defaulted` manual only), toast.

### 2. Monitoring dashboard `/admin/follow-up`
- Health summary cards: on-track / at-risk / defaulted counts (morph icons, colored).
- DataTable of funded projects: applicant, project, disbursed amount, last follow-up date,
  next due (overdue highlighted red), revenue trend sparkline, healthStatus badge, actions.
- Row → detail sheet: follow-up history timeline, revenue line chart (impact since disbursement),
  photos gallery, staff notes, actions: "Send reminder" (module 09 `follow_up_due`), "Mark defaulted" (confirm + reason).

### 3. Impact measurement
- Per project: growth % since first follow-up, jobs created (employees delta).
- Aggregates feed module 08 (avg growth, total jobs created) — computed in `src/features/follow-up/impact.ts`
  and imported by the dashboard, single implementation.

## Acceptance criteria
- Only `disbursed`/`follow_up` applications appear. Overdue detection uses fixture dates (deterministic).
- Submitting a beneficiary follow-up instantly updates the admin monitoring table & charts.


---

# Module 08 — Dashboard & Administrative Reports (لوحة التحكم والتقارير)

**Audience:** staff. **Routes:** `/admin` (dashboard), `/admin/reports`.
**Load with:** `foundation/data-model.md`, `foundation/design-system.md`. Consumes aggregates from modules 2/3/6/7.

## Purpose
KPIs and reports over the whole portfolio. All numbers derived from the demo store — never hardcoded.

## Dashboard `/admin`

### KPI row (StatCard with count-up + trend vs prev month)
1. Total applications · 2. Acceptance rate % (approved+disbursed / decided) · 3. Rejection rate % ·
4. Total disbursed (SAR) · 5. Avg processing days (created→decision, from timeline) · 6. At-risk projects count.

### Charts (recharts via shadcn chart, all theme-aware + RTL)
- Applications by status (donut, colors = status palette).
- Applications over time (area, last 6 months).
- Beneficiaries by region (horizontal bar) — توزيع المستفيدين حسب المناطق.
- Disbursed amount by month (bar).
- Funding impact: avg revenue growth % (line, from module 07 impact fns).

### Staff performance (أداء الموظفين)
- Table: staff member, applications processed, interviews held, avg decision days — derived from
  timeline events' `actor` field (fixtures assign actors).

### Recent activity feed
- Latest 8 timeline events across all applications (live — updates after any demo mutation).

## Reports `/admin/reports`
- Filter bar: date range, region, status, sector → filtered DataTable + summary cards.
- Prebuilt report tabs: Applications report · Disbursement report · Follow-up/impact report · Staff report.
- "Export" buttons: CSV (real client-side generation from filtered rows) + Print (print stylesheet).

## Acceptance criteria
- Every KPI recomputes after demo mutations (e.g. mark paid in module 06 → total disbursed rises).
- Charts readable in dark mode & RTL; numbers use `Intl.NumberFormat`.


---

# Module 09 — Notifications & Automation (الإشعارات والأتمتة)

**Audience:** system-wide (simulated). **Surfaces:** notification center (admin header bell), per-application
timeline, `/admin/settings` templates, beneficiary `/track` inbox strip.
**Load with:** `foundation/data-model.md`, `foundation/localization.md`, `foundation/state-management.md`.

## Purpose
Simulate SMS / WhatsApp / Email automation on every lifecycle event. Demo shows WHAT would be sent and WHEN.

## Trigger matrix (auto-fired inside `useDemoDataStore` mutators — single choke point)

| Trigger | Fired by | Default channels |
|---|---|---|
| `received` | submit application (m01) | sms + email |
| `incomplete` | mark incomplete (m02) | sms + whatsapp |
| `interview_scheduled` | schedule interview (m04) | sms + whatsapp + email |
| `approved` / `rejected` | decision (m02) | sms + email |
| `contract_signed` | signing (m05) | email |
| `disbursed` | mark paid (m06) | sms + whatsapp |
| `follow_up_due` | reminder / auto-schedule (m07) | whatsapp |

## Behaviors

1. **Message templates** — `src/features/notifications/templates.ts`: per trigger × channel, AR + EN,
   with `{{name}} {{ref}} {{date}} {{amount}}` interpolation. Toggleable per channel in `/admin/settings`.
2. **Notification center** — bell (GSAP morph: rings on new) in admin header → popover list
   (channel icon, applicant, rendered message preview, time-ago). "Simulated delivery" badge.
3. **Phone mock preview** — in settings & in application timeline: clicking a notification opens a
   phone-frame dialog rendering the message as an SMS/WhatsApp bubble (WhatsApp-green vs SMS-gray) — client wow-moment.
4. **Beneficiary side** — `/track` shows her notifications for that application as a message list.

## Acceptance criteria
- Every mutator in the demo store fires the right trigger exactly once; timeline + bell + track all show it.
- Disabling a channel in settings stops future messages on that channel only.


---

