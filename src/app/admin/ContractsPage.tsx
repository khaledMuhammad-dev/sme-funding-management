import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DataTable,
  DateText,
  Money,
  NumericCell,
  PageHeader,
  actionsColumn,
  createAppColumnHelper,
  sortableHeader,
  type AppColumnDef,
} from '@/components/shared'
import { AlertIcon, ContractIcon } from '@/components/icons'
import type { Application, Contract } from '@/data/types'
import { useApplications, useContracts, useSendContract } from '@/lib/api'
import { ContractDocument } from '@/features/contracts/ContractDocument'
import { GenerateContractDialog } from '@/features/contracts/GenerateContractDialog'
import { hasOrgSignatory, useSettingsStore } from '@/stores/useSettingsStore'
import { cn } from '@/lib/utils'

const STATUS_CLASS: Record<Contract['status'], string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-info-soft text-info',
  signed: 'bg-success-soft text-success',
}

/** A contract plus the applicant fields the table renders, resolved once. */
type ContractRow = Contract & { beneficiaryName: string; applicationRef: string }

/** Signed contracts live in the archive; everything else is still in flight. */
type Tab = 'all' | 'draft' | 'sent' | 'archive'

const TABS: Tab[] = ['all', 'draft', 'sent', 'archive']

export default function ContractsPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('all')
  const [generateOpen, setGenerateOpen] = useState(false)
  // Dialogs address a contract by id — or, right after generation, by the
  // application it belongs to, since its contract id does not exist yet.
  const [previewFor, setPreviewFor] = useState<{ contractId?: string; applicationId?: string } | null>(
    null,
  )

  const { data: contracts = [], isLoading } = useContracts()
  const { data: applications = [] } = useApplications()
  const sendContract = useSendContract()

  /*
    The programme signs centrally. Without an authorised signatory on file there
    is no organisation signature to stamp onto a new contract, so generation is
    blocked outright and the officer is told where to fix it — a silently
    disabled button would read as a broken screen.
  */
  const orgSignature = useSettingsStore((s) => s.orgSignature)
  const signatoryReady = hasOrgSignatory(orgSignature)

  const appById = useMemo(() => new Map(applications.map((a) => [a.id, a])), [applications])

  // Resolved every render, never copied into state: after signing, the refetched
  // contract flows into the open preview instead of leaving a stale copy there.
  const contractById = useMemo(() => new Map(contracts.map((c) => [c.id, c])), [contracts])
  const preview = previewFor
    ? (previewFor.contractId
        ? contractById.get(previewFor.contractId)
        : contracts.find((c) => c.applicationId === previewFor.applicationId)) ?? null
    : null

  /**
   * The applicant's name is folded into the row rather than looked up from the
   * column definitions: a column def that closes over `appById` gets a new
   * identity on every applications refetch, which remounts every cell — closing
   * any open row menu mid-click and replaying the row stagger on every mutation.
   */
  const rows = useMemo<ContractRow[]>(
    () =>
      contracts
        .filter((c) =>
          tab === 'all' ? true : tab === 'archive' ? c.status === 'signed' : c.status === tab,
        )
        .map((contract) => {
          const app = appById.get(contract.applicationId)
          return {
            ...contract,
            beneficiaryName: app?.beneficiary.fullName ?? '—',
            applicationRef: app?.ref ?? '',
          }
        }),
    [contracts, tab, appById],
  )

  // `mutate` is bound to the observer and stable across renders; the mutation
  // *object* is not, and depending on it would rebuild the columns every render.
  const sendContractMutate = sendContract.mutate

  const columns = useMemo<AppColumnDef<ContractRow>[]>(() => {
    const helper = createAppColumnHelper<ContractRow>()
    return [
      helper.accessor('contractNo', {
        header: sortableHeader(t('contracts.contractNo')),
        meta: { label: t('contracts.contractNo'), width: 150 },
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
        meta: { label: t('common.status'), width: 130 },
        cell: ({ getValue }) => (
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-semibold',
              STATUS_CLASS[getValue() as Contract['status']],
            )}
          >
            {t(`contracts.statuses.${getValue() as Contract['status']}`)}
          </span>
        ),
      }),
      /*
        The programme's own signature is already on every contract it issues, so
        the only thing this column can be waiting for is the applicant. Saying
        that in words beats an em-dash that could mean anything.
      */
      helper.accessor((row) => row.signedAt ?? '', {
        id: 'signedAt',
        header: sortableHeader(t('contracts.signedAt')),
        meta: { label: t('contracts.signedAt'), width: 190 },
        cell: ({ getValue, row }) =>
          getValue() ? (
            <DateText value={getValue()} className="text-sm text-muted-foreground" />
          ) : row.original.status === 'sent' ? (
            <span className="text-sm font-medium text-info" data-testid="awaiting-applicant">
              {t('contracts.awaitingApplicant')}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">{t('contracts.notSentYet')}</span>
          ),
      }),
      actionsColumn<ContractRow>(
        [
          { key: 'preview', label: t('contracts.preview'), onSelect: (row) => setPreviewFor({ contractId: row.id }) },
          {
            key: 'send',
            label: t('contracts.send'),
            hidden: (row) => row.status !== 'draft',
            onSelect: (row) =>
              sendContractMutate(row.id, {
                onSuccess: () => toast.success(t('contracts.sentSuccess')),
              }),
          },
          {
            key: 'print',
            label: t('contracts.exportPdf'),
            onSelect: (row) => setPreviewFor({ contractId: row.id }),
          },
        ],
        t('common.actions'),
      ),
    ] as AppColumnDef<ContractRow>[]
  }, [t, sendContractMutate])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('contracts.title')}
        subtitle={t('contracts.subtitle')}
        actions={
          <Button onClick={() => setGenerateOpen(true)} disabled={!signatoryReady}>
            <ContractIcon size={16} />
            {t('contracts.generate')}
          </Button>
        }
        below={
          <div
            className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
            role="tablist"
            aria-label={t('contracts.title')}
            /*
              A `tablist` is expected to move between its tabs with the arrow
              keys. Every tab here is still individually Tab-reachable, so this
              only adds a shortcut — it never removes a way in.
            */
            onKeyDown={(event) => {
              const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
              if (!step) return
              event.preventDefault()
              // Arrows follow the visual order, which mirrors in RTL.
              const dir = document.documentElement.dir === 'rtl' ? -step : step
              const next = (TABS.indexOf(tab) + dir + TABS.length) % TABS.length
              setTab(TABS[next])
              const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')
              buttons[next]?.focus()
            }}
          >
            {TABS.map((option) => (
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
                {option === 'all'
                  ? t('common.all')
                  : option === 'archive'
                    ? t('contracts.archive')
                    : t(`contracts.statuses.${option}`)}
              </button>
            ))}
          </div>
        }
      />

      {!signatoryReady ? (
        <div
          role="alert"
          data-testid="no-signatory-alert"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/40 bg-destructive-soft px-4 py-3 text-sm text-destructive"
        >
          <AlertIcon size={18} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t('contracts.noSignatoryTitle')}</p>
            <p className="text-xs">{t('contracts.noSignatoryBody')}</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/settings">{t('contracts.openSignatorySettings')}</Link>
          </Button>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        onRowClick={(row) => setPreviewFor({ contractId: row.id })}
        isFiltered={tab !== 'all'}
        onResetFilters={() => setTab('all')}
        emptyIcon={<ContractIcon size={22} />}
        emptyTitle={t('contracts.empty')}
        emptyHint={t('contracts.emptyHint')}
      />

      <GenerateContractDialog
        open={generateOpen}
        applications={applications}
        contracts={contracts}
        onOpenChange={setGenerateOpen}
        onGenerated={(applicationId) => setPreviewFor({ applicationId })}
      />

      <ContractPreviewDialog
        open={Boolean(previewFor)}
        contract={preview}
        application={preview ? appById.get(preview.applicationId) : undefined}
        onClose={() => setPreviewFor(null)}
      />
    </div>
  )
}

/**
 * The document, read-only.
 *
 * Staff never sign here: the programme's signature is already on the contract,
 * and the applicant's is captured in her own portal. This screen generates,
 * sends, reads, prints and archives.
 */
function ContractPreviewDialog({
  open,
  contract,
  application,
  onClose,
}: {
  open: boolean
  contract: Contract | null
  application?: Application
  onClose: () => void
}) {
  const { t } = useTranslation()
  const shown = contract

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl [&>*]:min-w-0">
        <DialogHeader className="print:hidden">
          <DialogTitle>{t('contracts.preview')}</DialogTitle>
        </DialogHeader>

        {shown && application ? (
          <>
            <ContractDocument contract={shown} application={application} />
            <div className="flex flex-wrap items-center justify-end gap-3 print:hidden">
              {shown.status === 'sent' ? (
                <p className="me-auto text-xs font-medium text-info">
                  {t('contracts.awaitingApplicantHint')}
                </p>
              ) : null}
              <Button variant="outline" onClick={() => window.print()}>
                {t('contracts.exportPdf')}
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
