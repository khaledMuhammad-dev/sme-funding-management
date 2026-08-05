import { useMutation, useQuery } from '@tanstack/react-query'
import type { HealthStatus, InterviewVerdict } from '@/data/types'
import { useDemoDataStore } from '@/stores/useDemoDataStore'
import { simulateFetch, simulateMutation } from './simulateFetch'
import { qk } from './queryKeys'
import { db } from './db'
import { useInvalidate } from './useInvalidate'
import { newestFirst } from '@/lib/sort'

/* ── Interviews ───────────────────────────────────────────────────────────── */

export function useInterviews() {
  return useQuery({ queryKey: qk.interviews(), queryFn: () => simulateFetch(db().interviews) })
}

export function useInterviewFor(applicationId: string | undefined) {
  return useQuery({
    queryKey: qk.interviewFor(applicationId ?? ''),
    enabled: Boolean(applicationId),
    queryFn: () =>
      simulateFetch(
        [...db().interviews]
          .filter((i) => i.applicationId === applicationId)
          .sort(newestFirst((i) => i.scheduledAt))[0] ?? null,
      ),
  })
}

export function useScheduleInterview() {
  const scheduleInterview = useDemoDataStore((s) => s.scheduleInterview)
  const { invalidateAll } = useInvalidate()

  return useMutation({
    mutationFn: async (input: {
      applicationId: string
      scheduledAt: string
      interviewer: string
    }) => simulateMutation(input),
    onSuccess: (input) => {
      scheduleInterview(input)
      invalidateAll()
    },
  })
}

export function useSaveInterviewNotes() {
  const saveInterviewNotes = useDemoDataStore((s) => s.saveInterviewNotes)
  const { invalidateAll } = useInvalidate()

  return useMutation({
    mutationFn: async (input: {
      interviewId: string
      notes: string
      verdict: InterviewVerdict
      status: 'done' | 'no_show'
    }) => simulateMutation(input),
    onSuccess: (input) => {
      saveInterviewNotes(input)
      invalidateAll()
    },
  })
}

/* ── Contracts ────────────────────────────────────────────────────────────── */

export function useContracts() {
  return useQuery({ queryKey: qk.contracts(), queryFn: () => simulateFetch(db().contracts) })
}

export function useContractFor(applicationId: string | undefined) {
  return useQuery({
    queryKey: qk.contractFor(applicationId ?? ''),
    enabled: Boolean(applicationId),
    queryFn: () =>
      simulateFetch(db().contracts.find((c) => c.applicationId === applicationId) ?? null),
  })
}

export function useGenerateContract() {
  const generateContract = useDemoDataStore((s) => s.generateContract)
  const { invalidateAll } = useInvalidate()

  return useMutation({
    mutationFn: async (applicationId: string) => simulateMutation(applicationId),
    onSuccess: (applicationId) => {
      generateContract(applicationId)
      invalidateAll()
    },
  })
}

export function useSendContract() {
  const sendContract = useDemoDataStore((s) => s.sendContract)
  const { invalidateAll } = useInvalidate()

  return useMutation({
    mutationFn: async (contractId: string) => simulateMutation(contractId),
    onSuccess: (contractId) => {
      sendContract(contractId)
      invalidateAll()
    },
  })
}

/**
 * The applicant returns her signed contract.
 *
 * This is the only interactive signing path in the product: the organisation's
 * side is stamped on centrally at generation time from the signatory configured
 * in `/admin/settings`. Her signature is what flips the contract to `signed`.
 */
export function useSignContractAsBeneficiary() {
  const signContractAsBeneficiary = useDemoDataStore((s) => s.signContractAsBeneficiary)
  const { invalidateAll } = useInvalidate()

  return useMutation({
    mutationFn: async (input: {
      contractId: string
      signatureName: string
      signatureImage?: string
    }) => simulateFetch(input, { delayMs: 1100 }),
    onSuccess: (input) => {
      signContractAsBeneficiary(input)
      invalidateAll()
    },
  })
}

/* ── Disbursement ─────────────────────────────────────────────────────────── */

export function useDisbursements() {
  return useQuery({ queryKey: qk.disbursements(), queryFn: () => simulateFetch(db().disbursements) })
}

export function useDisbursementFor(applicationId: string | undefined) {
  return useQuery({
    queryKey: qk.disbursementFor(applicationId ?? ''),
    enabled: Boolean(applicationId),
    queryFn: () =>
      simulateFetch(db().disbursements.find((d) => d.applicationId === applicationId) ?? null),
  })
}

export function useIssueDisbursement() {
  const issueDisbursement = useDemoDataStore((s) => s.issueDisbursement)
  const { invalidateAll } = useInvalidate()

  return useMutation({
    mutationFn: async (applicationIds: string[]) => simulateMutation(applicationIds),
    onSuccess: (applicationIds) => {
      applicationIds.forEach(issueDisbursement)
      invalidateAll()
    },
  })
}

export function useMarkDisbursementPaid() {
  const markDisbursementPaid = useDemoDataStore((s) => s.markDisbursementPaid)
  const { invalidateAll } = useInvalidate()

  return useMutation({
    mutationFn: async (disbursementId: string) => simulateMutation(disbursementId),
    onSuccess: (disbursementId) => {
      markDisbursementPaid(disbursementId)
      invalidateAll()
    },
  })
}

/* ── Follow-ups ───────────────────────────────────────────────────────────── */

export function useFollowUps() {
  return useQuery({ queryKey: qk.followUps(), queryFn: () => simulateFetch(db().followUps) })
}

export function useFollowUpsFor(applicationId: string | undefined) {
  return useQuery({
    queryKey: qk.followUpsFor(applicationId ?? ''),
    enabled: Boolean(applicationId),
    queryFn: () => simulateFetch(db().followUps.filter((f) => f.applicationId === applicationId)),
  })
}

export function useFollowUp(id: string | undefined) {
  return useQuery({
    queryKey: qk.followUp(id ?? ''),
    enabled: Boolean(id),
    queryFn: () => simulateFetch(db().followUps.find((f) => f.id === id) ?? null),
  })
}

export function useSubmitFollowUp() {
  const submitFollowUp = useDemoDataStore((s) => s.submitFollowUp)
  const { invalidateAll } = useInvalidate()

  return useMutation({
    mutationFn: async (input: {
      followUpId: string
      revenue: number
      employees: number
      growthPct: number
      notes?: string
      /** Client-side data URLs; nothing is uploaded in a frontend-only demo. */
      photos?: string[]
    }) => simulateFetch(input, { delayMs: 800 }),
    onSuccess: (input) => {
      submitFollowUp(input)
      invalidateAll()
    },
  })
}

export function useRemindFollowUp() {
  const remindFollowUp = useDemoDataStore((s) => s.remindFollowUp)
  const { invalidateAll } = useInvalidate()

  return useMutation({
    mutationFn: async (followUpId: string) => simulateMutation(followUpId),
    onSuccess: (followUpId) => {
      remindFollowUp(followUpId)
      invalidateAll()
    },
  })
}

export function useSetProjectHealth() {
  const setProjectHealth = useDemoDataStore((s) => s.setProjectHealth)
  const { invalidateAll } = useInvalidate()

  return useMutation({
    mutationFn: async (input: { applicationId: string; health: HealthStatus; reason?: string }) =>
      simulateMutation(input),
    onSuccess: ({ applicationId, health, reason }) => {
      setProjectHealth(applicationId, health, reason)
      invalidateAll()
    },
  })
}

/* ── Notifications ────────────────────────────────────────────────────────── */

export function useNotifications() {
  return useQuery({ queryKey: qk.notifications(), queryFn: () => simulateFetch(db().notifications) })
}

/**
 * Marking the centre read is a mutation like any other: it has to invalidate,
 * or the bell keeps rendering the query's pre-mutation snapshot and the badge
 * survives the click that was supposed to clear it.
 */
export function useMarkNotificationsRead() {
  const markNotificationsRead = useDemoDataStore((s) => s.markNotificationsRead)
  const { invalidateAll } = useInvalidate()

  return useMutation({
    mutationFn: async () => simulateMutation(null),
    onSuccess: () => {
      markNotificationsRead()
      invalidateAll()
    },
  })
}

export function useNotificationsFor(applicationId: string | undefined) {
  return useQuery({
    queryKey: qk.notificationsFor(applicationId ?? ''),
    enabled: Boolean(applicationId),
    queryFn: () =>
      simulateFetch(db().notifications.filter((n) => n.applicationId === applicationId)),
  })
}

/**
 * Messages for several applications at once — the applicant's inbox when this
 * browser remembers more than one reference.
 *
 * One query over the whole set rather than a hook per id: the number of
 * remembered references varies at runtime, and a loop of hooks would break the
 * rules of hooks the moment she submits another application.
 */
export function useNotificationsForMany(applicationIds: string[]) {
  const key = [...applicationIds].sort().join(',')

  return useQuery({
    queryKey: qk.notificationsForMany(key),
    enabled: applicationIds.length > 0,
    queryFn: () =>
      simulateFetch(db().notifications.filter((n) => applicationIds.includes(n.applicationId))),
  })
}

/**
 * Contracts across several applications at once — the applicant's own contract
 * list, over every application the portal knows about.
 *
 * Same shape as `useNotificationsForMany` above and for the same reason: one
 * query keyed on the sorted id set, never a hook per application, because how
 * many applications there are is only known at runtime.
 *
 * Deliberately returns drafts too — filtering is the caller's decision, and the
 * portal drops them (a draft has been sent to nobody) while staff screens need
 * them. Keyed under the `contract-for` prefix, so `invalidateAll()` reaches it.
 */
export function useContractsForMany(applicationIds: string[]) {
  const key = [...applicationIds].sort().join(',')

  return useQuery({
    queryKey: qk.contractsForMany(key),
    enabled: applicationIds.length > 0,
    queryFn: () =>
      simulateFetch(db().contracts.filter((c) => applicationIds.includes(c.applicationId))),
  })
}
