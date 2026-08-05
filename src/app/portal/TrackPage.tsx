import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DataRow,
  EmptyState,
  Money,
  PageHeader,
  SectionCard,
  StatusBadge,
  Timeline,
  DateText,
} from '@/components/shared'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { AlertIcon, CheckIcon, ContractIcon, InterviewIcon, SearchIcon, UploadIcon } from '@/components/icons'
import { HAPPY_PATH, happyPathIndex } from '@/data/statusFlow'
import { ContractDocument } from '@/features/contracts/ContractDocument'
import { BeneficiarySignAction } from '@/features/contracts/BeneficiarySigningDialog'
import {
  useApplicationByRef,
  useContractFor,
  useInterviewFor,
  useNotificationsFor,
  useReuploadDocument,
} from '@/lib/api'
import { useUiStore } from '@/stores/useUiStore'
import { useApplicantStore } from '@/stores/useApplicantStore'
import { useDemoDataStore } from '@/stores/useDemoDataStore'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ROUTES } from '../routes'

/** The applicant's view of the workflow — same statuses, plain language. */
function JourneyStepper({ status }: { status: Parameters<typeof happyPathIndex>[0] }) {
  const { t } = useTranslation()
  const activeIndex = happyPathIndex(status)
  const isRejected = status === 'rejected'

  return (
    <ol data-testid="track-stepper" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {HAPPY_PATH.map((step, index) => {
        const done = index < activeIndex
        const current = index === activeIndex && !isRejected
        return (
          <li
            key={step}
            data-current={current}
            data-done={done}
            className={cn(
              'flex items-center gap-3 rounded-lg border p-3',
              current
                ? 'border-terracotta bg-terracotta-soft/50'
                : done
                  ? 'border-success/40 bg-success-soft/40'
                  : 'border-border bg-muted/40',
            )}
          >
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular',
                done
                  ? 'bg-success-soft text-success'
                  : current
                    ? 'bg-terracotta text-terracotta-foreground'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {done ? <CheckIcon size={13} strokeWidth={2.8} /> : index + 1}
            </span>
            <span className={cn('text-sm', current ? 'font-semibold' : 'text-muted-foreground')}>
              {t(`status.${step}`)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export default function TrackPage() {
  const { t } = useTranslation()
  const lang = useUiStore((s) => s.lang)
  const [params, setParams] = useSearchParams()
  const [input, setInput] = useState(params.get('ref') ?? '')
  const [query, setQuery] = useState(params.get('ref') ?? '')
  const [tooShort, setTooShort] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  /*
    Focus the field only when the applicant arrived with nothing to show, so
    typing works immediately after the route transition settles.

    Deliberately not `autoFocus`: arriving from the header bell carries a `?ref=`
    and opens with the application already resolved. Grabbing focus there stole
    it from the still-open notification popover, which Radix then dismissed as a
    focus-outside event — the popover appeared to snap shut on its own.
  */
  useEffect(() => {
    if (!params.get('ref')) inputRef.current?.focus()
    // Mount only: re-focusing on every render would fight the user's cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [contractOpen, setContractOpen] = useState(false)

  const { data: application, isFetching } = useApplicationByRef(query)
  const { data: interview } = useInterviewFor(application?.id)
  const { data: notifications = [], isLoading: notificationsLoading } = useNotificationsFor(
    application?.id,
  )
  const { data: contract } = useContractFor(application?.id)
  const reupload = useReuploadDocument()
  const rememberRef = useApplicantStore((s) => s.remember)

  // A couple of live references so the demo never dead-ends on a typo.
  const samples = useDemoDataStore((s) => s.applications)
    .filter((a) => ['incomplete', 'awaiting_interview', 'disbursed'].includes(a.status))
    .slice(0, 3)

  /*
    The looked-up ref and `?ref=` are kept in step in both directions, and each
    side writes only when it is the one that changed:

    - `setParams` alone re-runs whenever react-router hands back a new setter,
      which it does on every navigation — including the one leaving this page,
      where it would push `/track?ref=…` back over the route just opened.
    - reacting to `?ref=` alone would undo a fresh lookup, because the write
      above lands one render later and looks like an external change.
  */
  const urlRef = params.get('ref') ?? ''
  const writtenRef = useRef(query)
  const syncedUrlRef = useRef(urlRef)

  useEffect(() => {
    if (query === writtenRef.current) return
    writtenRef.current = query
    if (query) setParams({ ref: query }, { replace: true })
  }, [query, setParams])

  // Arriving here from the portal bell only changes the query string — without
  // this the page would keep showing whatever was already looked up.
  useEffect(() => {
    if (urlRef === syncedUrlRef.current) return
    syncedUrlRef.current = urlRef
    if (urlRef && urlRef !== query) {
      setInput(urlRef)
      setQuery(urlRef)
      writtenRef.current = urlRef
    }
  }, [urlRef, query])

  // A successful lookup adds the application to the applicant's own sections —
  // the header bell, "my applications" and "my contracts" all read from here.
  //
  // Keyed on the ref *string*, not the query result: a refetch hands back a new
  // object every time, and writing on that would set state on every poll.
  const foundRef = application?.ref
  useEffect(() => {
    if (foundRef) rememberRef(foundRef)
  }, [foundRef, rememberRef])

  const missingDocs = application?.documents.filter((d) => d.missing) ?? []
  // A draft contract has not been sent to anyone yet — the applicant must not see it.
  const visibleContract = contract && contract.status !== 'draft' ? contract : null

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader title={t('track.title')} subtitle={t('track.subtitle')} className="mb-6" />

      <form
        onSubmit={(event) => {
          event.preventDefault()
          // Validated on submit rather than by disabling the button: the route
          // transition runs `mode="wait"`, so this field does not exist for the
          // first ~250ms after arriving here. Keystrokes typed into that gap are
          // lost, and a button disabled on length would then read as broken.
          if (input.trim().length < 4) {
            setTooShort(true)
            return
          }
          setTooShort(false)
          setQuery(input.trim())
        }}
        className="mb-8 flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-soft-sm sm:flex-row sm:items-end"
      >
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="track-ref">{t('track.refLabel')}</Label>
          <Input
            id="track-ref"
            ref={inputRef}
            value={input}
            onChange={(event) => {
              setInput(event.target.value)
              if (tooShort) setTooShort(false)
            }}
            placeholder={t('track.refPlaceholder')}
            dir="ltr"
            aria-invalid={tooShort || undefined}
            aria-describedby={tooShort ? 'track-ref-error' : undefined}
            className="tabular text-start uppercase"
          />
          {tooShort ? (
            <p id="track-ref-error" role="alert" className="text-xs text-destructive">
              {t('track.refTooShort')}
            </p>
          ) : null}
        </div>
        <Button type="submit" size="lg">
          <SearchIcon size={16} />
          {t('track.lookup')}
        </Button>
      </form>

      {/* Always offered: this is the signed-in applicant's own section, so it is
          there whether or not anything has been looked up in this session. */}
      <p className="-mt-4 mb-8 text-sm">
        <Link
          to={ROUTES.myApplications}
          data-testid="track-my-applications-link"
          className="font-medium text-primary hover:underline"
        >
          {t('track.seeMyApplications')}
        </Link>
      </p>

      {!query ? (
        <div className="space-y-3 text-center">
          <p className="text-sm text-muted-foreground">{t('track.tryDemo')}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {samples.map((sample) => (
              <Button
                key={sample.id}
                variant="outline"
                size="sm"
                className="tabular"
                onClick={() => {
                  setInput(sample.ref)
                  setQuery(sample.ref)
                }}
              >
                {sample.ref}
              </Button>
            ))}
          </div>
        </div>
      ) : isFetching && !application ? (
        /*
          Only while there is nothing to show. A refetch — the one a successful
          re-upload triggers — keeps the resolved application on screen instead
          of collapsing the whole page back to grey blocks.
        */
        <div
          data-testid="track-loading"
          aria-busy="true"
          aria-live="polite"
          aria-label={t('common.loading')}
          className="space-y-5"
        >
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ) : !application ? (
        <EmptyState
          variant="page"
          icon={<AlertIcon size={22} />}
          title={t('track.notFound')}
          hint={t('track.notFoundHint')}
        />
      ) : (
        <div className="space-y-5">
          <SectionCard>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('common.reference')}
                </p>
                <p data-testid="track-ref" className="text-xl font-semibold tabular">
                  {application.ref}
                </p>
                <p className="text-sm text-muted-foreground">{application.project.name}</p>
              </div>
              <div className="space-y-1.5 text-end">
                <StatusBadge status={application.status} size="md" />
                <p className="text-xs text-muted-foreground">
                  {t('common.updatedAt')} · {formatRelative(application.updatedAt, lang)}
                </p>
              </div>
            </div>
            <p className="mt-4 rounded-lg bg-muted px-4 py-3 text-sm">
              {t(`statusHint.${application.status}`)}
            </p>
          </SectionCard>

          <SectionCard title={t('track.journey')}>
            <JourneyStepper status={application.status} />
          </SectionCard>

          <SectionCard title={t('track.applicationDetails')}>
            <dl data-testid="track-applicant" className="grid gap-x-6 sm:grid-cols-2">
              <DataRow label={t('apply.personal.fullName')} value={application.beneficiary.fullName} />
              <DataRow
                label={t('apply.personal.region')}
                value={`${t(`region.${application.beneficiary.region}`)} · ${application.beneficiary.city}`}
              />
              <DataRow label={t('apply.project.name')} value={application.project.name} />
              <DataRow
                label={t('apply.project.sector')}
                value={t(`sector.${application.project.sector}`)}
              />
              <DataRow
                label={t('apply.project.requestedAmount')}
                value={<Money value={application.project.requestedAmount} />}
              />
              <DataRow
                label={t('track.submittedAt')}
                value={<DateText value={application.createdAt} />}
              />
            </dl>
          </SectionCard>

          {missingDocs.length > 0 ? (
            <SectionCard title={t('track.missingDocs')} description={t('track.missingDocsHint')}>
              <ul className="space-y-2">
                {missingDocs.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/50 bg-warning-soft/50 p-3"
                  >
                    <AlertIcon size={17} className="text-warning" />
                    <span className="text-sm font-medium">{t(`docKind.${doc.kind}`)}</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="ms-auto"
                      disabled={reupload.isPending}
                      onClick={() =>
                        reupload.mutate(
                          { applicationId: application.id, docId: doc.id },
                          { onSuccess: () => toast.success(t('apply.documents.uploaded')) },
                        )
                      }
                    >
                      <UploadIcon size={15} />
                      {t('track.reupload')}
                    </Button>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}

          {interview && interview.status === 'scheduled' ? (
            <SectionCard title={t('track.interviewInfo')}>
              <dl className="grid gap-x-6 sm:grid-cols-2">
                <DataRow
                  label={t('track.interviewAt')}
                  value={<DateText value={interview.scheduledAt} withTime />}
                />
                <DataRow label={t('track.interviewWith')} value={interview.interviewer} />
              </dl>
              <Button className="mt-3" variant="secondary" asChild>
                <a href={interview.meetingUrl} target="_blank" rel="noreferrer">
                  <InterviewIcon size={16} />
                  {t('track.joinMeeting')}
                </a>
              </Button>
            </SectionCard>
          ) : null}

          {visibleContract ? (
            <SectionCard title={t('track.contract')} description={t('track.contractHint')}>
              <div
                data-testid="track-contract"
                data-status={visibleContract.status}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3"
              >
                <ContractIcon size={18} className="text-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold tabular" dir="ltr">
                    {visibleContract.contractNo}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {visibleContract.signedAt ? (
                      <>
                        {t('contracts.signedAt')} ·{' '}
                        <DateText value={visibleContract.signedAt} withTime />
                      </>
                    ) : visibleContract.sentAt ? (
                      <>
                        {t('contracts.sentAt')} · <DateText value={visibleContract.sentAt} withTime />
                      </>
                    ) : null}
                  </p>
                </div>
                <Badge
                  variant={visibleContract.status === 'signed' ? 'default' : 'secondary'}
                  className="ms-auto"
                >
                  {t(`contracts.statuses.${visibleContract.status}`)}
                </Badge>
                <Button size="sm" variant="secondary" onClick={() => setContractOpen(true)}>
                  {t('track.viewContract')}
                </Button>
                {/*
                  Signing lives here, with the applicant, not on a staff screen.
                  Renders nothing until the contract has actually been sent to her.
                */}
                <BeneficiarySignAction contract={visibleContract} application={application} />
              </div>
            </SectionCard>
          ) : null}

          <SectionCard title={t('track.history')}>
            <div data-testid="track-timeline">
              <Timeline events={application.timeline} order="desc" />
            </div>
          </SectionCard>

          <SectionCard title={t('track.myNotifications')} description={t('track.myNotificationsHint')}>
            {notificationsLoading ? (
              // Without this the card claims "no messages yet" for half a second
              // before the real list arrives — a false empty state that jumps.
              <div aria-busy="true" aria-label={t('common.loading')} className="space-y-3">
                <Skeleton className="h-16 rounded-lg" />
                <Skeleton className="h-16 rounded-lg" />
              </div>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('track.noNotifications')}</p>
            ) : (
              <ul data-testid="track-notifications" className="space-y-3">
                {notifications.map((notification) => (
                  <li key={notification.id} className="rounded-lg border border-border p-3">
                    <p className="text-sm">{lang === 'ar' ? notification.body : notification.bodyEn}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t(`notifications.channels.${notification.channel}`)} ·{' '}
                      {formatRelative(notification.sentAt, lang)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      )}

      {/* The same document the staff generated — printed through the shared print
          stylesheet, which is how "send as PDF" works without a PDF library. */}
      <Dialog open={contractOpen} onOpenChange={setContractOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl [&>*]:min-w-0">
          <DialogHeader className="print:hidden">
            <DialogTitle>{t('track.contract')}</DialogTitle>
          </DialogHeader>
          {visibleContract && application ? (
            <>
              <div data-testid="track-contract-doc">
                <ContractDocument contract={visibleContract} application={application} />
              </div>
              <div className="flex flex-wrap justify-end gap-2 print:hidden">
                <Button
                  variant="outline"
                  data-testid="track-contract-print"
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
