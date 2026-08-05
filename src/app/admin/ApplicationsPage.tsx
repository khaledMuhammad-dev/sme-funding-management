import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DataTable,
  DataTableFacetFilter,
  PageHeader,
  type BulkAction,
} from '@/components/shared'
import { ApplicationsIcon, CheckIcon, DocumentIcon } from '@/components/icons'
import { APPLICATION_STATUSES, REGIONS, SECTORS } from '@/data/types'
import type { Application, ApplicationStatus, Region, Sector } from '@/data/types'
import { canTransition } from '@/data/statusFlow'
import { useApplications, useStatusCounts, useUpdateStatus } from '@/lib/api'
import { useApplicationColumns } from '@/features/applications/useApplicationColumns'
import { StatusTransitionDialog } from '@/features/applications/StatusTransitionDialog'
import { AssignDialog } from '@/features/applications/AssignDialog'
import { ROUTES } from '../routes'
import { cn } from '@/lib/utils'

type Tab = ApplicationStatus | 'all'

export default function ApplicationsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [tab, setTab] = useState<Tab>('all')
  const [regions, setRegions] = useState<Region[]>([])
  const [sectors, setSectors] = useState<Sector[]>([])
  const [transitionFor, setTransitionFor] = useState<Application | null>(null)
  const [assignFor, setAssignFor] = useState<Application | null>(null)

  const filters = useMemo(
    () => ({ status: tab, region: regions, sector: sectors }),
    [tab, regions, sectors],
  )

  const { data: applications = [], isLoading, isError, refetch } = useApplications(filters)
  const { data: counts = [] } = useStatusCounts()
  const updateStatus = useUpdateStatus()

  const openTransition = useCallback((app: Application) => setTransitionFor(app), [])
  const openAssign = useCallback((app: Application) => setAssignFor(app), [])
  const columns = useApplicationColumns(openTransition, openAssign)

  const total = counts.reduce((sum, entry) => sum + entry.count, 0)

  const bulkActions: BulkAction<Application>[] = [
    {
      key: 'review',
      label: t('applications.bulk.moveToReview'),
      icon: <CheckIcon size={15} />,
      // Only enabled while every selected row can legally make the move.
      disabled: (rows) => !rows.every((row) => canTransition(row.status, 'under_review')),
      // Sequential on purpose: each write lands in the store before the next
      // one reads it, and the toast only fires once the batch is really done.
      onSelect: async (rows) => {
        for (const row of rows) {
          await updateStatus.mutateAsync({ applicationId: row.id, to: 'under_review' })
        }
        toast.success(t('applications.bulk.done', { count: rows.length }))
      },
    },
    {
      key: 'export',
      label: t('applications.bulk.export'),
      icon: <DocumentIcon size={15} />,
      onSelect: (rows) => exportCsv(rows, t),
    },
  ]

  const isFiltered = regions.length > 0 || sectors.length > 0 || tab !== 'all'

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('applications.title')}
        subtitle={t('applications.subtitle')}
        actions={
          <Button variant="outline" onClick={() => exportCsv(applications, t)}>
            <DocumentIcon size={16} />
            {t('common.exportCsv')}
          </Button>
        }
        below={
          <div
            className="-mx-1 flex gap-1 overflow-x-auto pb-1"
            role="tablist"
            aria-label={t('applications.columns.status')}
          >
            <StatusTab label={t('common.all')} count={total} active={tab === 'all'} onClick={() => setTab('all')} />
            {APPLICATION_STATUSES.map((status) => (
              <StatusTab
                key={status}
                label={t(`status.${status}`)}
                count={counts.find((c) => c.status === status)?.count ?? 0}
                active={tab === status}
                onClick={() => setTab(status)}
              />
            ))}
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={applications}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        onRowClick={(row) => navigate(ROUTES.application(row.id))}
        bulkActions={bulkActions}
        isFiltered={isFiltered}
        onResetFilters={() => {
          setRegions([])
          setSectors([])
          setTab('all')
        }}
        emptyIcon={<ApplicationsIcon size={22} />}
        initialPageSize={10}
        filters={
          <>
            <DataTableFacetFilter
              title={t('common.region')}
              options={REGIONS.map((region) => ({ value: region, label: t(`region.${region}`) }))}
              selected={regions}
              onChange={setRegions}
            />
            <DataTableFacetFilter
              title={t('common.sector')}
              options={SECTORS.map((sector) => ({ value: sector, label: t(`sector.${sector}`) }))}
              selected={sectors}
              onChange={setSectors}
            />
          </>
        }
      />

      <StatusTransitionDialog
        application={transitionFor}
        open={Boolean(transitionFor)}
        onOpenChange={(open) => !open && setTransitionFor(null)}
      />

      <AssignDialog
        application={assignFor}
        open={Boolean(assignFor)}
        onOpenChange={(open) => !open && setAssignFor(null)}
      />
    </div>
  )
}

function StatusTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      )}
    >
      {label}
      <span
        className={cn(
          'rounded-full px-1.5 text-xs tabular',
          active ? 'bg-primary-foreground/20' : 'bg-muted',
        )}
      >
        {count}
      </span>
    </button>
  )
}

/** Client-side CSV export — the demo has no server to generate one. */
function exportCsv(rows: Application[], t: (key: string) => string) {
  const header = [
    t('applications.columns.ref'),
    t('applications.columns.beneficiary'),
    t('applications.columns.project'),
    t('applications.columns.region'),
    t('applications.columns.amount'),
    t('applications.columns.score'),
    t('applications.columns.status'),
  ]

  const body = rows.map((row) => [
    row.ref,
    row.beneficiary.fullName,
    row.project.name,
    t(`region.${row.beneficiary.region}`),
    row.project.requestedAmount,
    row.score?.total ?? '',
    t(`status.${row.status}`),
  ])

  const csv = [header, ...body]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  // BOM so Excel opens Arabic correctly.
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `applications-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
