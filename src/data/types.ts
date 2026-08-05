/**
 * SINGLE SOURCE OF TRUTH for every entity in the demo.
 * Nothing else may declare an application status, a document kind or a criterion key.
 */

/* ── Application status ───────────────────────────────────────────────────── */

export const APPLICATION_STATUSES = [
  'new',
  'incomplete',
  'under_review',
  'awaiting_interview',
  'approved',
  'rejected',
  'disbursed',
  'follow_up',
] as const

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

/* ── Reference data ───────────────────────────────────────────────────────── */

export const REGIONS = ['riyadh', 'jeddah', 'dammam', 'abha', 'madinah', 'qassim', 'tabuk'] as const
export type Region = (typeof REGIONS)[number]

export const SECTORS = ['food', 'fashion', 'beauty', 'crafts', 'retail', 'services', 'tech'] as const
export type Sector = (typeof SECTORS)[number]

export const DOCUMENT_KINDS = [
  'national_id',
  'iban_cert',
  'commercial_register',
  'feasibility_study',
  'photos',
] as const
export type DocumentKind = (typeof DOCUMENT_KINDS)[number]

export const CRITERION_KEYS = [
  'income_stability',
  'project_experience',
  'seriousness',
  'repayment_ability',
  'data_completeness',
] as const
export type CriterionKey = (typeof CRITERION_KEYS)[number]

/* ── Entities ─────────────────────────────────────────────────────────────── */

export interface Beneficiary {
  id: string
  fullName: string
  fullNameEn: string
  nationalId: string
  phone: string
  email: string
  region: Region
  city: string
  iban: string
  hasCommercialRegister: boolean
  commercialRegisterNo?: string
}

export interface Project {
  name: string
  nameEn: string
  sector: Sector
  description: string
  requestedAmount: number
  monthlyIncome: number
  experienceYears: number
}

export interface UploadedDoc {
  id: string
  kind: DocumentKind
  fileName: string
  sizeKb: number
  uploadedAt: string
  /** Staff can flag a document as unreadable/wrong — drives the `incomplete` flow. */
  missing?: boolean
  note?: string
}

export interface ScoreCriterion {
  key: CriterionKey
  weight: number
  /** 0–100 raw score for this criterion before weighting. */
  value: number
}

export type ScoreVerdict = 'eligible' | 'ineligible' | 'manual_review'

export interface ScoreCard {
  total: number
  verdict: ScoreVerdict
  criteria: ScoreCriterion[]
  computedAt: string
}

export type TimelineEventKind =
  | 'status_change'
  | 'document'
  | 'note'
  | 'notification'
  | 'interview'
  | 'contract'
  | 'disbursement'
  | 'follow_up'

export interface TimelineEvent {
  id: string
  kind: TimelineEventKind
  at: string
  /** i18n key under `timeline.*`; `params` are interpolated into it. */
  messageKey: string
  params?: Record<string, string | number>
  actor: string
  from?: ApplicationStatus
  to?: ApplicationStatus
}

export interface Application {
  id: string
  ref: string
  beneficiary: Beneficiary
  project: Project
  documents: UploadedDoc[]
  termsAccepted: boolean
  status: ApplicationStatus
  score?: ScoreCard
  timeline: TimelineEvent[]
  assignee?: string
  createdAt: string
  updatedAt: string
}

export type InterviewStatus = 'scheduled' | 'done' | 'no_show'
export type InterviewVerdict = 'recommend' | 'conditional' | 'not_recommend'

export interface Interview {
  id: string
  applicationId: string
  scheduledAt: string
  durationMin: number
  meetingUrl: string
  interviewer: string
  status: InterviewStatus
  verdict?: InterviewVerdict
  notes?: string
}

export type ContractStatus = 'draft' | 'sent' | 'signed'

/**
 * A contract carries two signatures.
 *
 * The **organisation** signs once, centrally: an authorised signatory is
 * configured in `/admin/settings` and that single signature is stamped onto
 * every contract the programme issues, at generation time. Nobody re-signs it
 * per applicant.
 *
 * The **beneficiary** signs interactively, in the applicant portal, and hers is
 * what completes the contract — `status: 'signed'`, `signedAt`, the pending
 * disbursement record and the `contract_signed` notification all hang off it.
 * That is why she keeps the unprefixed field names: `signedAt` means "the
 * contract was completed", everywhere in the app.
 */
export interface Contract {
  id: string
  applicationId: string
  templateId: string
  contractNo: string
  amount: number
  installments: number
  status: ContractStatus
  sentAt?: string
  /** Completion timestamp — stamped when the beneficiary returns her signature. */
  signedAt?: string
  /** Beneficiary: the name she typed on the signing form. */
  signatureName?: string
  /** Beneficiary: data-URL of the mark captured by the e-sign pad. */
  signatureImage?: string
  /** Organisation: the authorised signatory configured in settings. */
  orgSignatureName?: string
  /** Organisation: data-URL of the configured signature mark. */
  orgSignatureImage?: string
  /** Organisation: when the programme's signature was applied (generation time). */
  orgSignedAt?: string
  pdfUrl: string
}

export type DisbursementStatus = 'pending' | 'ordered' | 'paid'

export interface Disbursement {
  id: string
  applicationId: string
  orderNo: string
  amount: number
  iban: string
  bankName: string
  status: DisbursementStatus
  orderedAt?: string
  paidAt?: string
}

export type HealthStatus = 'on_track' | 'at_risk' | 'defaulted'

export interface FollowUp {
  id: string
  applicationId: string
  period: string
  dueDate: string
  submittedAt?: string
  performance: { revenue: number; employees: number; growthPct: number }
  photos: string[]
  healthStatus: HealthStatus
  notes?: string
}

export type NotificationChannel = 'sms' | 'whatsapp' | 'email'

export const NOTIFICATION_TRIGGERS = [
  'received',
  'incomplete',
  'interview_scheduled',
  'approved',
  'rejected',
  'contract_signed',
  'disbursed',
  'follow_up_due',
] as const
export type NotificationTrigger = (typeof NOTIFICATION_TRIGGERS)[number]

export interface AppNotification {
  id: string
  applicationId: string
  channel: NotificationChannel
  trigger: NotificationTrigger
  /** Rendered at push time from the template + application data, in both locales. */
  body: string
  bodyEn: string
  recipient: string
  sentAt: string
  read: boolean
}

/* ── Derived view models ──────────────────────────────────────────────────── */

export interface StatusCount {
  status: ApplicationStatus
  count: number
}
