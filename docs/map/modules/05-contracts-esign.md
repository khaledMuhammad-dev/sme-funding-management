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
