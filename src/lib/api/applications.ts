import { useMutation, useQuery } from '@tanstack/react-query'
import type {
  Application,
  ApplicationStatus,
  CriterionKey,
  Region,
  Sector,
  StatusCount,
} from '@/data/types'
import { APPLICATION_STATUSES } from '@/data/types'
import { canTransition } from '@/data/statusFlow'
import { useDemoDataStore } from '@/stores/useDemoDataStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { simulateFetch, simulateMutation } from './simulateFetch'
import { qk } from './queryKeys'
import { db } from './db'
import { useInvalidate } from './useInvalidate'

export interface ApplicationFilters {
  status?: ApplicationStatus | 'all'
  region?: Region[]
  sector?: Sector[]
  search?: string
}

/**
 * The fields a free-text search looks through — one definition, so every search
 * box in the product matches on the same things (both name locales included, so
 * an Arabic name is findable on an English screen and vice versa).
 */
export function applicationHaystack(app: Application): string {
  return [
    app.ref,
    app.beneficiary.fullName,
    app.beneficiary.fullNameEn,
    app.beneficiary.nationalId,
    app.beneficiary.phone,
    app.project.name,
    app.project.nameEn,
  ]
    .join(' ')
    .toLowerCase()
}

/** Whether an application answers a free-text query, per `applicationHaystack`. */
export function applicationMatchesSearch(app: Application, search: string): boolean {
  const q = search.trim().toLowerCase()
  return q.length === 0 || applicationHaystack(app).includes(q)
}

function matches(app: Application, filters: ApplicationFilters): boolean {
  if (filters.status && filters.status !== 'all' && app.status !== filters.status) return false
  if (filters.region?.length && !filters.region.includes(app.beneficiary.region)) return false
  if (filters.sector?.length && !filters.sector.includes(app.project.sector)) return false

  if (filters.search && !applicationMatchesSearch(app, filters.search)) return false
  return true
}

export function useApplications(filters: ApplicationFilters = {}) {
  return useQuery({
    queryKey: qk.applications(filters),
    queryFn: () => simulateFetch(db().applications.filter((a) => matches(a, filters))),
  })
}

export function useApplication(id: string | undefined) {
  return useQuery({
    queryKey: qk.application(id ?? ''),
    enabled: Boolean(id),
    queryFn: () => simulateFetch(db().applications.find((a) => a.id === id) ?? null),
  })
}

/** Applicant-facing lookup on /track — by reference, not internal id. */
export function useApplicationByRef(ref: string | undefined) {
  return useQuery({
    queryKey: qk.applicationByRef(ref ?? ''),
    enabled: Boolean(ref && ref.length > 3),
    queryFn: () =>
      simulateFetch(
        db().applications.find((a) => a.ref.toLowerCase() === ref!.trim().toLowerCase()) ?? null,
      ),
  })
}

/** One row per remembered reference, in the order given. */
export interface RememberedApplication {
  ref: string
  /** `null` when the reference no longer resolves — the demo database is in memory. */
  application: Application | null
}

/**
 * Resolves every reference this browser remembers in a single read.
 *
 * Deliberately returns a row for a reference it cannot find rather than dropping
 * it: after a reload the fixtures are back and a submitted reference is real but
 * unresolvable, and silently shortening her list would read as data loss.
 */
export function useApplicationsByRefs(refs: string[]) {
  return useQuery({
    queryKey: qk.applicationsByRefs(refs),
    enabled: refs.length > 0,
    queryFn: () =>
      simulateFetch<RememberedApplication[]>(
        refs.map((ref) => ({
          ref,
          application:
            db().applications.find((a) => a.ref.toLowerCase() === ref.trim().toLowerCase()) ?? null,
        })),
      ),
  })
}

export function useStatusCounts() {
  return useQuery({
    queryKey: qk.statusCounts(),
    queryFn: () =>
      simulateFetch<StatusCount[]>(
        APPLICATION_STATUSES.map((status) => ({
          status,
          count: db().applications.filter((a) => a.status === status).length,
        })),
      ),
  })
}

export function useUpdateStatus() {
  const updateStatus = useDemoDataStore((s) => s.updateStatus)
  const { invalidateAll } = useInvalidate()

  return useMutation({
    mutationFn: async (input: {
      applicationId: string
      to: ApplicationStatus
      reason?: string
    }) => simulateMutation(input),
    onSuccess: (input) => {
      updateStatus(input)
      invalidateAll()
    },
  })
}

export function useAssign() {
  const assign = useDemoDataStore((s) => s.assign)
  const { invalidateAll } = useInvalidate()

  return useMutation({
    mutationFn: async (input: { applicationId: string; assignee: string }) =>
      simulateMutation(input),
    onSuccess: ({ applicationId, assignee }) => {
      assign(applicationId, assignee)
      invalidateAll()
    },
  })
}

export function useSetDocumentMissing() {
  const setDocumentMissing = useDemoDataStore((s) => s.setDocumentMissing)
  const updateStatus = useDemoDataStore((s) => s.updateStatus)
  const { invalidateAll } = useInvalidate()

  return useMutation({
    mutationFn: async (input: {
      applicationId: string
      docId: string
      missing: boolean
      /** Reason recorded on the follow-on `incomplete` transition. */
      reason?: string
    }) => simulateMutation(input),
    onSuccess: ({ applicationId, docId, missing, reason }) => {
      setDocumentMissing(applicationId, docId, missing)

      // Flagging a document as missing is what makes a file incomplete — the
      // workflow follows the document, so the transition happens here rather
      // than waiting for someone to remember to change the status by hand.
      if (missing) {
        const app = db().applications.find((a) => a.id === applicationId)
        if (app && canTransition(app.status, 'incomplete')) {
          updateStatus({ applicationId, to: 'incomplete', reason })
        }
      }

      invalidateAll()
    },
  })
}

export function useReuploadDocument() {
  const reuploadDocument = useDemoDataStore((s) => s.reuploadDocument)
  const { invalidateAll } = useInvalidate()

  return useMutation({
    mutationFn: async (input: { applicationId: string; docId: string }) => simulateMutation(input),
    onSuccess: ({ applicationId, docId }) => {
      reuploadDocument(applicationId, docId)
      invalidateAll()
    },
  })
}

/**
 * Next free applicant reference for the current year.
 *
 * Derived from what is already in the demo database rather than from the clock:
 * a timestamp slice can land on a reference the fixtures already use, and `/track`
 * would then resolve the wrong application.
 */
export function nextApplicationRef(): string {
  const year = new Date().getFullYear()
  const prefix = `APP-${year}-`
  const highest = db()
    .applications.filter((a) => a.ref.startsWith(prefix))
    .reduce((max, a) => Math.max(max, Number(a.ref.slice(prefix.length)) || 0), 0)

  return `${prefix}${String(highest + 1).padStart(4, '0')}`
}

export function useSubmitApplication() {
  const addApplication = useDemoDataStore((s) => s.addApplication)
  const pushNotification = useDemoDataStore((s) => s.pushNotification)
  const { invalidateAll } = useInvalidate()

  return useMutation({
    mutationFn: async (app: Application) => simulateFetch(app, { delayMs: 900 }),
    onSuccess: (app) => {
      addApplication(app)
      pushNotification({ applicationId: app.id, trigger: 'received' })
      invalidateAll()
    },
  })
}

/**
 * Saving criteria weights re-scores every application that has ever been
 * scored — the settings screen's whole point is that the change is visible on
 * the next application you open.
 */
export function useSaveWeights() {
  const recomputeAllScores = useDemoDataStore((s) => s.recomputeAllScores)
  const setWeights = useSettingsStore((s) => s.setWeights)
  const { invalidateAll } = useInvalidate()

  return useMutation({
    mutationFn: async (weights: Record<CriterionKey, number>) => simulateMutation(weights),
    onSuccess: (weights) => {
      setWeights(weights)
      recomputeAllScores(weights)
      invalidateAll()
    },
  })
}

export function useRecomputeScore() {
  const recomputeScore = useDemoDataStore((s) => s.recomputeScore)
  const weights = useSettingsStore((s) => s.weights)
  const { invalidateAll } = useInvalidate()

  return useMutation({
    mutationFn: async (applicationId: string) => simulateMutation(applicationId),
    onSuccess: (applicationId) => {
      recomputeScore(applicationId, weights)
      invalidateAll()
    },
  })
}
