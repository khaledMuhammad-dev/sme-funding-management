import { useQuery } from '@tanstack/react-query'
import type { Application, ApplicationStatus, FollowUp, Region } from '@/data/types'
import { APPLICATION_STATUSES, REGIONS } from '@/data/types'
import { db } from './db'
import { simulateFetch } from './simulateFetch'
import { qk } from './queryKeys'

export interface DashboardData {
  kpi: {
    /** Client KPI 1 — number of applications. */
    total: number
    /** Client KPI 2a — acceptance rate %, of decided applications. */
    approvalRate: number
    /** Client KPI 2b — rejection rate %, the complement of `approvalRate`. */
    rejectionRate: number
    /** Client KPI 3 — total disbursed (SAR), paid orders only. */
    disbursedAmount: number
    /** Client KPI 4 — average days from submission to first decision. */
    avgProcessingDays: number
    /** Client KPI 5 — funded projects whose latest report is at-risk or defaulted. */
    strugglingProjects: number
    /** Supporting extras (not on the client list, kept because the row reads better). */
    activeProjects: number
    avgScore: number
  }
  byStatus: { status: ApplicationStatus; count: number }[]
  byRegion: { region: Region; count: number }[]
  overTime: { month: string; submitted: number; approved: number }[]
  disbursementByMonth: { month: string; amount: number }[]
  impact: { month: string; revenue: number; employees: number }[]
  staff: { name: string; handled: number; approved: number; avgDays: number }[]
}

const MONTH_KEYS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']

function monthLabel(date: Date) {
  return `${date.getFullYear()}-${MONTH_KEYS[date.getMonth()]}`
}

/** Last N months, oldest first — the x-axis for every time series. */
function lastMonths(count: number) {
  const out: string[] = []
  const cursor = new Date()
  cursor.setDate(1)
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(cursor)
    d.setMonth(d.getMonth() - i)
    out.push(monthLabel(d))
  }
  return out
}

/**
 * Days from submission to the **first decision** on an application.
 *
 * The decision timestamp comes from the application's own timeline — the first
 * `status_change` event whose `to` is `approved` or `rejected`. `updatedAt` is
 * deliberately NOT used as a stand-in: it keeps moving with every later event
 * (contract, disbursement, follow-up report), so for a funded file it would
 * measure the whole lifecycle instead of the review turnaround.
 *
 * Returns `null` for an application that has not been decided yet — those are
 * excluded from the average rather than counted as zero days.
 */
export function daysToDecision(application: Application): number | null {
  const decision = application.timeline.find(
    (event) =>
      event.kind === 'status_change' && (event.to === 'approved' || event.to === 'rejected'),
  )
  if (!decision) return null

  const days =
    (new Date(decision.at).getTime() - new Date(application.createdAt).getTime()) / 86_400_000
  // A malformed date would poison the average — drop it instead.
  return Number.isFinite(days) ? Math.max(0, days) : null
}

/**
 * One entry per funded project: the latest report by `dueDate`, which is the
 * same "one row per project" rule the monitoring table uses. Health is judged on
 * the most recent report, never on a stale one.
 */
function latestFollowUpPerProject(followUps: FollowUp[]): FollowUp[] {
  const latest = new Map<string, FollowUp>()
  for (const followUp of followUps) {
    const current = latest.get(followUp.applicationId)
    if (!current || current.dueDate <= followUp.dueDate) latest.set(followUp.applicationId, followUp)
  }
  return [...latest.values()]
}

export function useDashboard() {
  return useQuery({
    queryKey: qk.dashboard(),
    queryFn: () => {
      // Read at call time, never from a render closure — see the note in `queryKeys.ts`.
      const { applications, disbursements, followUps } = db()
      const total = applications.length
      const decided = applications.filter((a) =>
        ['approved', 'rejected', 'disbursed', 'follow_up'].includes(a.status),
      )
      const approved = decided.filter((a) => a.status !== 'rejected')
      const paid = disbursements.filter((d) => d.status === 'paid')
      const scored = applications.filter((a) => a.score)
      const months = lastMonths(8)

      const processingDays = applications
        .map(daysToDecision)
        .filter((days): days is number => days !== null)

      /*
        Acceptance and rejection are exhaustive over decided applications, so the
        rejection rate is taken as the complement — rounding each share
        independently could make the pair read 49% / 52%.
      */
      const approvalRate = decided.length
        ? Math.round((approved.length / decided.length) * 100)
        : 0

      const data: DashboardData = {
        kpi: {
          total,
          approvalRate,
          rejectionRate: decided.length ? 100 - approvalRate : 0,
          disbursedAmount: paid.reduce((sum, d) => sum + d.amount, 0),
          avgProcessingDays: processingDays.length
            ? Math.round(processingDays.reduce((sum, days) => sum + days, 0) / processingDays.length)
            : 0,
          strugglingProjects: latestFollowUpPerProject(followUps).filter(
            (f) => f.healthStatus === 'at_risk' || f.healthStatus === 'defaulted',
          ).length,
          activeProjects: applications.filter((a) =>
            ['disbursed', 'follow_up'].includes(a.status),
          ).length,
          avgScore: scored.length
            ? Math.round(scored.reduce((sum, a) => sum + (a.score?.total ?? 0), 0) / scored.length)
            : 0,
        },

        byStatus: APPLICATION_STATUSES.map((status) => ({
          status,
          count: applications.filter((a) => a.status === status).length,
        })).filter((s) => s.count > 0),

        byRegion: REGIONS.map((region) => ({
          region,
          count: applications.filter((a) => a.beneficiary.region === region).length,
        })).sort((a, b) => b.count - a.count),

        overTime: months.map((month) => ({
          month,
          submitted: applications.filter((a) => monthLabel(new Date(a.createdAt)) === month).length,
          approved: applications.filter(
            (a) =>
              monthLabel(new Date(a.updatedAt)) === month &&
              ['approved', 'disbursed', 'follow_up'].includes(a.status),
          ).length,
        })),

        disbursementByMonth: months.map((month) => ({
          month,
          amount: paid
            .filter((d) => d.paidAt && monthLabel(new Date(d.paidAt)) === month)
            .reduce((sum, d) => sum + d.amount, 0),
        })),

        impact: months.slice(-6).map((month, i) => {
          const submitted = followUps.filter((f) => f.submittedAt)
          const slice = submitted.slice(0, Math.max(1, Math.ceil(((i + 1) / 6) * submitted.length)))
          return {
            month,
            revenue: slice.reduce((sum, f) => sum + f.performance.revenue, 0),
            employees: slice.reduce((sum, f) => sum + f.performance.employees, 0),
          }
        }),

        staff: Array.from(
          applications.reduce((map, a) => {
            if (!a.assignee) return map
            const entry = map.get(a.assignee) ?? { handled: 0, approved: 0, days: 0 }
            entry.handled += 1
            if (['approved', 'disbursed', 'follow_up'].includes(a.status)) entry.approved += 1
            entry.days += Math.max(
              1,
              Math.round(
                (new Date(a.updatedAt).getTime() - new Date(a.createdAt).getTime()) / 86_400_000,
              ),
            )
            map.set(a.assignee, entry)
            return map
          }, new Map<string, { handled: number; approved: number; days: number }>()),
          ([name, v]) => ({
            name,
            handled: v.handled,
            approved: v.approved,
            avgDays: Math.round(v.days / v.handled),
          }),
        ).sort((a, b) => b.handled - a.handled),
      }

      return simulateFetch(data, { delayMs: 550 })
    },
  })
}
