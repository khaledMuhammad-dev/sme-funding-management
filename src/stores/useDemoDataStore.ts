import { create } from 'zustand'
import type {
  AppNotification,
  Application,
  ApplicationStatus,
  Contract,
  CriterionKey,
  Disbursement,
  FollowUp,
  HealthStatus,
  Interview,
  InterviewVerdict,
  NotificationChannel,
  NotificationTrigger,
  TimelineEvent,
  TimelineEventKind,
} from '@/data/types'
import {
  applications as seedApplications,
  contracts as seedContracts,
  disbursements as seedDisbursements,
  followUps as seedFollowUps,
  interviews as seedInterviews,
  notifications as seedNotifications,
} from '@/data/fixtures'
import { canTransition } from '@/data/statusFlow'
import { computeScore } from '@/lib/scoring'
import { DEFAULT_CHANNELS, renderTemplate } from '@/data/notificationTemplates'
import { hasOrgSignatory, useSettingsStore } from '@/stores/useSettingsStore'

/**
 * The demo's in-memory database.
 *
 * Components never call these actions directly — they go through the simulated
 * API hooks in `src/lib/api/`, which add latency and invalidate the query cache.
 * Every mutator that changes an application also appends a timeline event and,
 * where the trigger matrix says so, pushes a notification.
 */

const CURRENT_USER = 'فاطمة الأنصاري'

let sequence = 0
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${++sequence}`

interface StatusChangeInput {
  applicationId: string
  to: ApplicationStatus
  reason?: string
  actor?: string
}

/** Which status change sends which message. `undefined` = silent transition. */
const NOTIFY_ON: Partial<Record<ApplicationStatus, NotificationTrigger>> = {
  incomplete: 'incomplete',
  awaiting_interview: 'interview_scheduled',
  approved: 'approved',
  rejected: 'rejected',
  disbursed: 'disbursed',
  follow_up: 'follow_up_due',
}

interface DemoDataState {
  applications: Application[]
  interviews: Interview[]
  contracts: Contract[]
  disbursements: Disbursement[]
  followUps: FollowUp[]
  notifications: AppNotification[]

  updateStatus: (input: StatusChangeInput) => void
  addApplication: (app: Application) => void
  assign: (applicationId: string, assignee: string) => void
  setDocumentMissing: (applicationId: string, docId: string, missing: boolean) => void
  reuploadDocument: (applicationId: string, docId: string) => void

  scheduleInterview: (input: {
    applicationId: string
    scheduledAt: string
    interviewer: string
  }) => void
  saveInterviewNotes: (input: {
    interviewId: string
    notes: string
    verdict: InterviewVerdict
    status: 'done' | 'no_show'
  }) => void

  generateContract: (applicationId: string) => void
  sendContract: (contractId: string) => void
  /** The applicant's signature — the action that completes a contract. */
  signContractAsBeneficiary: (input: {
    contractId: string
    signatureName: string
    signatureImage?: string
  }) => void

  issueDisbursement: (applicationId: string) => void
  markDisbursementPaid: (disbursementId: string) => void

  submitFollowUp: (input: {
    followUpId: string
    revenue: number
    employees: number
    growthPct: number
    notes?: string
    /** Data URLs produced in the browser — the demo never uploads a binary anywhere. */
    photos?: string[]
  }) => void
  setProjectHealth: (applicationId: string, health: HealthStatus, reason?: string) => void
  remindFollowUp: (followUpId: string) => void

  pushNotification: (input: {
    applicationId: string
    trigger: NotificationTrigger
    channel?: NotificationChannel
  }) => void
  markNotificationsRead: () => void

  recomputeAllScores: (weights: Record<CriterionKey, number>) => void
  recomputeScore: (applicationId: string, weights: Record<CriterionKey, number>) => void

  /** Empties every table so the whole lifecycle can be walked from scratch. */
  startClean: () => void
  /** Puts the seeded demo population back. */
  restoreDemoData: () => void
}

/**
 * The seeded population, in one place.
 *
 * Every mutator replaces arrays rather than mutating them, so these stay
 * pristine and `restoreDemoData` can always hand back the original demo.
 */
const SEED = {
  applications: seedApplications,
  interviews: seedInterviews,
  contracts: seedContracts,
  disbursements: seedDisbursements,
  followUps: seedFollowUps,
  notifications: seedNotifications,
}

const EMPTY: typeof SEED = {
  applications: [],
  interviews: [],
  contracts: [],
  disbursements: [],
  followUps: [],
  notifications: [],
}

function timelineEvent(
  kind: TimelineEventKind,
  messageKey: string,
  params?: Record<string, string | number>,
  actor = CURRENT_USER,
): TimelineEvent {
  return { id: nextId('TL'), kind, at: new Date().toISOString(), messageKey, params, actor }
}

export const useDemoDataStore = create<DemoDataState>()((set, get) => {
  /** Applies a patch to one application and stamps `updatedAt`. */
  const patchApp = (id: string, patch: (app: Application) => Application) =>
    set((state) => ({
      applications: state.applications.map((a) =>
        a.id === id ? { ...patch(a), updatedAt: new Date().toISOString() } : a,
      ),
    }))

  const appendEvent = (id: string, event: TimelineEvent) =>
    patchApp(id, (a) => ({ ...a, timeline: [...a.timeline, event] }))

  return {
    applications: seedApplications,
    interviews: seedInterviews,
    contracts: seedContracts,
    disbursements: seedDisbursements,
    followUps: seedFollowUps,
    notifications: seedNotifications,

    updateStatus: ({ applicationId, to, reason, actor = CURRENT_USER }) => {
      const app = get().applications.find((a) => a.id === applicationId)
      if (!app) return
      const from = app.status

      patchApp(applicationId, (a) => ({
        ...a,
        status: to,
        timeline: [
          ...a.timeline,
          {
            ...timelineEvent('status_change', 'timeline.statusChanged', { status: to }, actor),
            from,
            to,
            ...(reason ? { params: { status: to, reason } } : {}),
          },
        ],
      }))

      const trigger = NOTIFY_ON[to]
      if (trigger) get().pushNotification({ applicationId, trigger })
    },

    addApplication: (app) =>
      set((state) => ({ applications: [app, ...state.applications] })),

    assign: (applicationId, assignee) => patchApp(applicationId, (a) => ({ ...a, assignee })),

    setDocumentMissing: (applicationId, docId, missing) =>
      patchApp(applicationId, (a) => {
        const doc = a.documents.find((d) => d.id === docId)
        return {
          ...a,
          documents: a.documents.map((d) => (d.id === docId ? { ...d, missing } : d)),
          timeline: [
            ...a.timeline,
            timelineEvent(
              'document',
              missing ? 'timeline.documentMissing' : 'timeline.documentUploaded',
              { doc: doc?.kind ?? '' },
            ),
          ],
        }
      }),

    reuploadDocument: (applicationId, docId) =>
      patchApp(applicationId, (a) => {
        const doc = a.documents.find((d) => d.id === docId)
        return {
          ...a,
          documents: a.documents.map((d) =>
            d.id === docId ? { ...d, missing: false, uploadedAt: new Date().toISOString() } : d,
          ),
          timeline: [
            ...a.timeline,
            timelineEvent('document', 'timeline.documentUploaded', { doc: doc?.kind ?? '' }, a.beneficiary.fullName),
          ],
        }
      }),

    scheduleInterview: ({ applicationId, scheduledAt, interviewer }) => {
      const app = get().applications.find((a) => a.id === applicationId)
      if (!app) return

      const interview: Interview = {
        id: nextId('INT'),
        applicationId,
        scheduledAt,
        durationMin: 45,
        meetingUrl: `https://meet.example.sa/${app.ref.toLowerCase()}`,
        interviewer,
        status: 'scheduled',
      }

      set((state) => ({
        // One live interview per application — rescheduling replaces the old slot.
        interviews: [...state.interviews.filter((i) => i.applicationId !== applicationId || i.status !== 'scheduled'), interview],
      }))
      appendEvent(applicationId, timelineEvent('interview', 'timeline.interviewScheduled'))

      if (app.status === 'under_review') {
        get().updateStatus({ applicationId, to: 'awaiting_interview' })
      } else {
        get().pushNotification({ applicationId, trigger: 'interview_scheduled' })
      }
    },

    saveInterviewNotes: ({ interviewId, notes, verdict, status }) => {
      const interview = get().interviews.find((i) => i.id === interviewId)
      set((state) => ({
        interviews: state.interviews.map((i) =>
          i.id === interviewId ? { ...i, notes, verdict, status } : i,
        ),
      }))
      if (interview) {
        appendEvent(interview.applicationId, timelineEvent('interview', 'timeline.interviewCompleted'))
      }
    },

    generateContract: (applicationId) => {
      const app = get().applications.find((a) => a.id === applicationId)
      if (!app || get().contracts.some((c) => c.applicationId === applicationId)) return

      /*
        The programme signs centrally: the authorised signatory configured in
        `/admin/settings` is stamped onto the contract the moment it is drawn
        up, so no member of staff ever signs a contract by hand. Without a
        signatory there is nothing to issue — the UI blocks this and points at
        Settings, and this guard is the backstop.
      */
      const orgSignature = useSettingsStore.getState().orgSignature
      if (!hasOrgSignatory(orgSignature)) return

      const year = new Date().getFullYear()
      const contract: Contract = {
        id: nextId('CON'),
        applicationId,
        templateId: 'TPL-STANDARD-01',
        contractNo: `CT-${year}-${String(get().contracts.length + 1).padStart(4, '0')}`,
        amount: app.project.requestedAmount,
        installments: app.project.requestedAmount > 150_000 ? 3 : 1,
        status: 'draft',
        orgSignatureName: orgSignature.name.trim(),
        orgSignatureImage: orgSignature.image ?? undefined,
        orgSignedAt: new Date().toISOString(),
        pdfUrl: `/contracts/${app.ref}.pdf`,
      }
      set((state) => ({ contracts: [contract, ...state.contracts] }))
      appendEvent(
        applicationId,
        timelineEvent('contract', 'timeline.contractGenerated', { contractNo: contract.contractNo }),
      )
    },

    sendContract: (contractId) => {
      const contract = get().contracts.find((c) => c.id === contractId)
      set((state) => ({
        contracts: state.contracts.map((c) =>
          c.id === contractId ? { ...c, status: 'sent', sentAt: new Date().toISOString() } : c,
        ),
      }))
      if (contract) {
        appendEvent(contract.applicationId, timelineEvent('contract', 'timeline.contractSent'))
      }
    },

    /*
      The beneficiary's signature is what completes a contract. She signs it in
      her own portal, after the programme has sent it — so an unsent draft, which
      she has never been shown, cannot be signed.
    */
    signContractAsBeneficiary: ({ contractId, signatureName, signatureImage }) => {
      const contract = get().contracts.find((c) => c.id === contractId)
      if (!contract || contract.status !== 'sent') return
      set((state) => ({
        contracts: state.contracts.map((c) =>
          c.id === contractId
            ? {
                ...c,
                status: 'signed',
                signedAt: new Date().toISOString(),
                signatureName,
                signatureImage,
              }
            : c,
        ),
      }))

      appendEvent(contract.applicationId, timelineEvent('contract', 'timeline.contractSigned', undefined, signatureName))
      get().pushNotification({ applicationId: contract.applicationId, trigger: 'contract_signed' })

      // Her signature hands the file to finance: the disbursement queue is
      // exactly the set of approved applications whose contract has come back
      // signed, so the record is opened here rather than waiting for someone to
      // create it.
      const app = get().applications.find((a) => a.id === contract.applicationId)
      const queued = get().disbursements.some((d) => d.applicationId === contract.applicationId)
      if (app?.status === 'approved' && !queued) {
        const year = new Date().getFullYear()
        set((state) => ({
          disbursements: [
            {
              id: nextId('DIS'),
              applicationId: app.id,
              orderNo: `PO-${year}-${String(state.disbursements.length + 1).padStart(4, '0')}`,
              amount: contract.amount,
              iban: app.beneficiary.iban,
              bankName: 'مصرف الراجحي',
              status: 'pending',
            },
            ...state.disbursements,
          ],
        }))
      }
    },

    issueDisbursement: (applicationId) => {
      const app = get().applications.find((a) => a.id === applicationId)
      if (!app) return

      const existing = get().disbursements.find((d) => d.applicationId === applicationId)
      const now = new Date().toISOString()

      if (existing) {
        set((state) => ({
          disbursements: state.disbursements.map((d) =>
            d.id === existing.id ? { ...d, status: 'ordered', orderedAt: now } : d,
          ),
        }))
      } else {
        const year = new Date().getFullYear()
        set((state) => ({
          disbursements: [
            {
              id: nextId('DIS'),
              applicationId,
              orderNo: `PO-${year}-${String(state.disbursements.length + 1).padStart(4, '0')}`,
              amount: app.project.requestedAmount,
              iban: app.beneficiary.iban,
              bankName: 'مصرف الراجحي',
              status: 'ordered',
              orderedAt: now,
            },
            ...state.disbursements,
          ],
        }))
      }
      appendEvent(applicationId, timelineEvent('disbursement', 'timeline.disbursementOrdered'))
    },

    markDisbursementPaid: (disbursementId) => {
      const disbursement = get().disbursements.find((d) => d.id === disbursementId)
      if (!disbursement) return

      set((state) => ({
        disbursements: state.disbursements.map((d) =>
          d.id === disbursementId ? { ...d, status: 'paid', paidAt: new Date().toISOString() } : d,
        ),
      }))
      appendEvent(disbursement.applicationId, timelineEvent('disbursement', 'timeline.disbursementPaid'))

      // Paying an approved application moves it to `disbursed` and opens the
      // first monitoring period — this is the one place both happen together.
      const app = get().applications.find((a) => a.id === disbursement.applicationId)
      if (app?.status === 'approved') {
        get().updateStatus({ applicationId: app.id, to: 'disbursed' })

        // First monitoring report falls due 30 days after the money lands.
        const due = new Date()
        due.setDate(due.getDate() + 30)
        set((state) => ({
          followUps: [
            ...state.followUps,
            {
              id: nextId('FUP'),
              applicationId: app.id,
              period: 'Q1',
              dueDate: due.toISOString(),
              performance: { revenue: 0, employees: 0, growthPct: 0 },
              photos: [],
              healthStatus: 'on_track',
            },
          ],
        }))
      }
    },

    submitFollowUp: ({ followUpId, revenue, employees, growthPct, notes, photos }) => {
      const followUp = get().followUps.find((f) => f.id === followUpId)
      set((state) => ({
        followUps: state.followUps.map((f) =>
          f.id === followUpId
            ? {
                ...f,
                submittedAt: new Date().toISOString(),
                performance: { revenue, employees, growthPct },
                healthStatus: growthPct < 0 ? 'at_risk' : 'on_track',
                notes,
                // Photos attached to this report join whatever the period already had.
                photos: photos?.length ? [...f.photos, ...photos] : f.photos,
              }
            : f,
        ),
      }))
      if (followUp) {
        appendEvent(followUp.applicationId, timelineEvent('follow_up', 'timeline.followUpSubmitted'))
        const app = get().applications.find((a) => a.id === followUp.applicationId)
        if (app?.status === 'disbursed') get().updateStatus({ applicationId: app.id, to: 'follow_up' })
      }
    },

    setProjectHealth: (applicationId, health, reason) => {
      set((state) => ({
        followUps: state.followUps.map((f) =>
          f.applicationId === applicationId ? { ...f, healthStatus: health } : f,
        ),
      }))

      appendEvent(
        applicationId,
        timelineEvent('follow_up', 'followUp.timeline.healthChanged', {
          health,
          ...(reason ? { reason } : {}),
        }),
      )

      /*
        A project under active monitoring belongs in `follow_up`. `disbursed →
        follow_up` is the only transition statusFlow allows from here, so this
        routes through `updateStatus` (which validates) instead of writing the
        status directly.
      */
      const app = get().applications.find((a) => a.id === applicationId)
      if (app && canTransition(app.status, 'follow_up')) {
        get().updateStatus({ applicationId, to: 'follow_up', reason })
      }
    },

    remindFollowUp: (followUpId) => {
      const followUp = get().followUps.find((f) => f.id === followUpId)
      if (followUp) get().pushNotification({ applicationId: followUp.applicationId, trigger: 'follow_up_due' })
    },

    pushNotification: ({ applicationId, trigger, channel }) => {
      const app = get().applications.find((a) => a.id === applicationId)
      if (!app) return

      /*
        Which channels carry this trigger is an admin setting: turning one off in
        `/admin/settings` must stop future messages on that channel only, so the
        list is read here, at send time, rather than baked in at the call site.
        An explicit `channel` (a manual resend) bypasses the matrix.
      */
      const configured = useSettingsStore.getState().channels[trigger] ?? DEFAULT_CHANNELS[trigger]
      const channels = channel ? [channel] : configured
      if (channels.length === 0) return

      const sentAt = new Date().toISOString()
      const created: AppNotification[] = channels.map((c) => ({
        id: nextId('NOT'),
        applicationId,
        channel: c,
        trigger,
        body: renderTemplate(trigger, 'ar', { ref: app.ref, name: app.beneficiary.fullName }),
        bodyEn: renderTemplate(trigger, 'en', { ref: app.ref, name: app.beneficiary.fullNameEn }),
        recipient: c === 'email' ? app.beneficiary.email : app.beneficiary.phone,
        sentAt,
        read: false,
      }))

      set((state) => ({ notifications: [...created, ...state.notifications] }))
      // One timeline entry per event, not per channel — the file reads as a
      // history of what happened, not of how many SMS gateways were called.
      appendEvent(applicationId, timelineEvent('notification', 'timeline.notificationSent', { trigger }))
    },

    markNotificationsRead: () =>
      set((state) => ({ notifications: state.notifications.map((n) => ({ ...n, read: true })) })),

    recomputeScore: (applicationId, weights) =>
      patchApp(applicationId, (a) => {
        const score = computeScore(a, weights)
        return {
          ...a,
          score,
          timeline: [
            ...a.timeline,
            timelineEvent('note', 'timeline.scoreComputed', { score: score.total }),
          ],
        }
      }),

    recomputeAllScores: (weights) =>
      set((state) => ({
        applications: state.applications.map((a) =>
          // Applications that were never opened stay unscored.
          a.score ? { ...a, score: computeScore(a, weights) } : a,
        ),
      })),

    startClean: () => set({ ...EMPTY }),
    restoreDemoData: () => set({ ...SEED }),
  }
})
