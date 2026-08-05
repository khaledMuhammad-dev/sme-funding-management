import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DateText,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/shared'
import {
  AlertIcon,
  ApplicationsIcon,
  ChartIcon,
  CheckIcon,
  ClockIcon,
  FollowUpIcon,
  MoneyIcon,
  UserIcon,
  XIcon,
} from '@/components/icons'
import { useDashboard, useApplications } from '@/lib/api'
import { useUiStore } from '@/stores/useUiStore'
import { formatCurrency, formatNumber } from '@/lib/format'
import { ROUTES } from '../routes'

const STATUS_FILL: Record<string, string> = {
  new: 'var(--status-new)',
  incomplete: 'var(--status-incomplete)',
  under_review: 'var(--status-under-review)',
  awaiting_interview: 'var(--status-awaiting-interview)',
  approved: 'var(--status-approved)',
  rejected: 'var(--status-rejected)',
  disbursed: 'var(--status-disbursed)',
  follow_up: 'var(--status-follow-up)',
}

/** Shared chart chrome — one tooltip and one grid style across the dashboard. */
const AXIS = {
  stroke: 'var(--muted-foreground)',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
}

/**
 * Gutter for a y-axis whose ticks are compact currency.
 *
 * "SAR 600k" and "‏600 ألف ر.س." are both far wider than a bare count, and
 * Recharts anchors a tick to the axis line and lets the overflow fall outside
 * the SVG — so an axis that is too narrow silently crops the label's first
 * characters rather than wrapping or shrinking it.
 */
const CURRENCY_AXIS_WIDTH = 78

function ChartTooltip() {
  return (
    <Tooltip
      cursor={{ fill: 'var(--accent)', opacity: 0.5 }}
      contentStyle={{
        background: 'var(--popover)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        fontSize: 12,
        color: 'var(--popover-foreground)',
      }}
    />
  )
}

/** Empty panel that occupies exactly the height of the chart it stands in for. */
function ChartEmpty({ height = 240 }: { height?: number }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-center" style={{ height }}>
      <EmptyState icon={<ChartIcon size={22} />} title={t('dashboard.charts.empty')} />
    </div>
  )
}

export default function DashboardPage() {
  const { t } = useTranslation()
  const lang = useUiStore((s) => s.lang)
  const { data, isLoading } = useDashboard()
  const { data: applications = [], isLoading: applicationsLoading } = useApplications()

  const recent = [...applications]
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .slice(0, 6)

  if (isLoading || !data) {
    /*
      The skeleton mirrors the loaded layout card-for-card — eight KPI tiles,
      five chart panels (the last one full width) and the two bottom panels.
      An approximate skeleton is worse than none here: the simulated read takes
      380–720 ms, so any missing block shows up as a visible jump on arrival.
    */
    return (
      <div className="space-y-6" role="status" aria-busy="true" aria-label={t('common.loading')}>
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[21rem] rounded-xl" />
          ))}
          <Skeleton className="h-[21rem] rounded-xl lg:col-span-2" />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  /*
    With an empty database every series collapses to zeros, which Recharts still
    draws as a full set of axes — a chart that looks broken rather than empty.
    One flag drives the localized empty state across all five panels.
  */
  const hasChartData = data.kpi.total > 0

  return (
    <div className="space-y-6">
      <PageHeader title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} />

      {/* The client's KPI list, in their order, then two supporting extras. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('dashboard.kpi.total')} value={data.kpi.total} icon={<ApplicationsIcon size={18} />} />
        <StatCard
          label={t('dashboard.kpi.approvalRate')}
          value={data.kpi.approvalRate}
          format={(value) => `${value}%`}
          icon={<CheckIcon size={18} />}
        />
        <StatCard
          label={t('dashboard.kpi.rejectionRate')}
          value={data.kpi.rejectionRate}
          format={(value) => `${value}%`}
          icon={<XIcon size={18} />}
        />
        <StatCard
          label={t('dashboard.kpi.disbursedAmount')}
          value={data.kpi.disbursedAmount}
          format={(value) => formatCurrency(value, lang, true)}
          icon={<MoneyIcon size={18} />}
          featured
        />
        <StatCard
          label={t('dashboard.kpi.avgProcessingDays')}
          value={data.kpi.avgProcessingDays}
          /* No decided application yet — an em dash, never "0 days". */
          format={(value) =>
            value > 0 ? `${formatNumber(value, lang)} ${t('common.days')}` : '—'
          }
          icon={<ClockIcon size={18} />}
        />
        <StatCard
          label={t('dashboard.kpi.strugglingProjects')}
          value={data.kpi.strugglingProjects}
          icon={<AlertIcon size={18} />}
        />
        <StatCard label={t('dashboard.kpi.activeProjects')} value={data.kpi.activeProjects} icon={<FollowUpIcon size={18} />} />
        <StatCard label={t('dashboard.kpi.avgScore')} value={data.kpi.avgScore} icon={<ChartIcon size={18} />} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title={t('dashboard.charts.statusDonut')}>
          {!hasChartData ? (
            <ChartEmpty height={220} />
          ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <ResponsiveContainer width="100%" height={220} className="max-w-[220px]">
              <PieChart>
                <Pie
                  data={data.byStatus}
                  dataKey="count"
                  nameKey="status"
                  innerRadius={54}
                  outerRadius={86}
                  paddingAngle={2}
                  stroke="var(--card)"
                  strokeWidth={2}
                >
                  {data.byStatus.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_FILL[entry.status]} />
                  ))}
                </Pie>
                <ChartTooltip />
              </PieChart>
            </ResponsiveContainer>

            {/* Legend carries the label — the wedge colour is never the only cue. */}
            <ul className="flex flex-1 flex-wrap gap-x-4 gap-y-2">
              {data.byStatus.map((entry) => (
                <li key={entry.status} className="flex items-center gap-2 text-sm">
                  <span
                    className="size-2.5 shrink-0 rounded-sm"
                    style={{ background: STATUS_FILL[entry.status] }}
                  />
                  <span className="text-muted-foreground">{t(`status.${entry.status}`)}</span>
                  <span className="font-semibold tabular">{entry.count}</span>
                </li>
              ))}
            </ul>
          </div>
          )}
        </SectionCard>

        <SectionCard title={t('dashboard.charts.timeline')}>
          {!hasChartData ? <ChartEmpty /> : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.overTime} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="submitted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="approved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" {...AXIS} />
              <YAxis {...AXIS} width={38} />
              <ChartTooltip />
              <Area
                type="monotone"
                dataKey="submitted"
                name={t('dashboard.kpi.total')}
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#submitted)"
              />
              <Area
                type="monotone"
                dataKey="approved"
                name={t('status.approved')}
                stroke="var(--chart-2)"
                strokeWidth={2}
                fill="url(#approved)"
              />
            </AreaChart>
          </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard title={t('dashboard.charts.regions')}>
          {!hasChartData ? <ChartEmpty /> : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.byRegion} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="region" tickFormatter={(value) => t(`region.${value}`)} {...AXIS} />
              <YAxis {...AXIS} width={38} />
              <ChartTooltip />
              <Bar dataKey="count" name={t('dashboard.kpi.total')} fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard title={t('dashboard.charts.disbursementByMonth')}>
          {!hasChartData ? <ChartEmpty /> : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.disbursementByMonth} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" {...AXIS} />
              {/* Wide enough for a compact currency tick — at 54 the label was
                  clipped to "AR 600k" in English and ran off the card in Arabic. */}
              <YAxis {...AXIS} width={CURRENCY_AXIS_WIDTH} tickFormatter={(value) => formatCurrency(value, lang, true)} />
              <ChartTooltip />
              <Bar dataKey="amount" name={t('dashboard.kpi.disbursedAmount')} fill="var(--chart-3)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard title={t('dashboard.charts.impact')} className="lg:col-span-2">
          {!hasChartData ? <ChartEmpty /> : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.impact} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" {...AXIS} />
              <YAxis {...AXIS} width={CURRENCY_AXIS_WIDTH} tickFormatter={(value) => formatCurrency(value, lang, true)} />
              <ChartTooltip />
              <Line
                type="monotone"
                dataKey="revenue"
                name={t('followUp.revenue')}
                stroke="var(--chart-4)"
                strokeWidth={2.4}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title={t('dashboard.staff.title')} flush>
          {data.staff.length === 0 ? (
            <EmptyState icon={<UserIcon size={22} />} title={t('dashboard.staff.empty')} />
          ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('dashboard.staff.name')}
                </th>
                <th className="px-5 py-3 text-end text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('dashboard.staff.handled')}
                </th>
                <th className="px-5 py-3 text-end text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('dashboard.staff.approved')}
                </th>
                <th className="px-5 py-3 text-end text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('dashboard.staff.avgDays')}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.staff.map((member) => (
                <tr key={member.name} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 font-medium">{member.name}</td>
                  <td className="px-5 py-3 text-end tabular">{member.handled}</td>
                  <td className="px-5 py-3 text-end tabular text-success">{member.approved}</td>
                  <td className="px-5 py-3 text-end tabular">{member.avgDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </SectionCard>

        <SectionCard title={t('dashboard.activity.title')} flush>
          {applicationsLoading ? (
            /*
              The applications query runs alongside the dashboard one and can
              land later, so gating only on the dashboard would flash the
              "no activity" state and then jump to six rows.
            */
            <div className="p-5" role="status" aria-label={t('common.loading')}>
              <div className="space-y-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-9 w-full" />
                ))}
              </div>
            </div>
          ) : recent.length === 0 ? (
            <EmptyState title={t('dashboard.activity.empty')} />
          ) : (
            <ul>
              {recent.map((application) => (
                <li key={application.id} className="border-b border-border last:border-0">
                  <Link
                    to={ROUTES.application(application.id)}
                    className="flex flex-wrap items-center gap-3 px-5 py-3 transition-colors hover:bg-accent"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {application.beneficiary.fullName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground tabular">
                        {application.ref} · <DateText value={application.updatedAt} />
                      </p>
                    </div>
                    <StatusBadge status={application.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
