import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  ConfirmDialog,
  DataRow,
  DataTable,
  DateText,
  EmptyState,
  Money,
  NumericCell,
  PageHeader,
  StatCard,
  Timeline,
  actionsColumn,
  createAppColumnHelper,
  sortableHeader,
  type AppColumnDef,
} from '@/components/shared'
import { AlertIcon, FollowUpIcon } from '@/components/icons'
import type { Application, FollowUp, HealthStatus } from '@/data/types'
import {
  useApplications,
  useFollowUps,
  useRemindFollowUp,
  useSetProjectHealth,
} from '@/lib/api'
import { useUiStore } from '@/stores/useUiStore'
import { daysBetween, formatCurrency } from '@/lib/format'
import { ROUTES } from '../routes'
import { cn } from '@/lib/utils'
import { byDate } from '@/lib/sort'

/** Real uploads are browser data/blob URLs; fixture entries are bare file paths. */
const isImageSource = (photo: string) => photo.startsWith('data:') || photo.startsWith('blob:')

const HEALTH_CLASS: Record<HealthStatus, string> = {
  on_track: 'bg-success-soft text-success',
  at_risk: 'bg-warning-soft text-warning',
  defaulted: 'bg-destructive-soft text-destructive',
}

/** Tiny revenue trend drawn from the project's own reports. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="text-xs text-muted-foreground">—</span>

  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 60
      const y = 20 - ((value - min) / span) * 18
      return `${x},${y}`
    })
    .join(' ')

  const rising = values[values.length - 1] >= values[0]

  return (
    <svg width="62" height="22" viewBox="0 0 62 22" aria-hidden="true" className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={rising ? 'var(--success)' : 'var(--destructive)'}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Emphasised endpoint — where the project is now. */}
      <circle
        cx={60}
        cy={20 - ((values[values.length - 1] - min) / span) * 18}
        r="2.4"
        fill={rising ? 'var(--success)' : 'var(--destructive)'}
      />
    </svg>
  )
}

interface ProjectRow {
  applicationId: string
  application?: Application
  followUps: FollowUp[]
  latest: FollowUp
  health: HealthStatus
  overdueDays: number
}

export default function FollowUpPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [detailFor, setDetailFor] = useState<ProjectRow | null>(null)
  const [defaultingId, setDefaultingId] = useState<string | null>(null)

  const { data: followUps = [], isLoading } = useFollowUps()
  const { data: applications = [] } = useApplications()
  const remind = useRemindFollowUp()
  const setHealth = useSetProjectHealth()

  const appById = useMemo(() => new Map(applications.map((a) => [a.id, a])), [applications])

  /** One row per funded project, not per report. */
  const rows = useMemo<ProjectRow[]>(() => {
    const byApplication = new Map<string, FollowUp[]>()
    for (const followUp of followUps) {
      const list = byApplication.get(followUp.applicationId) ?? []
      list.push(followUp)
      byApplication.set(followUp.applicationId, list)
    }

    return [...byApplication.entries()].map(([applicationId, list]) => {
      const sorted = [...list].sort(byDate((f) => f.dueDate, 'asc', (f) => f.id))
      const latest = sorted[sorted.length - 1]
      const overdueDays = latest.submittedAt ? 0 : Math.max(0, daysBetween(latest.dueDate))
      return {
        applicationId,
        application: appById.get(applicationId),
        followUps: sorted,
        latest,
        health: latest.healthStatus,
        overdueDays,
      }
    })
  }, [followUps, appById])

  const atRisk = rows.filter((row) => row.health === 'at_risk')
  const defaulted = rows.filter((row) => row.health === 'defaulted')
  const overdue = rows.filter((row) => row.overdueDays > 0)

  // `mutate` is bound to the observer and stable across renders; the mutation
  // *object* is not, and depending on it would rebuild the columns every render
  // — remounting every cell and closing any open row menu mid-click.
  const remindMutate = remind.mutate

  const columns = useMemo<AppColumnDef<ProjectRow>[]>(() => {
    const helper = createAppColumnHelper<ProjectRow>()
    return [
      helper.accessor((row) => row.application?.project.name ?? '', {
        id: 'project',
        header: sortableHeader(t('common.project')),
        meta: { label: t('common.project') },
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.application?.project.name ?? '—'}</p>
            <p className="truncate text-xs text-muted-foreground">
              {row.original.application?.beneficiary.fullName}
            </p>
          </div>
        ),
      }),
      helper.accessor((row) => row.health, {
        id: 'health',
        header: sortableHeader(t('common.status')),
        meta: { label: t('common.status'), width: 140 },
        cell: ({ row }) => (
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-semibold',
              HEALTH_CLASS[row.original.health],
            )}
          >
            {t(`followUp.health.${row.original.health}`)}
          </span>
        ),
      }),
      helper.accessor((row) => row.latest.performance.revenue, {
        id: 'revenue',
        header: sortableHeader(t('followUp.revenue'), 'end'),
        meta: { label: t('followUp.revenue'), align: 'end' },
        cell: ({ getValue }) => (
          <NumericCell>
            <Money value={getValue()} />
          </NumericCell>
        ),
      }),
      helper.display({
        id: 'trend',
        header: t('followUp.growth'),
        meta: { label: t('followUp.growth'), width: 90 },
        cell: ({ row }) => (
          <Sparkline values={row.original.followUps.map((f) => f.performance.revenue)} />
        ),
      }),
      helper.accessor((row) => row.overdueDays, {
        id: 'due',
        header: sortableHeader(t('followUp.dueDate'), 'end'),
        meta: { label: t('followUp.dueDate'), align: 'end', width: 150 },
        cell: ({ row }) =>
          row.original.overdueDays > 0 ? (
            <NumericCell>
              <span className="font-semibold text-destructive">
                {t('common.overdue')} · {row.original.overdueDays}
              </span>
            </NumericCell>
          ) : (
            <NumericCell>
              <DateText value={row.original.latest.dueDate} className="text-muted-foreground" />
            </NumericCell>
          ),
      }),
      actionsColumn<ProjectRow>(
        [
          {
            key: 'detail',
            label: t('followUp.projectDetail'),
            onSelect: (row) => setDetailFor(row),
          },
          {
            /*
             * The beneficiary's own report form is a deep link she receives by
             * SMS. Without an entry point from here the officer can open a
             * project but never the form it is waiting on — the monitoring loop
             * dead-ends. Offered only while a report is still outstanding.
             */
            key: 'openForm',
            label: t('followUp.openForm'),
            hidden: (row) => Boolean(row.latest.submittedAt),
            onSelect: (row) => navigate(ROUTES.followUpForm(row.latest.id)),
          },
          {
            key: 'remind',
            label: t('followUp.sendReminder'),
            hidden: (row) => row.overdueDays === 0,
            onSelect: (row) =>
              remindMutate(row.latest.id, {
                onSuccess: () => toast.success(t('followUp.reminderSent')),
              }),
          },
          {
            key: 'default',
            label: t('followUp.markDefaulted'),
            destructive: true,
            hidden: (row) => row.health === 'defaulted',
            onSelect: (row) => setDefaultingId(row.applicationId),
          },
        ],
        t('common.actions'),
      ),
    ] as AppColumnDef<ProjectRow>[]
  }, [t, remindMutate, navigate])

  return (
    <div className="space-y-6">
      <PageHeader title={t('followUp.title')} subtitle={t('followUp.subtitle')} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Skeletons rather than a momentary "0" on every visit. */}
        <StatCard label={t('dashboard.kpi.activeProjects')} value={rows.length} isLoading={isLoading} />
        <StatCard label={t('followUp.health.at_risk')} value={atRisk.length} isLoading={isLoading} />
        <StatCard label={t('followUp.health.defaulted')} value={defaulted.length} isLoading={isLoading} />
        <StatCard label={t('common.overdue')} value={overdue.length} isLoading={isLoading} />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.applicationId}
        isLoading={isLoading}
        onRowClick={(row) => setDetailFor(row)}
        emptyIcon={<FollowUpIcon size={22} />}
        emptyTitle={t('followUp.empty')}
        emptyHint={t('followUp.emptyHint')}
      />

      <ProjectDetailSheet
        row={detailFor}
        onClose={() => setDetailFor(null)}
        onMarkDefaulted={(row) => {
          // Close the sheet first: two stacked modal overlays fight over focus.
          setDetailFor(null)
          setDefaultingId(row.applicationId)
        }}
      />

      <MarkDefaultedDialog
        applicationId={defaultingId}
        onClose={() => setDefaultingId(null)}
        isPending={setHealth.isPending}
        onConfirm={(applicationId, reason) =>
          setHealth.mutate(
            { applicationId, health: 'defaulted', reason },
            {
              onSuccess: () => {
                toast.success(t('followUp.markedDefaulted'))
                setDefaultingId(null)
              },
            },
          )
        }
      />
    </div>
  )
}

/** Marking a project defaulted is irreversible in the demo — it always asks for a reason. */
function MarkDefaultedDialog({
  applicationId,
  onClose,
  onConfirm,
  isPending,
}: {
  applicationId: string | null
  onClose: () => void
  onConfirm: (applicationId: string, reason: string) => void
  isPending: boolean
}) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')

  return (
    <ConfirmDialog
      open={Boolean(applicationId)}
      onOpenChange={(open) => {
        if (!open) {
          setReason('')
          onClose()
        }
      }}
      title={t('followUp.markDefaulted')}
      description={t('followUp.markDefaultedHint')}
      confirmLabel={t('followUp.markDefaulted')}
      destructive
      isPending={isPending}
      disabled={reason.trim().length < 3}
      onConfirm={() => applicationId && onConfirm(applicationId, reason.trim())}
    >
      <div className="space-y-1.5">
        <Label htmlFor="default-reason">{t('common.reason')}</Label>
        <Textarea
          id="default-reason"
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
    </ConfirmDialog>
  )
}

function ProjectDetailSheet({
  row,
  onClose,
  onMarkDefaulted,
}: {
  row: ProjectRow | null
  onClose: () => void
  onMarkDefaulted: (row: ProjectRow) => void
}) {
  const { t } = useTranslation()
  const lang = useUiStore((s) => s.lang)
  const remind = useRemindFollowUp()

  /**
   * Uploaded photos arrive as data URLs from the beneficiary form; the seeded
   * fixtures only carry file paths, so both shapes render side by side.
   */
  const photos = row ? row.followUps.flatMap((followUp) => followUp.photos) : []

  return (
    <Sheet open={Boolean(row)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={lang === 'ar' ? 'left' : 'right'}
        className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg [&>*]:min-w-0"
      >
        {row ? (
          <>
            <SheetHeader className="border-b border-border p-5">
              <SheetTitle>{row.application?.project.name}</SheetTitle>
              <SheetDescription>
                {row.application?.beneficiary.fullName} · {row.application?.ref}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 p-5">
              <dl className="grid gap-x-6 sm:grid-cols-2">
                <DataRow
                  label={t('common.status')}
                  value={
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
                        HEALTH_CLASS[row.health],
                      )}
                    >
                      {t(`followUp.health.${row.health}`)}
                    </span>
                  }
                />
                <DataRow label={t('common.amount')} value={<Money value={row.application?.project.requestedAmount ?? 0} />} />
              </dl>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">{t('followUp.impact')}</h3>
                <div className="rounded-lg border border-border p-4">
                  <p className="mb-2 text-xs text-muted-foreground">{t('followUp.impactChart')}</p>
                  <div data-testid="impact-chart" className="min-w-0">
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart
                        data={row.followUps.map((followUp) => ({
                          period: followUp.period,
                          revenue: followUp.performance.revenue,
                        }))}
                        margin={{ top: 6, right: 6, bottom: 0, left: -14 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis
                          dataKey="period"
                          stroke="var(--muted-foreground)"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="var(--muted-foreground)"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          width={52}
                          tickFormatter={(value: number) => formatCurrency(value, lang, true)}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--popover)',
                            border: '1px solid var(--border)',
                            borderRadius: 10,
                            fontSize: 12,
                            color: 'var(--popover-foreground)',
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          name={t('followUp.revenue')}
                          stroke="var(--chart-4)"
                          strokeWidth={2.4}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-x-4">
                    <DataRow
                      label={t('followUp.revenue')}
                      value={<Money value={row.latest.performance.revenue} />}
                    />
                    <DataRow
                      label={t('followUp.employees')}
                      value={<span className="tabular">{row.latest.performance.employees}</span>}
                    />
                    <DataRow
                      label={t('followUp.growth')}
                      value={
                        <span
                          className={cn(
                            'tabular font-semibold',
                            row.latest.performance.growthPct < 0 ? 'text-destructive' : 'text-success',
                          )}
                        >
                          {row.latest.performance.growthPct}%
                        </span>
                      }
                    />
                  </dl>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">{t('followUp.reportHistory')}</h3>
                <ul className="space-y-2">
                  {row.followUps.map((followUp) => (
                    <li
                      key={followUp.id}
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 text-sm"
                    >
                      <span className="font-semibold">{followUp.period}</span>
                      <Money value={followUp.performance.revenue} className="text-muted-foreground" />
                      <span className="ms-auto text-xs text-muted-foreground">
                        {followUp.submittedAt ? (
                          <DateText value={followUp.submittedAt} />
                        ) : (
                          <span className="font-semibold text-destructive">{t('common.overdue')}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold">{t('followUp.photos')}</h3>
                  <span data-testid="photo-total" className="text-xs text-muted-foreground tabular">
                    {photos.length}
                  </span>
                </div>
                {photos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('followUp.noPhotos')}</p>
                ) : (
                  <ul data-testid="photo-gallery" className="grid grid-cols-3 gap-2">
                    {photos.map((photo, index) => (
                      <li key={`${index}-${photo.slice(-24)}`}>
                        {isImageSource(photo) ? (
                          // A real photo the beneficiary uploaded from her phone.
                          <img
                            src={photo}
                            alt={t('followUp.photos')}
                            data-testid="photo-image"
                            className="aspect-square w-full rounded-lg border border-border object-cover"
                          />
                        ) : (
                          // Demo fixtures ship no binaries — the file name stands in for the image.
                          <span className="flex aspect-square items-center justify-center rounded-lg border border-border bg-muted p-2 text-center text-[10px] leading-tight text-muted-foreground">
                            <span className="line-clamp-3 break-all">{photo.split('/').pop()}</span>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {row.application ? (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">{t('timeline.title')}</h3>
                  <Timeline events={row.application.timeline.slice(-5)} order="desc" />
                </section>
              ) : null}

              <div className="flex flex-wrap gap-3">
                {row.latest.submittedAt ? null : (
                  <Button asChild variant="outline" className="flex-1">
                    <Link to={ROUTES.followUpForm(row.latest.id)}>{t('followUp.openForm')}</Link>
                  </Button>
                )}
                <Button
                  className="flex-1"
                  disabled={remind.isPending}
                  onClick={() =>
                    remind.mutate(row.latest.id, {
                      onSuccess: () => toast.success(t('followUp.reminderSent')),
                    })
                  }
                >
                  <AlertIcon size={16} />
                  {t('followUp.sendReminder')}
                </Button>
                {row.health === 'defaulted' ? null : (
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => onMarkDefaulted(row)}
                  >
                    {t('followUp.markDefaulted')}
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : (
          <EmptyState title={t('followUp.empty')} />
        )}
      </SheetContent>
    </Sheet>
  )
}
