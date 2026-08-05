import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  ConfirmDialog,
  DataRow,
  DataTable,
  DateText,
  Money,
  NumericCell,
  PageHeader,
  StatCard,
  actionsColumn,
  createAppColumnHelper,
  selectColumn,
  sortableHeader,
  type AppColumnDef,
  type BulkAction,
} from '@/components/shared'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { CheckIcon, DisbursementIcon, MoneyIcon } from '@/components/icons'
import type { Application, Disbursement } from '@/data/types'
import {
  useApplications,
  useDisbursements,
  useIssueDisbursement,
  useMarkDisbursementPaid,
} from '@/lib/api'
import { useUiStore } from '@/stores/useUiStore'
import { formatCurrency, groupIban, maskIban } from '@/lib/format'
import { cn } from '@/lib/utils'

const STATUS_CLASS: Record<Disbursement['status'], string> = {
  pending: 'bg-muted text-muted-foreground',
  ordered: 'bg-info-soft text-info',
  paid: 'bg-status-disbursed-soft text-status-disbursed',
}

/** Finance signatories offered in the payment-order dialog. */
const APPROVERS = ['فاطمة الأنصاري', 'عمر السالم', 'ليلى الحمد']

/** A disbursement plus the applicant fields the table renders, resolved once. */
type DisbursementRow = Disbursement & { beneficiaryName: string; applicationRef: string }

type Tab = Disbursement['status'] | 'all'

const TAB_ORDER: Tab[] = ['all', 'pending', 'ordered', 'paid']

export default function DisbursementsPage() {
  const { t } = useTranslation()
  const lang = useUiStore((s) => s.lang)
  const [tab, setTab] = useState<Tab>('all')
  const [confirmPaid, setConfirmPaid] = useState<Disbursement | null>(null)
  const [orderFor, setOrderFor] = useState<Disbursement[] | null>(null)

  const { data: disbursements = [], isLoading } = useDisbursements()
  const { data: applications = [] } = useApplications()
  const issueOrder = useIssueDisbursement()
  const markPaid = useMarkDisbursementPaid()

  const appById = useMemo(() => new Map(applications.map((a) => [a.id, a])), [applications])

  /**
   * The applicant's name is folded into the row rather than looked up from the
   * column definitions: a column def that closes over `appById` gets a new
   * identity on every applications refetch, which remounts every cell — closing
   * any open row menu mid-click and replaying the row stagger on every mutation.
   */
  const rows = useMemo<DisbursementRow[]>(
    () =>
      (tab === 'all' ? disbursements : disbursements.filter((d) => d.status === tab)).map(
        (disbursement) => {
          const app = appById.get(disbursement.applicationId)
          return {
            ...disbursement,
            beneficiaryName: app?.beneficiary.fullName ?? '—',
            applicationRef: app?.ref ?? '',
          }
        },
      ),
    [disbursements, tab, appById],
  )

  const pending = disbursements.filter((d) => d.status === 'pending')
  const ordered = disbursements.filter((d) => d.status === 'ordered')
  const paid = disbursements.filter((d) => d.status === 'paid')

  const thisMonth = paid.filter(
    (d) => d.paidAt && new Date(d.paidAt).getMonth() === new Date().getMonth(),
  )

  const sum = (list: Disbursement[]) => list.reduce((total, d) => total + d.amount, 0)

  const columns = useMemo<AppColumnDef<DisbursementRow>[]>(() => {
    const helper = createAppColumnHelper<DisbursementRow>()
    return [
      selectColumn<DisbursementRow>({ selectAll: t('table.selectAll'), selectRow: t('table.selectRow') }),
      helper.accessor('orderNo', {
        header: sortableHeader(t('disbursement.orderNo')),
        meta: { label: t('disbursement.orderNo'), width: 150 },
        cell: ({ getValue }) => <span className="font-medium tabular">{getValue()}</span>,
      }),
      helper.accessor('beneficiaryName', {
        id: 'beneficiary',
        header: sortableHeader(t('common.beneficiary')),
        meta: { label: t('common.beneficiary') },
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.beneficiaryName}</p>
            <p className="truncate text-xs text-muted-foreground tabular">
              {row.original.applicationRef}
            </p>
          </div>
        ),
      }),
      helper.accessor('bankName', {
        header: sortableHeader(t('disbursement.bank')),
        meta: { label: t('disbursement.bank') },
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm">{row.original.bankName}</p>
            {/* Masked in the list; the full IBAN only appears in the order dialog. */}
            <p className="truncate text-xs text-muted-foreground tabular" dir="ltr">
              {maskIban(row.original.iban)}
            </p>
          </div>
        ),
      }),
      helper.accessor('amount', {
        header: sortableHeader(t('common.amount'), 'end'),
        meta: { label: t('common.amount'), align: 'end' },
        cell: ({ getValue }) => (
          <NumericCell>
            <Money value={getValue()} />
          </NumericCell>
        ),
      }),
      helper.accessor('status', {
        header: sortableHeader(t('common.status')),
        meta: { label: t('common.status'), width: 140 },
        cell: ({ getValue }) => (
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-semibold',
              STATUS_CLASS[getValue() as Disbursement['status']],
            )}
          >
            {t(`disbursement.statuses.${getValue() as Disbursement['status']}`)}
          </span>
        ),
      }),
      helper.accessor((row) => row.paidAt ?? '', {
        id: 'paidAt',
        header: sortableHeader(t('disbursement.paidAt')),
        meta: { label: t('disbursement.paidAt'), width: 140 },
        cell: ({ getValue }) =>
          getValue() ? (
            <DateText value={getValue()} className="text-sm text-muted-foreground" />
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          ),
      }),
      actionsColumn<DisbursementRow>(
        [
          {
            key: 'issue',
            label: t('disbursement.issueOrder'),
            hidden: (row) => row.status !== 'pending',
            onSelect: (row) => setOrderFor([row]),
          },
          {
            key: 'paid',
            label: t('disbursement.markPaid'),
            hidden: (row) => row.status !== 'ordered',
            onSelect: (row) => setConfirmPaid(row),
          },
        ],
        t('common.actions'),
      ),
    ] as AppColumnDef<DisbursementRow>[]
  }, [t])

  const bulkActions: BulkAction<DisbursementRow>[] = [
    {
      key: 'issue',
      label: t('disbursement.issueBulk'),
      icon: <MoneyIcon size={15} />,
      disabled: (selected) => !selected.every((d) => d.status === 'pending'),
      onSelect: (selected) => setOrderFor(selected),
    },
  ]

  const application = confirmPaid ? appById.get(confirmPaid.applicationId) : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('disbursement.title')}
        subtitle={t('disbursement.subtitle')}
        below={
          <div
            className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
            role="tablist"
            aria-label={t('disbursement.title')}
            /* Arrow-key movement, as a `tablist` implies. Tab still reaches
               every tab individually — this only adds a shortcut. */
            onKeyDown={(event) => {
              const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
              if (!step) return
              event.preventDefault()
              const dir = document.documentElement.dir === 'rtl' ? -step : step
              const next = (TAB_ORDER.indexOf(tab) + dir + TAB_ORDER.length) % TAB_ORDER.length
              setTab(TAB_ORDER[next])
              const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')
              buttons[next]?.focus()
            }}
          >
            {TAB_ORDER.map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={tab === option}
                onClick={() => setTab(option)}
                className={cn(
                  'shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  tab === option
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {option === 'all' ? t('common.all') : t(`disbursement.statuses.${option}`)}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* `isLoading` swaps the number for a same-height skeleton — without it
            the four tiles read a confident "0" for half a second before the
            real figures land. */}
        <StatCard
          label={t('disbursement.kpi.pending')}
          value={pending.length}
          hint={formatCurrency(sum(pending), lang, true)}
          isLoading={isLoading}
        />
        <StatCard
          label={t('disbursement.kpi.ordered')}
          value={ordered.length}
          hint={formatCurrency(sum(ordered), lang, true)}
          isLoading={isLoading}
        />
        <StatCard
          label={t('disbursement.kpi.paidThisMonth')}
          value={sum(thisMonth)}
          format={(value) => formatCurrency(value, lang, true)}
          isLoading={isLoading}
        />
        <StatCard
          label={t('disbursement.kpi.total')}
          value={sum(paid)}
          format={(value) => formatCurrency(value, lang, true)}
          isLoading={isLoading}
          featured
        />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        bulkActions={bulkActions}
        isFiltered={tab !== 'all'}
        onResetFilters={() => setTab('all')}
        emptyIcon={<DisbursementIcon size={22} />}
        emptyTitle={t('disbursement.empty')}
        emptyHint={t('disbursement.emptyHint')}
      />

      <IssueOrderDialog
        disbursements={orderFor}
        appById={appById}
        isPending={issueOrder.isPending}
        onClose={() => setOrderFor(null)}
        onConfirm={(selected) =>
          issueOrder.mutate(
            selected.map((d) => d.applicationId),
            {
              onSuccess: () => {
                toast.success(t('disbursement.dialog.success'))
                setOrderFor(null)
              },
            },
          )
        }
      />

      <ConfirmDialog
        open={Boolean(confirmPaid)}
        onOpenChange={(open) => !open && setConfirmPaid(null)}
        title={t('disbursement.markPaid')}
        description={t('disbursement.dialog.paidDescription')}
        confirmLabel={t('disbursement.markPaid')}
        isPending={markPaid.isPending}
        onConfirm={() => {
          if (!confirmPaid) return
          markPaid.mutate(confirmPaid.id, {
            onSuccess: () => {
              toast.success(t('disbursement.dialog.paidSuccess'))
              setConfirmPaid(null)
            },
          })
        }}
      >
        {confirmPaid && application ? (
          <dl className="grid gap-x-6 rounded-lg bg-muted px-4 py-2 sm:grid-cols-2">
            <DataRow label={t('common.beneficiary')} value={application.beneficiary.fullName} />
            <DataRow
              label={t('disbursement.orderNo')}
              value={<span className="tabular">{confirmPaid.orderNo}</span>}
            />
            <DataRow label={t('common.amount')} value={<Money value={confirmPaid.amount} />} />
            <DataRow label={t('disbursement.bank')} value={confirmPaid.bankName} />
          </dl>
        ) : null}
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckIcon size={15} />
          {t('disbursement.dialog.paidEffect')}
        </p>
      </ConfirmDialog>
    </div>
  )
}

/**
 * Pending → Ordered. Shows the finance officer exactly what she is authorising:
 * the account the money leaves for, the amount (fixed — the contract sets it)
 * and the order number the bank will see.
 */
function IssueOrderDialog({
  disbursements,
  appById,
  isPending,
  onClose,
  onConfirm,
}: {
  disbursements: Disbursement[] | null
  appById: Map<string, Application>
  isPending: boolean
  onClose: () => void
  onConfirm: (selected: Disbursement[]) => void
}) {
  const { t } = useTranslation()
  const [approver, setApprover] = useState(APPROVERS[0])

  useEffect(() => {
    if (disbursements) setApprover(APPROVERS[0])
  }, [disbursements])

  const rows = disbursements ?? []
  const single = rows.length === 1 ? rows[0] : null
  const application = single ? appById.get(single.applicationId) : undefined
  const total = rows.reduce((acc, d) => acc + d.amount, 0)

  return (
    <ConfirmDialog
      open={rows.length > 0}
      onOpenChange={(open) => !open && onClose()}
      title={t('disbursement.dialog.title')}
      description={t('disbursement.dialog.description')}
      confirmLabel={t('disbursement.dialog.confirm')}
      isPending={isPending}
      onConfirm={() => onConfirm(rows)}
    >
      {single && application ? (
        <dl className="grid gap-x-6 rounded-lg bg-muted px-4 py-2 sm:grid-cols-2">
          <DataRow label={t('common.beneficiary')} value={application.beneficiary.fullName} />
          <DataRow label={t('disbursement.bank')} value={single.bankName} />
          <DataRow
            label={t('common.iban')}
            value={
              <span className="tabular" dir="ltr">
                {groupIban(single.iban)}
              </span>
            }
          />
          <DataRow
            label={t('disbursement.orderNo')}
            value={<span className="tabular">{single.orderNo}</span>}
          />
          <DataRow label={t('common.amount')} value={<Money value={single.amount} />} />
        </dl>
      ) : (
        <dl className="grid gap-x-6 rounded-lg bg-muted px-4 py-2 sm:grid-cols-2">
          <DataRow
            label={t('disbursement.dialog.selectedCount')}
            value={<span className="tabular">{rows.length}</span>}
          />
          <DataRow label={t('common.amount')} value={<Money value={total} />} />
        </dl>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="order-approver">{t('disbursement.dialog.approver')}</Label>
        <Select value={approver} onValueChange={setApprover}>
          <SelectTrigger id="order-approver">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {APPROVERS.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </ConfirmDialog>
  )
}
