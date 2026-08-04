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
