import type {
  AppNotification,
  Contract,
  Disbursement,
  FollowUp,
  HealthStatus,
  Interview,
  NotificationTrigger,
} from '../types'
import { renderTemplate } from '../notificationTemplates'
import {
  DEFAULT_ORG_SIGNATORY_NAME,
  DEFAULT_ORG_SIGNATURE_IMAGE,
  SEED_BENEFICIARY_SIGNATURE_IMAGE,
} from '../orgSignature'
import { applications } from './applications'
import { daysAgo, daysAhead, intBetween, pad, rng } from './seed'
import { newestFirst } from '@/lib/sort'

/**
 * Every entity below is derived from `applications`, so the demo can never show
 * a signed contract for an application that was never approved.
 */

const INTERVIEWERS = ['د. هيا العريفي', 'أ. سلمان الدوسري', 'أ. مريم القحطاني']
const BANKS = ['البنك الأهلي السعودي', 'مصرف الراجحي', 'بنك الرياض', 'البنك السعودي الفرنسي']

/* ── Interviews: anything that reached the interview stage ─────────────────── */

const NEEDS_INTERVIEW = ['awaiting_interview', 'approved', 'disbursed', 'follow_up', 'rejected']

export const interviews: Interview[] = applications
  .filter((a) => NEEDS_INTERVIEW.includes(a.status) && a.status !== 'rejected')
  .map((a, i) => {
    const r = rng(2000 + i * 13)
    const upcoming = a.status === 'awaiting_interview'
    return {
      id: `INT-${pad(i + 1, 3)}`,
      applicationId: a.id,
      // Upcoming interviews land in the next working week so the board is never empty.
      scheduledAt: upcoming
        ? daysAhead(intBetween(r(), 1, 6), 9 + (i % 6), (i % 2) * 30)
        : daysAgo(intBetween(r(), 12, 30), 11),
      durationMin: 45,
      meetingUrl: `https://meet.example.sa/${a.ref.toLowerCase()}`,
      interviewer: INTERVIEWERS[i % INTERVIEWERS.length],
      status: upcoming ? 'scheduled' : i % 7 === 3 ? 'no_show' : 'done',
      verdict: upcoming ? undefined : i % 5 === 2 ? 'conditional' : 'recommend',
      notes: upcoming
        ? undefined
        : 'عرض صاحب المشروع خطة تشغيل واضحة وقدرة جيدة على إدارة التدفقات النقدية.',
    }
  })

/* ── Contracts: approved onwards ───────────────────────────────────────────── */

const NEEDS_CONTRACT = ['approved', 'disbursed', 'follow_up']

/**
 * Freshly approved applications whose contract has not been drawn up yet.
 * They are the entry point for the "Generate contract" flow — without them the
 * generation step would have nothing to act on, since every other approved file
 * already carries a contract.
 */
const AWAITING_CONTRACT = ['APP-023']

const hasContract = (id: string) => !AWAITING_CONTRACT.includes(id)

/*
  Every contract the programme has drawn up already carries the organisation's
  signature — it is stamped on at generation time from the signatory configured
  in Settings, not signed per applicant. A contract that has come back `signed`
  therefore carries *both* marks; a `draft` or `sent` one is still waiting on the
  beneficiary.
*/
export const contracts: Contract[] = applications
  .filter((a) => NEEDS_CONTRACT.includes(a.status) && hasContract(a.id))
  .map((a, i) => {
    const signed = a.status !== 'approved'
    const year = new Date().getFullYear()
    const issuedAt = daysAgo(a.status === 'approved' ? 4 : 30, 12)
    return {
      id: `CON-${pad(i + 1, 3)}`,
      applicationId: a.id,
      templateId: 'TPL-STANDARD-01',
      contractNo: `CT-${year}-${pad(i + 1)}`,
      amount: a.project.requestedAmount,
      installments: a.project.requestedAmount > 150000 ? 3 : 1,
      status: signed ? 'signed' : i % 2 === 0 ? 'sent' : 'draft',
      sentAt: issuedAt,
      orgSignatureName: DEFAULT_ORG_SIGNATORY_NAME,
      orgSignatureImage: DEFAULT_ORG_SIGNATURE_IMAGE,
      orgSignedAt: issuedAt,
      signedAt: signed ? daysAgo(a.status === 'follow_up' ? 80 : 26, 14) : undefined,
      signatureName: signed ? a.beneficiary.fullName : undefined,
      signatureImage: signed ? SEED_BENEFICIARY_SIGNATURE_IMAGE : undefined,
      pdfUrl: `/contracts/${a.ref}.pdf`,
    }
  })

/* ── Disbursements: approved onwards ───────────────────────────────────────── */

// A file only reaches finance once its contract exists and is on its way — an
// application still waiting for its contract must not appear in the queue.
export const disbursements: Disbursement[] = applications
  .filter((a) => NEEDS_CONTRACT.includes(a.status) && hasContract(a.id))
  .map((a, i) => {
    const r = rng(3000 + i * 29)
    const paid = a.status === 'disbursed' || a.status === 'follow_up'
    const year = new Date().getFullYear()
    return {
      id: `DIS-${pad(i + 1, 3)}`,
      applicationId: a.id,
      orderNo: `PO-${year}-${pad(i + 1)}`,
      amount: a.project.requestedAmount,
      iban: a.beneficiary.iban,
      bankName: BANKS[Math.floor(r() * BANKS.length)],
      status: paid ? 'paid' : i % 2 === 0 ? 'ordered' : 'pending',
      orderedAt: paid || i % 2 === 0 ? daysAgo(paid ? 24 : 3, 10) : undefined,
      paidAt: paid ? daysAgo(a.status === 'follow_up' ? 74 : 20, 15) : undefined,
    }
  })

/* ── Follow-ups: 1–3 per funded project ────────────────────────────────────── */

const FUNDED = ['disbursed', 'follow_up']

export const followUps: FollowUp[] = applications
  .filter((a) => FUNDED.includes(a.status))
  .flatMap((a, i) => {
    const r = rng(4000 + i * 17)
    const count = a.status === 'follow_up' ? 3 : intBetween(r(), 1, 2)
    // One at-risk and one defaulted project so the monitoring page has real signal.
    const health: HealthStatus = i === 1 ? 'defaulted' : i % 3 === 0 ? 'at_risk' : 'on_track'

    return Array.from({ length: count }, (_, k) => {
      const isLast = k === count - 1
      const overdue = isLast && (health === 'at_risk' || health === 'defaulted')
      const baseRevenue = Math.round(a.project.requestedAmount * 0.18)
      const growth = health === 'defaulted' ? -18 + k * 3 : health === 'at_risk' ? 4 + k : 12 + k * 6

      return {
        id: `FUP-${pad(i + 1, 3)}-${k + 1}`,
        applicationId: a.id,
        period: `Q${k + 1}`,
        dueDate: overdue ? daysAgo(intBetween(r(), 4, 20)) : daysAgo(60 - k * 30, 12),
        submittedAt: overdue ? undefined : daysAgo(58 - k * 30, 16),
        performance: {
          revenue: Math.max(2000, Math.round(baseRevenue * (1 + growth / 100) ** (k + 1))),
          employees: intBetween(r(), 1, 6),
          growthPct: growth,
        },
        photos: [`/photos/${a.ref}-${k + 1}-a.jpg`, `/photos/${a.ref}-${k + 1}-b.jpg`],
        healthStatus: health,
        notes: overdue ? undefined : 'تم رفع تقرير الأداء والصور الخاصة بالفترة.',
      }
    })
  })

/* ── Notifications: one per milestone already reached ──────────────────────── */

const TRIGGER_BY_STATUS = {
  new: 'received',
  incomplete: 'incomplete',
  awaiting_interview: 'interview_scheduled',
  approved: 'approved',
  rejected: 'rejected',
  disbursed: 'disbursed',
  follow_up: 'follow_up_due',
} as const

export const notifications: AppNotification[] = applications
  .flatMap((a, i) => {
    const triggers: NotificationTrigger[] = ['received']
    const status = a.status
    if (status in TRIGGER_BY_STATUS && status !== 'new') {
      triggers.push(TRIGGER_BY_STATUS[status as keyof typeof TRIGGER_BY_STATUS])
    }
    if (['disbursed', 'follow_up'].includes(status)) triggers.push('contract_signed')

    return triggers.map((trigger, k) => ({
      id: `NOT-${pad(i + 1, 3)}-${k + 1}`,
      applicationId: a.id,
      channel: (k % 3 === 0 ? 'sms' : k % 3 === 1 ? 'whatsapp' : 'email') as AppNotification['channel'],
      trigger,
      // Same single source of truth the runtime mutators render from, so a
      // seeded message can never drift from the one the demo sends live.
      body: renderTemplate(trigger, 'ar', { ref: a.ref, name: a.beneficiary.fullName }),
      bodyEn: renderTemplate(trigger, 'en', { ref: a.ref, name: a.beneficiary.fullNameEn }),
      recipient: a.beneficiary.phone,
      sentAt: daysAgo(Math.max(0, 30 - i - k * 2), 9 + k),
      read: i > 4,
    }))
  })
  .sort(newestFirst((n) => n.sentAt))
