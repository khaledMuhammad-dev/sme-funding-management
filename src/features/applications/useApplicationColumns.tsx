import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Application } from '@/data/types'
import {
  actionsColumn,
  createAppColumnHelper,
  DateText,
  Money,
  NumericCell,
  selectColumn,
  sortableHeader,
  StatusBadge,
  type AppColumnDef,
  type RowAction,
} from '@/components/shared'
import { ApplicationsIcon, DocumentIcon, InterviewIcon, UserIcon } from '@/components/icons'
import { initialsOf } from '@/lib/format'
import { ROUTES } from '@/app/routes'

/**
 * The applications table's column set.
 *
 * Built from the shared factories — the checkbox, the sortable headers and the
 * row menu are the same components every other table uses.
 */
export function useApplicationColumns(
  onChangeStatus: (app: Application) => void,
  onAssign?: (app: Application) => void,
) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return useMemo<AppColumnDef<Application>[]>(() => {
    const helper = createAppColumnHelper<Application>()

    const rowActions: RowAction<Application>[] = [
      {
        key: 'open',
        label: t('common.details'),
        icon: <ApplicationsIcon size={15} />,
        onSelect: (app) => navigate(ROUTES.application(app.id)),
      },
      {
        key: 'documents',
        label: t('applications.detail.tabs.documents'),
        icon: <DocumentIcon size={15} />,
        onSelect: (app) => navigate(`${ROUTES.application(app.id)}?tab=documents`),
      },
      {
        key: 'status',
        label: t('applications.detail.changeStatus'),
        icon: <InterviewIcon size={15} />,
        onSelect: onChangeStatus,
      },
      ...(onAssign
        ? [
            {
              key: 'assign',
              label: t('applications.assign.action'),
              icon: <UserIcon size={15} />,
              onSelect: onAssign,
            } satisfies RowAction<Application>,
          ]
        : []),
    ]

    return [
      selectColumn<Application>({ selectAll: t('table.selectAll'), selectRow: t('table.selectRow') }),

      helper.accessor('ref', {
        header: sortableHeader(t('applications.columns.ref')),
        meta: { label: t('applications.columns.ref'), width: 150 },
        cell: ({ getValue }) => <span className="font-medium tabular">{getValue()}</span>,
      }),

      helper.accessor((row) => row.beneficiary.fullName, {
        id: 'beneficiary',
        header: sortableHeader(t('applications.columns.beneficiary')),
        meta: { label: t('applications.columns.beneficiary') },
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
              {initialsOf(row.original.beneficiary.fullName)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium">{row.original.beneficiary.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {t(`region.${row.original.beneficiary.region}`)}
              </p>
            </div>
          </div>
        ),
      }),

      helper.accessor((row) => row.project.name, {
        id: 'project',
        header: sortableHeader(t('applications.columns.project')),
        meta: { label: t('applications.columns.project') },
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate">{row.original.project.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {t(`sector.${row.original.project.sector}`)}
            </p>
          </div>
        ),
      }),

      helper.accessor((row) => row.project.requestedAmount, {
        id: 'amount',
        header: sortableHeader(t('applications.columns.amount'), 'end'),
        meta: { label: t('applications.columns.amount'), align: 'end' },
        cell: ({ getValue }) => (
          <NumericCell>
            <Money value={getValue()} />
          </NumericCell>
        ),
      }),

      helper.accessor((row) => row.score?.total ?? -1, {
        id: 'score',
        header: sortableHeader(t('applications.columns.score'), 'end'),
        meta: { label: t('applications.columns.score'), align: 'end', width: 90 },
        cell: ({ getValue }) => {
          const score = getValue()
          if (score < 0) return <NumericCell><span className="text-muted-foreground">—</span></NumericCell>
          return (
            <NumericCell>
              <span
                className={
                  score >= 70
                    ? 'font-semibold text-success'
                    : score >= 50
                      ? 'font-semibold text-warning'
                      : 'font-semibold text-destructive'
                }
              >
                {score}
              </span>
            </NumericCell>
          )
        },
      }),

      helper.accessor('status', {
        header: sortableHeader(t('applications.columns.status')),
        meta: { label: t('applications.columns.status'), width: 170 },
        cell: ({ getValue }) => <StatusBadge status={getValue()} />,
      }),

      helper.accessor((row) => row.assignee ?? '', {
        id: 'assignee',
        header: sortableHeader(t('applications.columns.assignee')),
        meta: { label: t('applications.columns.assignee') },
        cell: ({ getValue }) =>
          getValue() ? (
            <span className="text-sm">{getValue()}</span>
          ) : (
            <span className="text-sm text-muted-foreground">{t('common.unassigned')}</span>
          ),
      }),

      helper.accessor('createdAt', {
        header: sortableHeader(t('applications.columns.createdAt')),
        meta: { label: t('applications.columns.createdAt'), width: 130 },
        cell: ({ getValue }) => (
          <DateText value={getValue()} className="text-sm text-muted-foreground" />
        ),
      }),

      actionsColumn<Application>(rowActions, t('common.actions')),
    ] as AppColumnDef<Application>[]
  }, [t, navigate, onChangeStatus, onAssign])
}
