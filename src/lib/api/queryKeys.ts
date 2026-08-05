import type { ApplicationFilters } from './applications'

/** Every query key in the app is minted here so invalidation can never drift. */
export const qk = {
  applications: (filters?: ApplicationFilters) =>
    filters ? (['applications', filters] as const) : (['applications'] as const),
  application: (id: string) => ['application', id] as const,
  applicationByRef: (ref: string) => ['application-by-ref', ref] as const,
  /** The applicant's remembered references, resolved in one read. */
  applicationsByRefs: (refs: string[]) => ['application-by-ref', 'list', refs.join('|')] as const,
  statusCounts: () => ['status-counts'] as const,
  interviews: () => ['interviews'] as const,
  interviewFor: (applicationId: string) => ['interview-for', applicationId] as const,
  contracts: () => ['contracts'] as const,
  contractFor: (applicationId: string) => ['contract-for', applicationId] as const,
  /** Every contract across a set of applications, resolved in one read. */
  contractsForMany: (key: string) => ['contract-for', 'many', key] as const,
  disbursements: () => ['disbursements'] as const,
  disbursementFor: (applicationId: string) => ['disbursement-for', applicationId] as const,
  followUps: () => ['follow-ups'] as const,
  followUpsFor: (applicationId: string) => ['follow-ups-for', applicationId] as const,
  followUp: (id: string) => ['follow-up', id] as const,
  notifications: () => ['notifications'] as const,
  notificationsFor: (applicationId: string) => ['notifications-for', applicationId] as const,
  notificationsForMany: (key: string) => ['notifications-for', 'many', key] as const,
  dashboard: () => ['dashboard'] as const,
}

/** Anything that can change when an application changes. */
export const APPLICATION_SCOPE = [
  ['applications'],
  ['application'],
  ['application-by-ref'],
  ['status-counts'],
  ['dashboard'],
  ['notifications'],
] as const
