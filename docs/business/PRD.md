# 📘 PRD — SME Funding Management Platform (Demo)

> **⚠️ HUMAN-ONLY DOCUMENT.** AI agents must NOT load this file (enforced by hook).
> AI agents use `docs/map/INDEX.md` instead. The content here is mirrored, split per module, in `docs/map/`.

**Version:** 1.0 · **Date:** 2026-08-04 · **Status:** Approved for demo build
**Source:** Client RFQ "طلب عرض سعر لتطوير منصة إلكترونية لإدارة برنامج التمويل"

---

## 1. Overview

A digital platform that manages the complete lifecycle of a micro/SME funding program for women
entrepreneurs (المستفيدات) — from online application through automated screening, interviews,
approval, e-signed contracts, disbursement, and post-funding impact tracking.

**This deliverable is a frontend-only demo** whose purpose is to show the client the final product
experience and win the contract. No backend/database — all flows run on realistic static data with
simulated network behavior, so every journey is fully clickable end-to-end.

## 2. Goals

| Client's business goal (from RFQ) | How the demo proves it |
|---|---|
| Automate the beneficiary journey end-to-end | Clickable flow: apply → screen → interview → approve → sign → disburse → follow-up |
| Reduce paperwork | Digital forms, document uploads, e-signature simulation |
| Speed up study/approval/monitoring | Auto-scoring with customizable criteria, workflow statuses, dashboards |
| Operational visibility | KPI dashboard, reports, staff performance |
| Better beneficiary experience | Arabic-first RTL UI, status tracking, notification previews |

## 3. Users & personas

1. **المستفيدة (Beneficiary)** — woman entrepreneur applying for funding; mobile-first; Arabic.
2. **موظفة الدراسة (Case officer)** — reviews applications, requests missing docs, runs interviews.
3. **الإدارة المالية (Finance officer)** — issues payment orders, confirms disbursement.
4. **مديرة البرنامج (Program manager)** — dashboards, reports, criteria configuration.

(Demo has no authentication; roles are represented by sections of the admin UI.)

## 4. Scope — the 9 product modules

1. **Application Portal** — public application wizard, document uploads (ID, IBAN, commercial register if any, feasibility study, photos), electronic T&C acceptance, application tracking by reference number.
2. **Application Management & Workflow** — 8 statuses (جديد، ناقص، تحت الدراسة، بانتظار المقابلة، معتمد، مرفوض، تم الصرف، متابعة), controlled transitions, automatic beneficiary notifications on every change.
3. **Auto Screening & Scoring** — completeness verification, automatic eligibility rules, weighted score over customizable criteria: income stability, project experience, seriousness, repayment ability, data completeness.
4. **Electronic Interviews** — slot booking, meeting links, in-system interview notes and recommendations.
5. **Approval & E-Signature** — auto-generated contracts, e-signature simulation, PDF export, archiving.
6. **Financial Disbursement** — finance queue, payment orders, post-payment status updates.
7. **Post-Funding Follow-up** — periodic beneficiary forms, project photos and performance data, funding-impact measurement, monitoring of struggling projects.
8. **Dashboard & Reports** — applications count, acceptance/rejection rates, total disbursed, processing time, struggling projects, beneficiaries by region, staff performance; CSV/print export.
9. **Notifications & Automation** — simulated SMS/WhatsApp/Email at: receipt, missing items, interview scheduling, approval/rejection, contract signing, disbursement, follow-up reminders.

## 5. Demo constraints & non-goals

- No backend, no persistence beyond the browser session (except theme/language preference).
- No real integrations (SMS, WhatsApp, e-sign, payments) — all visually simulated with honest "simulation" labeling in admin surfaces.
- No authentication/authorization.
- Future phases (out of demo): real backend, Nafath/SSO, real e-sign provider, ERP/CRM integration (RFQ item 6), SMS gateway.

## 6. Product quality requirements

- **Bilingual:** Arabic (default, RTL, IBM Plex Sans Arabic) + English (Inter). Full mirroring.
- **Theming:** light + dark mode.
- **Motion:** signature icon system — every icon is an SVG path that morphs (GSAP) on hover/active; page and element transitions via Framer Motion. Reduced-motion respected.
- **Responsive:** beneficiary surfaces mobile-first; admin optimized for desktop, usable on tablet.
- **Perceived realism:** simulated network latency, loading skeletons, optimistic UI, toasts.

## 7. Success criteria for the demo

1. A presenter can walk one application through the entire lifecycle live in < 10 minutes.
2. All 9 modules reachable and populated with realistic Arabic demo data (25 applications).
3. Zero dead buttons on demo paths; every listed feature in `docs/FEATURES.md` checked.
4. Client sees their exact RFQ vocabulary on screen (statuses, criteria, KPIs).

## 8. Traceability

Every RFQ line item maps to a module doc in `docs/map/modules/` and checklist items in `docs/FEATURES.md`.
Any change to business scope must be approved by the product owner and applied to BOTH the map docs and this PRD.
