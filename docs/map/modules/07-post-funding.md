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
