import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog, DateText, Money } from '@/components/shared'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Application, Contract } from '@/data/types'
import { applicationMatchesSearch, useGenerateContract } from '@/lib/api'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { cn } from '@/lib/utils'

/** One approved file as the picker sees it: choosable, or already spoken for. */
interface Candidate {
  application: Application
  /** The contract that already exists for it, if any — the reason it is barred. */
  existing?: Contract
}

/**
 * Draws up a contract for an approved application.
 *
 * Every approved file is listed and searchable, including the ones that already
 * have a contract: hiding those made the picker look like it offered a single
 * hardcoded choice. They are shown as ineligible with the reason on the row, so
 * "why isn't she in the list?" never has to be asked.
 *
 * The template merge happens in the store, so the generated document always
 * carries the real beneficiary, amount and instalment plan — and the programme's
 * configured signature.
 */
export function GenerateContractDialog({
  open,
  applications,
  contracts,
  onOpenChange,
  onGenerated,
}: {
  open: boolean
  /** Every application; the picker narrows to the approved ones itself. */
  applications: Application[]
  /** Every contract, to work out which approved files are already covered. */
  contracts: Contract[]
  onOpenChange: (open: boolean) => void
  onGenerated: (applicationId: string) => void
}) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const generate = useGenerateContract()
  const orgSignature = useSettingsStore((s) => s.orgSignature)

  const candidates = useMemo<Candidate[]>(() => {
    const byApplication = new Map(contracts.map((c) => [c.applicationId, c]))
    return applications
      .filter((a) => a.status === 'approved')
      .map((application) => ({ application, existing: byApplication.get(application.id) }))
      // Choosable files first: the officer should never have to scroll past
      // rows she cannot act on to reach the one she came for.
      .sort((a, b) => Number(Boolean(a.existing)) - Number(Boolean(b.existing)))
  }, [applications, contracts])

  const eligible = useMemo(() => candidates.filter((c) => !c.existing), [candidates])

  const visible = useMemo(
    () => candidates.filter((c) => applicationMatchesSearch(c.application, search)),
    [candidates, search],
  )

  // A fresh search must never leave a selection standing that is no longer on
  // screen — the officer would confirm a file she cannot see.
  useEffect(() => {
    if (!open) return
    setSearch('')
    setSelected(eligible[0]?.application.id ?? null)
  }, [open, eligible])

  useEffect(() => {
    if (selected && !visible.some((c) => !c.existing && c.application.id === selected)) {
      setSelected(visible.find((c) => !c.existing)?.application.id ?? null)
    }
  }, [visible, selected])

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('contracts.generateDialog.title')}
      description={t('contracts.generateDialog.description')}
      confirmLabel={t('contracts.generate')}
      disabled={!selected}
      isPending={generate.isPending}
      onConfirm={() => {
        if (!selected) return
        generate.mutate(selected, {
          onSuccess: () => {
            toast.success(t('contracts.generateDialog.success'))
            onOpenChange(false)
            onGenerated(selected)
          },
        })
      }}
    >
      {/* The contract leaves here already signed by the programme — the officer
          should see whose signature is about to go on it. */}
      <p className="mb-3 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        {t('contracts.generateDialog.signatory', { name: orgSignature.name })}
      </p>

      <div className="mb-3 space-y-1.5">
        <Label htmlFor="contract-candidate-search">
          {t('contracts.generateDialog.searchLabel')}
        </Label>
        <Input
          id="contract-candidate-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('contracts.generateDialog.searchPlaceholder')}
          data-testid="contract-candidate-search"
        />
      </div>

      {/*
        A fixed viewport for the list: filtering must narrow the rows inside it,
        not resize the dialog around the officer's pointer while she types.
      */}
      <div className="h-72 overflow-y-auto" data-testid="contract-candidates">
        {candidates.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('contracts.generateDialog.noApproved')}
          </p>
        ) : eligible.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('contracts.generateDialog.empty')}
          </p>
        ) : visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('contracts.generateDialog.noResults', { query: search.trim() })}
          </p>
        ) : (
          <ul className="space-y-2" role="radiogroup" aria-label={t('contracts.generateDialog.title')}>
            {visible.map(({ application, existing }) => (
              <li key={application.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected === application.id}
                  aria-disabled={Boolean(existing)}
                  data-eligible={existing ? 'false' : 'true'}
                  // Barred rows stay focusable and readable — a row you cannot
                  // reach cannot tell you why it is barred.
                  onClick={() => !existing && setSelected(application.id)}
                  className={cn(
                    'flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-start transition-colors',
                    existing
                      ? 'cursor-not-allowed border-dashed border-border opacity-70'
                      : selected === application.id
                        ? 'border-primary bg-primary-soft'
                        : 'border-border hover:bg-accent',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {application.beneficiary.fullName}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground tabular">
                      {application.ref} · {application.project.name}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {t(`region.${application.beneficiary.region}`)} ·{' '}
                      <DateText value={application.createdAt} />
                    </span>
                    {existing ? (
                      <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
                        {t('contracts.generateDialog.alreadyIssued', {
                          contractNo: existing.contractNo,
                        })}
                        {' · '}
                        {t(`contracts.statuses.${existing.status}`)}
                      </span>
                    ) : null}
                  </span>
                  <Money
                    value={application.project.requestedAmount}
                    className="shrink-0 text-sm"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ConfirmDialog>
  )
}
