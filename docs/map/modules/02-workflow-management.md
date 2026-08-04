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
