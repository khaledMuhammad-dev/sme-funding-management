# 🎬 Demo walkthrough — the happy scenario

How to present the full funding lifecycle, from a new application to a funded,
monitored project, in one browser session. This is the same path the
`e2e/lifecycle.spec.ts` dry-run verifies, so it has no dead ends.

## Before you start

```bash
npm install
npm run dev
```

Open the printed URL (default `http://localhost:5173`).

**⚠️ Golden rule: never reload the page mid-demo.** The demo database lives in
memory — a refresh resets everything to the seed fixtures and your story starts
over. Move between screens only through the app's own links and buttons
(portal ↔ admin links are in the header/sidebar).

Good to know:

- **Language / theme** — the globe toggle switches Arabic (RTL) ⇄ English, the
  moon toggle switches dark mode. Both work everywhere; Arabic-first is the
  selling point, so consider presenting in Arabic.
- The app ships pre-seeded with realistic applications in every stage, so the
  admin screens look alive before you add anything.
- **Demo OTP for e-signature: `1234`.**

## The 12 steps

### 1 · The applicant submits — `/apply`

Walk the 5-step wizard: personal details (name, national ID, mobile, email,
region, city, IBAN) → project details (name, sector, description, requested
amount, income, experience) → document uploads (attach any files — PDF/images)
→ scroll the terms to the bottom and tick the checkbox → review and **Submit
application**.

You get a reference number like `APP-2026-1042`. **Note it down — the rest of
the demo revolves around it.**

### 2 · …and tracks it — `/track`

Click **Track it now** on the confirmation screen. Show:

- the 6-stage progress stepper standing on **New**,
- the timeline with the submission event,
- the notifications list — the "application received" message already went out
  on every enabled channel (SMS / WhatsApp / email). Click one to open the
  phone-frame preview.
- The bell in the header now carries an unread badge — and rings.

### 3 · It reaches the officer — header link **Admin** → **Applications**

The **New** tab count includes the fresh application. Search the reference
number to isolate the row.

### 4 · Screening: score and assign

Click the row to open the application detail. On the **Score** tab:

- the eligibility + completeness checklist is already evaluated (documents,
  terms, IBAN…),
- press **Recalculate** — the scoring engine produces a per-criterion breakdown
  and a total with a verdict.

Press **Assign** and pick a reviewer; the assignee appears on the Details tab.

### 5 · New → Under review → interview booked

Press **Change status** — the dialog offers only the transitions the workflow
engine allows from `new` (Under review / Incomplete). Choose **Under review**.

Press **Schedule** and book an interview: pick an interviewer, a day chip and a
free slot (already-booked slots are disabled — the double-booking guard).
Confirming the slot moves the file to **Awaiting interview** automatically; no
separate status click.

### 6 · The interview happens — **Interviews**

Find the applicant on the interviews board, open the row menu → **Interview
notes**. Choose the **Recommend** verdict, write a note, press **Mark
completed**. The row flips to Completed.

### 7 · Approval — back to **Applications**

Search the reference, open the file, **Change status** → **Approved**.

### 8 · Contract: generate → send → sign — **Contracts**

- **Generate contract** → pick the approved application → generate. The
  document opens for review: a real bilingual funding agreement with the
  contract number, national ID, amount — and the programme's signature already
  applied.
- Row menu → **Send for signature**. The row shows *Sent · awaiting applicant
  signature*. Point out that staff **cannot** sign on the applicant's behalf —
  there is no such menu item.

### 8b · …and the applicant signs it in their own portal

Header → **Applicant portal** → **Track application** → look up the reference.
The contract card shows the agreement awaiting signature. Open the signing
dialog: type the full name, draw a signature on the pad, enter the OTP
(**`1234`**), and sign. The contract is now signed by both parties.

### 9 · The money moves — back to **Admin** → **Disbursement**

Signing automatically opened a disbursement record in **Awaiting order**.
Show that the table masks the IBAN (`SA44 ••••`).

- Row menu → **Issue payment order** — an authorised payment order document.
- Switch to the **Order issued** tab → row menu → **Confirm payment**.

### 10 · Disbursed, monitoring opens — **Follow-up**

Confirming payment moved the application to **Disbursed**, sent the
notification, and opened a follow-up cycle. The project now sits on the
**Project monitoring** board with a due date for its first report.

### 11 · The beneficiary reports back

Row menu → **Open beneficiary form** — the deep-linked periodic report the
beneficiary receives. Fill revenue, employees, growth %, and a challenges note,
then **Submit report**.

Return to **Admin**: the dashboard KPIs (Active projects, Total applications)
now include this project and it leads the Recent-activity feed. On the
monitoring board the row shows the reported revenue and an **On track** health
badge.

### 12 · Close the loop — the applicant's view

**Applicant portal** → **Track application** → look up the reference one last
time. The stepper stands on the final **Follow-up** stage, the timeline carries
every stage the file passed through, and the message history holds every
notification the journey generated.

## Suggested encore

- Flip to **Arabic** and replay any screen — full RTL, localized numbers,
  Arabic contract text.
- Toggle **dark mode**.
- Open **Reports** for the aggregate views (funnel, geographic distribution).
- **Settings** shows notification-channel toggles, scoring weights, and the
  organisation signatory used on generated contracts.

## Detours (if asked "what about the unhappy path?")

- From `new`, choose **Incomplete** instead — a reason is required, the
  applicant is notified, and `/track` shows what's missing.
- From `under_review` or `awaiting_interview`, choose **Rejected** — also
  reason-required, and terminal.

Full status flow: `new → under_review → awaiting_interview → approved →
disbursed → follow_up`, with `incomplete` and `rejected` as the two branches
(`src/data/statusFlow.ts` is the single source of truth).
