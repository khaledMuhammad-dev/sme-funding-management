# 📸 Demo walkthrough — the happy scenario, in pictures

A screen-by-screen illustrated version of [DEMO.md](DEMO.md). Every image below is a
real capture of the running app, taken in a **single browser session** — the same
golden rule as the live demo: never reload mid-demo, the in-memory database resets.

The story: **Hessa Al Dossari** applies for SAR 95,000 to expand her ceramics
studio, and we follow her file from submission to a funded, monitored project.

> Regenerate these images any time with:
> `DEMO_SHOTS=1 npx playwright test e2e/demo-screenshots.spec.ts --workers=1`
> (they are written to `docs/screenshots/`). Reference numbers in your run will differ.

---

## Step 1 · The applicant submits — `/apply`

The 5-step wizard. First, personal details: name, national ID, mobile, email,
region, city, and the IBAN the funding would be paid to.

![Apply wizard — personal details](screenshots/01-apply-personal.png)

Then the project: name, sector, description, requested amount, current monthly
income, and years of experience — the inputs the scoring engine will use later.

![Apply wizard — project details](screenshots/02-apply-project.png)

Document uploads. Each required document kind (national ID, IBAN certificate,
feasibility study) gets its own slot; attached files are listed under it.

![Apply wizard — document uploads](screenshots/03-apply-documents.png)

Terms and conditions. The confirmation checkbox stays disabled until the terms
have been scrolled to the bottom — then it can be ticked.

![Apply wizard — terms accepted](screenshots/04-apply-terms.png)

A final review of everything entered, then **Submit application**.

![Apply wizard — review before submit](screenshots/05-apply-review.png)

The confirmation screen issues a reference number (here `APP-2026-0026`).
**The whole demo revolves around this number** — the presenter should note it down.

![Submission confirmation with reference number](screenshots/06-apply-confirmation.png)

## Step 2 · …and tracks it — `/track`

Clicking **Track it now** lands on the tracking page: the 6-stage journey stepper
standing on **New**, the application details, the timeline with the submission
event, and the message history. The bell in the header already carries an unread
badge — the "application received" notification went out on every enabled channel.

![Track page — application is New](screenshots/07-track-new.png)

Clicking a notification opens the phone-frame preview — what the applicant
actually received by SMS / WhatsApp / email.

![Notification phone-frame preview](screenshots/08-track-notification-preview.png)

## Step 3 · It reaches the officer — Admin → Applications

Over in the admin area, the **New** tab count includes the fresh file. Searching
the reference number isolates the row.

![Admin applications list filtered to the new file](screenshots/09-admin-applications-new.png)

## Step 4 · Screening: score and assign

Opening the file, the **Score** tab. On the right, the eligibility and
completeness checklist is already evaluated (documents, terms, amount cap, IBAN,
income). Pressing **Recalculate** runs the scoring engine: a per-criterion
weighted breakdown, a total out of 100, and a verdict.

![Score tab — checklist and weighted score](screenshots/10-admin-score.png)

**Assign** opens the reviewer picker; the chosen assignee will appear on the
Details tab.

![Assign-reviewer dialog](screenshots/11-admin-assign.png)

## Step 5 · New → Under review → interview booked

**Change status** offers only the transitions the workflow engine allows from
`new` — Under review or Incomplete. Nothing can be skipped ahead.

![Change-status dialog — only legal transitions](screenshots/12-admin-change-status.png)

After moving to **Under review**, **Schedule** books the interview: an
interviewer, a day chip, and a time slot — already-booked slots are disabled
(the double-booking guard). Confirming the slot moves the file to **Awaiting
interview** automatically.

![Schedule-interview dialog with day and slot chips](screenshots/13-admin-schedule-interview.png)

## Step 6 · The interview happens — Interviews

On the interviews board, the row menu opens **Interview notes**: a verdict
(**Recommend**), a free-text note, and **Mark completed**.

![Interview notes dialog with Recommend verdict](screenshots/14-admin-interview-notes.png)

The row flips to **Completed** on the board.

![Interviews board — row completed](screenshots/15-admin-interviews-completed.png)

## Step 7 · Approval — back to Applications

With the interview recommendation in, **Change status → Approved**.

![Application detail — Approved](screenshots/16-admin-approved.png)

## Step 8 · Contract: generate → send — Contracts

**Generate contract** picks the approved application and produces a real
bilingual funding agreement — contract number, both parties, national ID,
amount — with the programme's authorised signature already applied.

![Generated contract document preview](screenshots/17-admin-contract-preview.png)

Row menu → **Send for signature**. The row now reads *Sent · awaiting applicant
signature*. Note there is **no "sign" action for staff** — they cannot sign on
the applicant's behalf.

![Contracts list — sent, awaiting applicant signature](screenshots/18-admin-contract-sent.png)

## Step 8b · …and the applicant signs it in her own portal

Back in the applicant portal, the tracking page shows the contract awaiting her
signature. The signing dialog: the contract to read (already signed by the
programme), her full name as on her ID, a signature drawn on the pad, and the
verification code (demo OTP: **1234**).

![Beneficiary e-signature dialog — name, drawn signature, OTP](screenshots/19-portal-signing-dialog.png)

After **Sign and confirm**, the contract card shows the agreement signed by both
parties.

![Track page — contract signed](screenshots/20-portal-contract-signed.png)

## Step 9 · The money moves — Admin → Disbursement

Signing automatically opened a disbursement record in **Awaiting order**. The
table masks the IBAN (`SA44 ••••`) — the full number never appears in a list.

![Disbursement queue — awaiting order, masked IBAN](screenshots/21-admin-disbursement-queue.png)

**Issue payment order** produces an authorised payment order document; after
issuing, the **Order issued** tab's **Confirm payment** completes the transfer.

![Payment order dialog](screenshots/22-admin-payment-order.png)

## Step 10 · Disbursed, monitoring opens — Follow-up

Confirming payment moved the application to **Disbursed**, notified the
applicant, and opened a follow-up cycle. The project now sits on the **Project
monitoring** board with a due date for its first periodic report.

![Project monitoring board with the new project](screenshots/23-admin-monitoring.png)

## Step 11 · The beneficiary reports back

The row menu's **Open beneficiary form** deep-links to the periodic report the
beneficiary receives: revenue this period, employees, estimated growth %, and a
challenges note.

![Beneficiary periodic report form, filled](screenshots/24-beneficiary-report-form.png)

Back on the admin dashboard, the KPIs (Active projects, Total applications,
Total disbursed) now include this project, and it leads the Recent-activity feed.

![Admin dashboard with updated KPIs and charts](screenshots/25-admin-dashboard.png)

On the monitoring board the row shows the reported revenue and an **On track**
health badge.

![Monitoring board — reported revenue, On track](screenshots/26-admin-monitoring-on-track.png)

## Step 12 · Close the loop — the applicant's view

One last lookup on the tracking page: the journey stepper stands on the final
**Follow-up** stage, every stage the file passed through is green, the timeline
carries the full history, and the message history holds every notification the
journey generated.

![Track page — journey complete, Follow-up stage](screenshots/27-track-follow-up.png)

## Encore

The same product, flipped to **Arabic** — full RTL layout, Arabic-first copy
(the selling point: consider presenting in Arabic from the start).

![Apply wizard in Arabic, RTL layout](screenshots/28-encore-arabic-apply.png)

…and in **dark mode**, here on the admin dashboard.

![Admin dashboard in dark mode](screenshots/29-encore-dark-dashboard.png)
