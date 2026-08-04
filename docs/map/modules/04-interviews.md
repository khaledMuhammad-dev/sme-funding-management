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
