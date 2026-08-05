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
