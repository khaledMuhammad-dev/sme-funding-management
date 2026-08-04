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
- Beneficiaries by region (horizontal bar) — توزيع المستفيدات حسب المناطق.
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
