import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DateText,
  EmptyState,
  Money,
  PageHeader,
  SectionCard,
  StatusBadge,
} from '@/components/shared'
import { DocumentIcon, ReportsIcon } from '@/components/icons'
import type { Application, ApplicationStatus, Region, Sector } from '@/data/types'
import { APPLICATION_STATUSES, REGIONS, SECTORS } from '@/data/types'
import { useApplications, useDisbursements, useFollowUps } from '@/lib/api'
import { daysToDecision, useDashboard } from '@/lib/api'
import { cn } from '@/lib/utils'

type ReportTab = 'applications' | 'financial' | 'impact' | 'geographic' | 'performance'

const REPORT_TABS: ReportTab[] = [
  'applications',
  'financial',
  'impact',
  'geographic',
  'performance',
]

interface ReportColumn {
  key: string
  label: string
  align?: 'end'
  render: (row: any) => React.ReactNode
  raw: (row: any) => string | number
}

export default function ReportsPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<ReportTab>('applications')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [region, setRegion] = useState<Region | 'all'>('all')
  const [status, setStatus] = useState<ApplicationStatus | 'all'>('all')
  const [sector, setSector] = useState<Sector | 'all'>('all')

  const applicationsQuery = useApplications()
  const disbursementsQuery = useDisbursements()
  const followUpsQuery = useFollowUps()
  const dashboardQuery = useDashboard()

  const { data: applications = [] } = applicationsQuery
  const { data: disbursements = [] } = disbursementsQuery
  const { data: followUps = [] } = followUpsQuery
  const { data: dashboard } = dashboardQuery

  /*
    Every tab reads from more than one of these, so the page is "loading" until
    all four have landed. Without this the simulated 380–720 ms read resolved to
    an empty `rows` array and the *empty state* rendered first — every visit to
    Reports flashed "no data for these filters" before the data arrived, which
    reads as a broken report rather than a slow one.
  */
  const isLoading =
    applicationsQuery.isLoading ||
    disbursementsQuery.isLoading ||
    followUpsQuery.isLoading ||
    dashboardQuery.isLoading

  const hasFilter = Boolean(from || to) || region !== 'all' || status !== 'all' || sector !== 'all'

  const inRange = (iso: string) => {
    if (from && iso < from) return false
    if (to && iso > `${to}T23:59:59`) return false
    return true
  }

  const appById = useMemo(() => new Map(applications.map((a) => [a.id, a])), [applications])

  /** Region/status/sector are properties of the application behind every row. */
  const appMatches = (application?: Application) => {
    if (region === 'all' && status === 'all' && sector === 'all') return true
    if (!application) return false
    if (region !== 'all' && application.beneficiary.region !== region) return false
    if (status !== 'all' && application.status !== status) return false
    if (sector !== 'all' && application.project.sector !== sector) return false
    return true
  }

  const filteredApplications = applications.filter((a) => inRange(a.createdAt) && appMatches(a))

  /** Client KPI: geographic distribution of beneficiaries by region, as a report. */
  const geographicRows = REGIONS.map((value) => {
    const inRegion = filteredApplications.filter((a) => a.beneficiary.region === value)
    const decided = inRegion.filter((a) =>
      ['approved', 'rejected', 'disbursed', 'follow_up'].includes(a.status),
    )
    const accepted = decided.filter((a) => a.status !== 'rejected')
    const funded = new Set(
      inRegion.filter((a) => ['disbursed', 'follow_up'].includes(a.status)).map((a) => a.id),
    )
    return {
      region: value,
      beneficiaries: inRegion.length,
      accepted: accepted.length,
      // Guarded: a region with no decided application shows an em dash, not NaN.
      acceptanceRate: decided.length ? Math.round((accepted.length / decided.length) * 100) : null,
      disbursed: disbursements
        .filter((d) => d.status === 'paid' && funded.has(d.applicationId))
        .reduce((sum, d) => sum + d.amount, 0),
    }
  }).filter((row) => row.beneficiaries > 0)

  const reports: Record<ReportTab, { rows: any[]; columns: ReportColumn[] }> = {
    applications: {
      rows: filteredApplications,
      columns: [
        { key: 'ref', label: t('applications.columns.ref'), render: (r) => <span className="tabular">{r.ref}</span>, raw: (r) => r.ref },
        { key: 'name', label: t('common.beneficiary'), render: (r) => r.beneficiary.fullName, raw: (r) => r.beneficiary.fullName },
        { key: 'region', label: t('common.region'), render: (r) => t(`region.${r.beneficiary.region}`), raw: (r) => r.beneficiary.region },
        { key: 'amount', label: t('common.amount'), align: 'end', render: (r) => <Money value={r.project.requestedAmount} />, raw: (r) => r.project.requestedAmount },
        { key: 'status', label: t('common.status'), render: (r) => <StatusBadge status={r.status} />, raw: (r) => r.status },
        { key: 'created', label: t('common.createdAt'), render: (r) => <DateText value={r.createdAt} />, raw: (r) => r.createdAt.slice(0, 10) },
        {
          key: 'decisionDays',
          label: t('reports.decisionDays'),
          align: 'end',
          // `null` = not decided yet; never rendered as 0 days.
          render: (r) => <span className="tabular">{daysToDecision(r) === null ? '—' : Math.round(daysToDecision(r)!)}</span>,
          raw: (r) => (daysToDecision(r) === null ? '' : Math.round(daysToDecision(r)!)),
        },
      ],
    },
    financial: {
      rows: disbursements.filter(
        (d) => inRange(d.orderedAt ?? d.paidAt ?? '') && appMatches(appById.get(d.applicationId)),
      ),
      columns: [
        { key: 'order', label: t('disbursement.orderNo'), render: (r) => <span className="tabular">{r.orderNo}</span>, raw: (r) => r.orderNo },
        { key: 'name', label: t('common.beneficiary'), render: (r) => appById.get(r.applicationId)?.beneficiary.fullName ?? '—', raw: (r) => appById.get(r.applicationId)?.beneficiary.fullName ?? '' },
        { key: 'bank', label: t('disbursement.bank'), render: (r) => r.bankName, raw: (r) => r.bankName },
        { key: 'amount', label: t('common.amount'), align: 'end', render: (r) => <Money value={r.amount} />, raw: (r) => r.amount },
        { key: 'status', label: t('common.status'), render: (r) => t(`disbursement.statuses.${r.status}`), raw: (r) => r.status },
        { key: 'paid', label: t('disbursement.paidAt'), render: (r) => (r.paidAt ? <DateText value={r.paidAt} /> : '—'), raw: (r) => r.paidAt?.slice(0, 10) ?? '' },
      ],
    },
    impact: {
      rows: followUps.filter(
        (f) => f.submittedAt && inRange(f.submittedAt) && appMatches(appById.get(f.applicationId)),
      ),
      columns: [
        { key: 'project', label: t('common.project'), render: (r) => appById.get(r.applicationId)?.project.name ?? '—', raw: (r) => appById.get(r.applicationId)?.project.name ?? '' },
        { key: 'period', label: t('followUp.period'), render: (r) => r.period, raw: (r) => r.period },
        { key: 'revenue', label: t('followUp.revenue'), align: 'end', render: (r) => <Money value={r.performance.revenue} />, raw: (r) => r.performance.revenue },
        { key: 'employees', label: t('followUp.employees'), align: 'end', render: (r) => <span className="tabular">{r.performance.employees}</span>, raw: (r) => r.performance.employees },
        { key: 'growth', label: t('followUp.growth'), align: 'end', render: (r) => <span className="tabular">{r.performance.growthPct}%</span>, raw: (r) => r.performance.growthPct },
        { key: 'health', label: t('common.status'), render: (r) => t(`followUp.health.${r.healthStatus}`), raw: (r) => r.healthStatus },
      ],
    },
    geographic: {
      rows: geographicRows,
      columns: [
        { key: 'region', label: t('common.region'), render: (r) => t(`region.${r.region}`), raw: (r) => r.region },
        { key: 'beneficiaries', label: t('reports.beneficiaries'), align: 'end', render: (r) => <span className="tabular">{r.beneficiaries}</span>, raw: (r) => r.beneficiaries },
        { key: 'accepted', label: t('dashboard.staff.approved'), align: 'end', render: (r) => <span className="tabular">{r.accepted}</span>, raw: (r) => r.accepted },
        { key: 'acceptanceRate', label: t('dashboard.kpi.approvalRate'), align: 'end', render: (r) => <span className="tabular">{r.acceptanceRate === null ? '—' : `${r.acceptanceRate}%`}</span>, raw: (r) => r.acceptanceRate ?? '' },
        { key: 'disbursed', label: t('dashboard.kpi.disbursedAmount'), align: 'end', render: (r) => <Money value={r.disbursed} />, raw: (r) => r.disbursed },
      ],
    },
    performance: {
      rows: dashboard?.staff ?? [],
      columns: [
        { key: 'name', label: t('dashboard.staff.name'), render: (r) => r.name, raw: (r) => r.name },
        { key: 'handled', label: t('dashboard.staff.handled'), align: 'end', render: (r) => <span className="tabular">{r.handled}</span>, raw: (r) => r.handled },
        { key: 'approved', label: t('dashboard.staff.approved'), align: 'end', render: (r) => <span className="tabular">{r.approved}</span>, raw: (r) => r.approved },
        { key: 'avgDays', label: t('dashboard.staff.avgDays'), align: 'end', render: (r) => <span className="tabular">{r.avgDays}</span>, raw: (r) => r.avgDays },
      ],
    },
  }

  const active = reports[tab]

  const exportCsv = () => {
    const header = active.columns.map((c) => c.label)
    const body = active.rows.map((row) => active.columns.map((c) => c.raw(row)))
    const csv = [header, ...body]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${tab}-report-${new Date().toISOString().slice(0, 10)}.csv`
    /*
      The anchor must be in the document and the object URL must outlive the
      click — revoking synchronously races the browser's download and can produce
      a zero-byte or failed file.
    */
    link.style.display = 'none'
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('reports.title')}
        subtitle={t('reports.subtitle')}
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              {t('common.print')}
            </Button>
            <Button onClick={exportCsv} disabled={active.rows.length === 0}>
              <DocumentIcon size={16} />
              {t('common.exportCsv')}
            </Button>
          </>
        }
      />

      <SectionCard className="print:hidden">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="from">{t('reports.dateFrom')}</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">{t('reports.dateTo')}</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="region">{t('common.region')}</Label>
            <Select value={region} onValueChange={(value) => setRegion(value as Region | 'all')}>
              <SelectTrigger id="region" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                {REGIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`region.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status">{t('common.status')}</Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as ApplicationStatus | 'all')}
            >
              <SelectTrigger id="status" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                {APPLICATION_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`status.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sector">{t('common.sector')}</Label>
            <Select value={sector} onValueChange={(value) => setSector(value as Sector | 'all')}>
              <SelectTrigger id="sector" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                {SECTORS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`sector.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasFilter ? (
            <Button
              variant="ghost"
              onClick={() => {
                setFrom('')
                setTo('')
                setRegion('all')
                setStatus('all')
                setSector('all')
              }}
            >
              {t('common.clearAll')}
            </Button>
          ) : null}
          <p className="ms-auto text-sm text-muted-foreground">
            {t('reports.rows')}:{' '}
            <span className="font-semibold tabular">{isLoading ? '—' : active.rows.length}</span>
          </p>
        </div>
      </SectionCard>

      <Tabs value={tab} onValueChange={(value) => setTab(value as ReportTab)}>
        <TabsList className="print:hidden">
          {REPORT_TABS.map((key) => (
            <TabsTrigger key={key} value={key}>
              {t(`reports.tabs.${key}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={tab} className="mt-5">
          <SectionCard title={t(`reports.tabs.${tab}`)} flush>
            {!isLoading && active.rows.length === 0 ? (
              <EmptyState icon={<ReportsIcon size={22} />} title={t('reports.empty')} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {active.columns.map((column) => (
                        <th
                          key={column.key}
                          className={cn(
                            'whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground',
                            column.align === 'end' ? 'text-end' : 'text-start',
                          )}
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading
                      ? /* Placeholder rows hold the table's height so the report
                           does not jump when the data lands. */
                        Array.from({ length: 6 }).map((_, rowIndex) => (
                          <tr key={`skeleton-${rowIndex}`} className="border-b border-border last:border-0">
                            {active.columns.map((column, colIndex) => (
                              <td key={column.key} className="px-5 py-3">
                                <Skeleton
                                  className="h-4"
                                  style={{
                                    width: `${[70, 90, 55, 80, 45, 65][(rowIndex + colIndex) % 6]}%`,
                                  }}
                                />
                              </td>
                            ))}
                          </tr>
                        ))
                      : active.rows.map((row, index) => (
                          <tr key={row.id ?? row.name ?? index} className="border-b border-border last:border-0">
                            {active.columns.map((column) => (
                              <td
                                key={column.key}
                                className={cn('px-5 py-3', column.align === 'end' && 'text-end')}
                              >
                                {column.render(row)}
                              </td>
                            ))}
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        {t('reports.generatedAt')} <DateText value={new Date().toISOString()} withTime />
      </p>
    </div>
  )
}
