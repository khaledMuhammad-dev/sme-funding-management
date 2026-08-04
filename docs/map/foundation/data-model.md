# Foundation — Data Model & Simulated API (single source of truth)

Code lives in `src/data/types.ts` + `src/data/fixtures/`. If this doc and code disagree, fix the code.

## Status enum (used everywhere — DO NOT invent new statuses)

```ts
export type ApplicationStatus =
  | 'new'            // جديد
  | 'incomplete'     // ناقص
  | 'under_review'   // تحت الدراسة
  | 'awaiting_interview' // بانتظار المقابلة
  | 'approved'       // معتمد
  | 'rejected'       // مرفوض
  | 'disbursed'      // تم الصرف
  | 'follow_up';     // متابعة
```

Allowed transitions: `new → incomplete|under_review` · `incomplete → under_review` ·
`under_review → awaiting_interview|rejected` · `awaiting_interview → approved|rejected` ·
`approved → disbursed` · `disbursed → follow_up`. Encode in `src/data/statusFlow.ts`.

## Core entities (abridged — full shapes in `src/data/types.ts`)

```ts
interface Beneficiary { id; fullName; nationalId; phone; email; region; city; iban; hasCommercialRegister; commercialRegisterNo? }
interface Application {
  id; ref: string;              // e.g. 'APP-2026-0042'
  beneficiary: Beneficiary;
  project: { name; sector; description; requestedAmount; monthlyIncome; experienceYears };
  documents: UploadedDoc[];     // kind: 'national_id'|'iban_cert'|'commercial_register'|'feasibility_study'|'photos'
  termsAccepted: boolean;
  status: ApplicationStatus;
  score?: ScoreCard;
  timeline: TimelineEvent[];    // every status change + notification, with timestamps
  createdAt; updatedAt;
}
interface ScoreCard { total: number /*0-100*/; verdict: 'eligible'|'ineligible'|'manual_review';
  criteria: { key: CriterionKey; label; weight; value: number }[] }
type CriterionKey = 'income_stability'|'project_experience'|'seriousness'|'repayment_ability'|'data_completeness';
interface Interview { id; applicationId; scheduledAt; meetingUrl; status: 'scheduled'|'done'|'no_show'; notes?; interviewer }
interface Contract { id; applicationId; templateId; status: 'draft'|'sent'|'signed'; signedAt?; pdfUrl /* fake */ }
interface Disbursement { id; applicationId; orderNo; amount; status: 'pending'|'ordered'|'paid'; paidAt? }
interface FollowUp { id; applicationId; dueDate; submittedAt?; performance: { revenue; employees; growthPct };
  photos: string[]; healthStatus: 'on_track'|'at_risk'|'defaulted'; notes? }
interface AppNotification { id; applicationId; channel: 'sms'|'whatsapp'|'email';
  trigger: 'received'|'incomplete'|'interview_scheduled'|'approved'|'rejected'|'contract_signed'|'disbursed'|'follow_up_due';
  body; sentAt }
```

## Fixtures

- `fixtures/applications.ts` — **25 applications** spread across ALL statuses & regions (Riyadh, Jeddah, Dammam, Abha, Madinah…), realistic Arabic names & project types (home bakery, tailoring, beauty salon, catering, crafts, online store…).
- Each disbursed app has 1–3 follow-ups; ≥2 projects `at_risk`, 1 `defaulted`.
- `fixtures/notifications.ts`, `fixtures/interviews.ts`, `fixtures/contracts.ts`, `fixtures/disbursements.ts` consistent with application statuses.
- Deterministic IDs/dates (no `Math.random()` at module top-level) so UI is stable between reloads.

## Simulated API layer (`src/lib/api/`)

```ts
// simulateFetch.ts
export async function simulateFetch<T>(data: T, opts?: { delayMs?: number; failRate?: number }): Promise<T>
// default delay 400–800ms; failRate 0 (keep 0 for client demo)
```

- Per-module hooks: `useApplications(filters)`, `useApplication(id)`, `useUpdateStatus()`, `useScheduleInterview()`, …
- Mutations write to `useDemoDataStore` (zustand) — the fixtures are its initial state — then invalidate queries. Session-persistent only (no localStorage for data; localStorage only for theme+lang).
- Query keys: `['applications', filters]`, `['application', id]`, `['interviews']`, etc.
