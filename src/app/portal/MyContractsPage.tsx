import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataRow, DateText, EmptyState, Money, PageHeader, SectionCard } from '@/components/shared'
import { ContractIcon } from '@/components/icons'
import { ContractDocument } from '@/features/contracts/ContractDocument'
import { BeneficiarySignAction } from '@/features/contracts/BeneficiarySigningDialog'
import type { Application, Contract } from '@/data/types'
import { useApplicationsByRefs, useContractsForMany } from '@/lib/api'
import { useApplicantStore } from '@/stores/useApplicantStore'
import { newestFirst } from '@/lib/sort'
import { ROUTES } from '../routes'

/** A contract paired with the application it was issued for. */
interface ContractRow {
  contract: Contract
  application: Application
}

type TabValue = 'awaiting' | 'signed' | 'all'

/**
 * The signed-in applicant's contracts, across every one of his applications.
 *
 * `/track` shows one application's contract at a time, which leaves an applicant
 * with several files no way to see what is waiting on his signature. This is
 * that list — and signing is reachable straight from it, through the same
 * `BeneficiarySignAction` the tracking page mounts.
 *
 * Drafts are never listed: a draft has been sent to nobody, so it does not exist
 * as far as the applicant is concerned. Same rule `/track` applies.
 */
export default function MyContractsPage() {
  const { t } = useTranslation()
  const refs = useApplicantStore((s) => s.refs)
  // `null` until he picks one: the opening tab is whichever is worth opening on,
  // and that is only known once the read resolves. Derived rather than set by an
  // effect, so it can never fight a tab he has actually chosen.
  const [tab, setTab] = useState<TabValue | null>(null)
  const [openContract, setOpenContract] = useState<ContractRow | null>(null)

  // Same query key the bell and the applications list use, so this shares one read.
  const { data: appRows, isPending: applicationsPending } = useApplicationsByRefs(refs)
  const applications = useMemo(
    () => (appRows ?? []).map((row) => row.application).filter((a): a is Application => Boolean(a)),
    [appRows],
  )
  const applicationIds = applications.map((a) => a.id)
  const { data: contracts, isPending: contractsPending } = useContractsForMany(applicationIds)

  const rows = useMemo<ContractRow[]>(() => {
    const byId = new Map(applications.map((a) => [a.id, a]))
    return (
      [...(contracts ?? [])]
        // A draft is not yet anybody's contract — the applicant must never see one.
        .filter((contract) => contract.status !== 'draft')
        .sort(newestFirst((contract) => contract.sentAt ?? ''))
        .map((contract) => ({ contract, application: byId.get(contract.applicationId)! }))
        .filter((row) => Boolean(row.application))
    )
  }, [contracts, applications])

  const awaiting = rows.filter((row) => row.contract.status === 'sent')
  const signed = rows.filter((row) => row.contract.status === 'signed')
  const counts: Record<TabValue, number> = {
    awaiting: awaiting.length,
    signed: signed.length,
    all: rows.length,
  }
  const shown: Record<TabValue, ContractRow[]> = { awaiting, signed, all: rows }
  const activeTab: TabValue = tab ?? (awaiting.length > 0 ? 'awaiting' : 'all')

  /*
    `enabled: false` leaves a query pending forever, so "no references at all"
    and "no applications behind them" are checked before the pending flags —
    otherwise the empty state would never replace the skeletons.
  */
  const loading =
    refs.length > 0 &&
    (applicationsPending || (applicationIds.length > 0 && contractsPending))

  const emptyFor = (value: TabValue) => (
    <EmptyState
      variant="page"
      icon={<ContractIcon size={22} />}
      title={t(
        value === 'awaiting'
          ? 'myContracts.emptyAwaitingTitle'
          : value === 'signed'
            ? 'myContracts.emptySignedTitle'
            : 'myContracts.emptyTitle',
      )}
      hint={t(
        value === 'awaiting'
          ? 'myContracts.emptyAwaitingHint'
          : value === 'signed'
            ? 'myContracts.emptySignedHint'
            : 'myContracts.emptyHint',
      )}
      action={
        rows.length === 0 ? (
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link to={ROUTES.myApplications}>{t('myContracts.emptyApplicationsCta')}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={ROUTES.apply}>{t('myContracts.emptyApplyCta')}</Link>
            </Button>
          </div>
        ) : undefined
      }
    />
  )

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader
        title={t('myContracts.title')}
        subtitle={t('myContracts.subtitle')}
        className="mb-6"
      />

      {loading ? (
        /* Sized like a real row, so the list does not jump as the read resolves. */
        <div
          data-testid="my-contracts-loading"
          aria-busy="true"
          aria-live="polite"
          aria-label={t('common.loading')}
          className="space-y-4"
        >
          <Skeleton className="h-10 w-72 rounded-lg" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={(value) => setTab(value as TabValue)}>
          <TabsList data-testid="my-contracts-tabs" className="mb-5">
            {(['awaiting', 'signed', 'all'] as const).map((value) => (
              <TabsTrigger
                key={value}
                value={value}
                data-testid={`my-contracts-tab-${value}`}
                data-count={counts[value]}
              >
                {t(`myContracts.tabs.${value}`)}
                <span
                  className="ms-1.5 rounded-full bg-muted px-1.5 text-xs font-semibold tabular text-muted-foreground"
                  data-testid={`my-contracts-count-${value}`}
                >
                  {counts[value]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {(['awaiting', 'signed', 'all'] as const).map((value) => (
            <TabsContent key={value} value={value}>
              {shown[value].length === 0 ? (
                <div data-testid={`my-contracts-empty-${value}`}>{emptyFor(value)}</div>
              ) : (
                <ul data-testid="my-contracts-list" className="space-y-4">
                  {shown[value].map((row) => (
                    <li key={row.contract.id}>
                      <ContractCard row={row} onView={() => setOpenContract(row)} />
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* The same document the staff generated, printed through the shared print
          stylesheet — how "send as PDF" works without a PDF library. */}
      <Dialog open={Boolean(openContract)} onOpenChange={(next) => !next && setOpenContract(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl [&>*]:min-w-0">
          <DialogHeader className="print:hidden">
            <DialogTitle>{t('myContracts.title')}</DialogTitle>
          </DialogHeader>
          {openContract ? (
            <>
              <div data-testid="my-contracts-doc">
                <ContractDocument
                  contract={openContract.contract}
                  application={openContract.application}
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2 print:hidden">
                <Button
                  variant="outline"
                  data-testid="my-contracts-print"
                  onClick={() => window.print()}
                >
                  {t('contracts.exportPdf')}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ContractCard({ row, onView }: { row: ContractRow; onView: () => void }) {
  const { t } = useTranslation()
  const { contract, application } = row

  return (
    <SectionCard>
      <div
        data-testid="my-contract-row"
        data-contract={contract.contractNo}
        data-status={contract.status}
        data-ref={application.ref}
        className="space-y-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('contracts.contractNo')}
            </p>
            <p className="text-lg font-semibold tabular" dir="ltr">
              {contract.contractNo}
            </p>
            <p className="text-sm text-muted-foreground">{application.project.name}</p>
            <p className="text-xs text-muted-foreground tabular" dir="ltr">
              {application.ref}
            </p>
          </div>
          <Badge variant={contract.status === 'signed' ? 'default' : 'secondary'}>
            {t(`contracts.statuses.${contract.status}`)}
          </Badge>
        </div>

        <dl className="grid gap-x-6 sm:grid-cols-2">
          <DataRow
            label={t('apply.project.requestedAmount')}
            value={<Money value={contract.amount} />}
          />
          {contract.sentAt ? (
            <DataRow
              label={t('contracts.sentAt')}
              value={<DateText value={contract.sentAt} withTime />}
            />
          ) : null}
          {contract.signedAt ? (
            <DataRow
              label={t('contracts.signedAt')}
              value={<DateText value={contract.signedAt} withTime />}
            />
          ) : null}
        </dl>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" data-testid="my-contract-view" onClick={onView}>
            <ContractIcon size={15} />
            {t('myContracts.view')}
          </Button>
          {/* Signing lives with the applicant. Renders nothing unless this
              contract has actually been sent to him. */}
          <BeneficiarySignAction contract={contract} application={application} />
          <Button asChild size="sm" variant="ghost" className="ms-auto">
            <Link to={`${ROUTES.track}?ref=${encodeURIComponent(application.ref)}`}>
              {t('myApplications.open')}
            </Link>
          </Button>
        </div>
      </div>
    </SectionCard>
  )
}
