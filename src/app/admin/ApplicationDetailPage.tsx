import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DataRow,
  DateText,
  EmptyState,
  Money,
  PageHeader,
  SectionCard,
  StatusBadge,
  Timeline,
} from '@/components/shared'
import {
  AlertIcon,
  ApplicationsIcon,
  ContractIcon,
  DisbursementIcon,
  DocumentIcon,
  InterviewIcon,
} from '@/components/icons'
import type { UploadedDoc } from '@/data/types'
import { allowedTransitions } from '@/data/statusFlow'
import {
  useApplication,
  useContractFor,
  useDisbursementFor,
  useFollowUpsFor,
  useInterviewFor,
  useSetDocumentMissing,
  useUpdateStatus,
} from '@/lib/api'
import { ScoreCardPanel } from '@/features/scoring/ScoreCardPanel'
import { StatusTransitionDialog } from '@/features/applications/StatusTransitionDialog'
import { AssignDialog } from '@/features/applications/AssignDialog'
import { DocumentPreviewDialog } from '@/features/applications/DocumentPreviewDialog'
import { ScheduleInterviewDialog } from '@/features/interviews/ScheduleInterviewDialog'
import { groupIban } from '@/lib/format'
import { ROUTES } from '../routes'
import { cn } from '@/lib/utils'

const TABS = [
  'data',
  'documents',
  'score',
  'interview',
  'contract',
  'disbursement',
  'followUps',
  'timeline',
] as const

/**
 * Stands in for a detail panel's `dl` grid while its own query is in flight.
 *
 * The related-record queries (interview, contract, disbursement, follow-ups) are
 * separate from the application read, so without this a tab opened directly by
 * URL renders its "nothing here yet" empty state first and then jumps to
 * content once the record arrives.
 */
function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  const { t } = useTranslation()
  return (
    <div
      className="grid gap-x-6 gap-y-3 sm:grid-cols-2"
      role="status"
      aria-label={t('common.loading')}
      data-testid="panel-skeleton"
    >
      {Array.from({ length: rows * 2 }).map((_, index) => (
        <div key={index} className="space-y-1.5 py-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-36" />
        </div>
      ))}
    </div>
  )
}

export default function ApplicationDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const [params, setParams] = useSearchParams()

  const [transitionOpen, setTransitionOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<UploadedDoc | null>(null)

  const { data: application, isLoading } = useApplication(id)
  const { data: interview, isLoading: interviewLoading } = useInterviewFor(id)
  const { data: contract, isLoading: contractLoading } = useContractFor(id)
  const { data: disbursement, isLoading: disbursementLoading } = useDisbursementFor(id)
  const { data: followUps = [], isLoading: followUpsLoading } = useFollowUpsFor(id)
  const setDocMissing = useSetDocumentMissing()
  const updateStatus = useUpdateStatus()

  const tab = (params.get('tab') as (typeof TABS)[number]) ?? 'data'

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  if (!application) {
    return (
      <EmptyState
        variant="page"
        icon={<AlertIcon size={22} />}
        title={t('common.noResults')}
        hint={t('common.noResultsHint')}
        action={
          <Button asChild variant="outline">
            <Link to={ROUTES.applications}>{t('common.backToList')}</Link>
          </Button>
        }
      />
    )
  }

  const missingDocs = application.documents.filter((d) => d.missing)
  const canTransition = allowedTransitions(application.status).length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={application.ref}
        title={application.beneficiary.fullName}
        subtitle={`${application.project.name} · ${t(`sector.${application.project.sector}`)}`}
        actions={
          <>
            <span data-testid="detail-status">
              <StatusBadge status={application.status} size="md" />
            </span>
            <Button variant="outline" onClick={() => setAssignOpen(true)}>
              {t('applications.assign.action')}
            </Button>
            {application.status === 'under_review' ? (
              <Button variant="outline" onClick={() => setScheduleOpen(true)}>
                <InterviewIcon size={16} />
                {t('interviews.schedule')}
              </Button>
            ) : null}
            <Button onClick={() => setTransitionOpen(true)} disabled={!canTransition}>
              {t('applications.detail.changeStatus')}
            </Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={(value) => setParams({ tab: value }, { replace: true })}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          {TABS.map((key) => (
            <TabsTrigger key={key} value={key} className="text-xs sm:text-sm">
              {t(`applications.detail.tabs.${key}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Details ─────────────────────────────────────────────────── */}
        <TabsContent value="data" className="mt-5 grid gap-5 lg:grid-cols-2">
          <SectionCard title={t('applications.detail.personalData')}>
            <dl className="grid gap-x-6 sm:grid-cols-2">
              <DataRow label={t('common.nationalId')} value={<span className="tabular">{application.beneficiary.nationalId}</span>} />
              <DataRow label={t('common.phone')} value={<span className="tabular" dir="ltr">{application.beneficiary.phone}</span>} />
              <DataRow label={t('common.email')} value={<span dir="ltr">{application.beneficiary.email}</span>} />
              <DataRow label={t('common.region')} value={t(`region.${application.beneficiary.region}`)} />
              <DataRow label={t('common.city')} value={application.beneficiary.city} />
              <DataRow
                label={t('common.iban')}
                value={<span className="tabular" dir="ltr">{groupIban(application.beneficiary.iban)}</span>}
                className="sm:col-span-2"
              />
              {application.beneficiary.commercialRegisterNo ? (
                <DataRow
                  label={t('apply.personal.crNo')}
                  value={<span className="tabular">{application.beneficiary.commercialRegisterNo}</span>}
                />
              ) : null}
            </dl>
          </SectionCard>

          <SectionCard title={t('applications.detail.projectData')}>
            <dl className="grid gap-x-6 sm:grid-cols-2">
              <DataRow label={t('apply.project.name')} value={application.project.name} />
              <DataRow label={t('common.sector')} value={t(`sector.${application.project.sector}`)} />
              <DataRow label={t('apply.project.requestedAmount')} value={<Money value={application.project.requestedAmount} />} />
              <DataRow label={t('apply.project.monthlyIncome')} value={<Money value={application.project.monthlyIncome} />} />
              <DataRow label={t('apply.project.experienceYears')} value={<span className="tabular">{application.project.experienceYears}</span>} />
              <DataRow
                label={t('common.assignee')}
                value={
                  <span data-testid="detail-assignee">
                    {application.assignee ?? t('common.unassigned')}
                  </span>
                }
              />
              <DataRow
                label={t('apply.project.description')}
                value={<span className="font-normal leading-relaxed">{application.project.description}</span>}
                className="sm:col-span-2"
              />
            </dl>
          </SectionCard>
        </TabsContent>

        {/* ── Documents ───────────────────────────────────────────────── */}
        <TabsContent value="documents" className="mt-5">
          <SectionCard
            title={t('applications.documents.title')}
            description={missingDocs.length > 0 ? t('applications.documents.requestDocsHint') : undefined}
            actions={
              missingDocs.length > 0 && application.status !== 'incomplete' ? (
                <Button
                  variant="outline"
                  onClick={() =>
                    updateStatus.mutate(
                      {
                        applicationId: application.id,
                        to: 'incomplete',
                        reason: missingDocs.map((d) => t(`docKind.${d.kind}`)).join('، '),
                      },
                      { onSuccess: () => toast.success(t('applications.transition.success')) },
                    )
                  }
                >
                  {t('applications.documents.requestDocs')}
                </Button>
              ) : null
            }
          >
            {application.documents.length === 0 ? (
              <EmptyState
                icon={<DocumentIcon size={22} />}
                title={t('applications.documents.empty')}
              />
            ) : (
            <ul className="space-y-3">
              {application.documents.map((doc) => (
                <li
                  key={doc.id}
                  className={cn(
                    'flex flex-wrap items-center gap-3 rounded-lg border p-4',
                    doc.missing ? 'border-warning bg-warning-soft/40' : 'border-border',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-10 shrink-0 items-center justify-center rounded-lg',
                      doc.missing ? 'bg-warning-soft text-warning' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {doc.missing ? <AlertIcon size={18} /> : <DocumentIcon size={18} />}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {t(`docKind.${doc.kind}`)}
                      {doc.missing ? (
                        <span className="ms-2 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">
                          {t('applications.documents.missing')}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground tabular">
                      {doc.fileName} · {doc.sizeKb} KB · <DateText value={doc.uploadedAt} />
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPreviewDoc(doc)}>
                      {t('applications.documents.preview')}
                    </Button>
                    <Button
                      variant={doc.missing ? 'secondary' : 'ghost'}
                      size="sm"
                      disabled={setDocMissing.isPending}
                      onClick={() =>
                        setDocMissing.mutate(
                          {
                            applicationId: application.id,
                            docId: doc.id,
                            missing: !doc.missing,
                            reason: t('applications.documents.missingReason', {
                              doc: t(`docKind.${doc.kind}`),
                            }),
                          },
                          {
                            onSuccess: () =>
                              toast.success(
                                doc.missing
                                  ? t('applications.documents.unmarkedMissing')
                                  : t('applications.documents.markedMissing'),
                              ),
                          },
                        )
                      }
                    >
                      {doc.missing
                        ? t('applications.documents.unmarkMissing')
                        : t('applications.documents.markMissing')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            )}
          </SectionCard>
        </TabsContent>

        {/* ── Score ───────────────────────────────────────────────────── */}
        <TabsContent value="score" className="mt-5">
          <ScoreCardPanel application={application} />
        </TabsContent>

        {/* ── Interview ───────────────────────────────────────────────── */}
        <TabsContent value="interview" className="mt-5">
          <SectionCard
            title={t('interviews.title')}
            actions={
              <Button variant="outline" onClick={() => setScheduleOpen(true)}>
                {interview ? t('interviews.reschedule') : t('interviews.schedule')}
              </Button>
            }
          >
            {interviewLoading ? (
              <PanelSkeleton />
            ) : !interview ? (
              <EmptyState icon={<InterviewIcon size={22} />} title={t('applications.detail.noInterview')} />
            ) : (
              <dl className="grid gap-x-6 sm:grid-cols-2">
                <DataRow label={t('interviews.scheduledAt')} value={<DateText value={interview.scheduledAt} withTime />} />
                <DataRow label={t('interviews.interviewer')} value={interview.interviewer} />
                <DataRow label={t('common.status')} value={t(`interviews.statuses.${interview.status}`)} />
                <DataRow
                  label={t('interviews.duration')}
                  value={<span className="tabular">{interview.durationMin} {t('interviews.minutes')}</span>}
                />
                {interview.verdict ? (
                  <DataRow label={t('interviews.notes.verdict')} value={t(`interviews.notes.verdicts.${interview.verdict}`)} />
                ) : null}
                {interview.notes ? (
                  <DataRow
                    label={t('common.notes')}
                    value={<span className="font-normal leading-relaxed">{interview.notes}</span>}
                    className="sm:col-span-2"
                  />
                ) : null}
              </dl>
            )}
          </SectionCard>
        </TabsContent>

        {/* ── Contract ────────────────────────────────────────────────── */}
        <TabsContent value="contract" className="mt-5">
          <SectionCard
            title={t('contracts.title')}
            actions={
              contract ? (
                <Button asChild variant="outline">
                  <Link to={ROUTES.contracts}>{t('contracts.preview')}</Link>
                </Button>
              ) : null
            }
          >
            {contractLoading ? (
              <PanelSkeleton rows={2} />
            ) : !contract ? (
              <EmptyState icon={<ContractIcon size={22} />} title={t('applications.detail.noContract')} />
            ) : (
              <dl className="grid gap-x-6 sm:grid-cols-2">
                <DataRow label={t('contracts.contractNo')} value={<span className="tabular">{contract.contractNo}</span>} />
                <DataRow label={t('common.status')} value={t(`contracts.statuses.${contract.status}`)} />
                <DataRow label={t('common.amount')} value={<Money value={contract.amount} />} />
                <DataRow label={t('contracts.installments')} value={<span className="tabular">{contract.installments}</span>} />
                {contract.signedAt ? (
                  <DataRow label={t('contracts.signedAt')} value={<DateText value={contract.signedAt} withTime />} />
                ) : null}
              </dl>
            )}
          </SectionCard>
        </TabsContent>

        {/* ── Disbursement ────────────────────────────────────────────── */}
        <TabsContent value="disbursement" className="mt-5">
          <SectionCard
            title={t('disbursement.title')}
            actions={
              disbursement ? (
                <Button asChild variant="outline">
                  <Link to={ROUTES.disbursements}>{t('common.details')}</Link>
                </Button>
              ) : null
            }
          >
            {disbursementLoading ? (
              <PanelSkeleton rows={2} />
            ) : !disbursement ? (
              <EmptyState icon={<DisbursementIcon size={22} />} title={t('applications.detail.noDisbursement')} />
            ) : (
              <dl className="grid gap-x-6 sm:grid-cols-2">
                <DataRow label={t('disbursement.orderNo')} value={<span className="tabular">{disbursement.orderNo}</span>} />
                <DataRow label={t('common.status')} value={t(`disbursement.statuses.${disbursement.status}`)} />
                <DataRow label={t('common.amount')} value={<Money value={disbursement.amount} />} />
                <DataRow label={t('disbursement.bank')} value={disbursement.bankName} />
                {disbursement.paidAt ? (
                  <DataRow label={t('disbursement.paidAt')} value={<DateText value={disbursement.paidAt} withTime />} />
                ) : null}
              </dl>
            )}
          </SectionCard>
        </TabsContent>

        {/* ── Follow-ups ──────────────────────────────────────────────── */}
        <TabsContent value="followUps" className="mt-5">
          <SectionCard title={t('followUp.title')}>
            {followUpsLoading ? (
              <PanelSkeleton rows={2} />
            ) : followUps.length === 0 ? (
              <EmptyState icon={<ApplicationsIcon size={22} />} title={t('applications.detail.noFollowUps')} />
            ) : (
              <ul className="space-y-3">
                {followUps.map((followUp) => (
                  <li key={followUp.id} className="rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{followUp.period}</span>
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                          followUp.healthStatus === 'on_track'
                            ? 'bg-success-soft text-success'
                            : followUp.healthStatus === 'at_risk'
                              ? 'bg-warning-soft text-warning'
                              : 'bg-destructive-soft text-destructive',
                        )}
                      >
                        {t(`followUp.health.${followUp.healthStatus}`)}
                      </span>
                    </div>
                    <dl className="mt-2 grid gap-x-6 sm:grid-cols-3">
                      <DataRow label={t('followUp.revenue')} value={<Money value={followUp.performance.revenue} />} />
                      <DataRow label={t('followUp.employees')} value={<span className="tabular">{followUp.performance.employees}</span>} />
                      <DataRow label={t('followUp.growth')} value={<span className="tabular">{followUp.performance.growthPct}%</span>} />
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>

        {/* ── Timeline ────────────────────────────────────────────────── */}
        <TabsContent value="timeline" className="mt-5">
          <SectionCard title={t('timeline.title')}>
            <Timeline events={application.timeline} order="desc" />
          </SectionCard>
        </TabsContent>
      </Tabs>

      <StatusTransitionDialog
        application={application}
        open={transitionOpen}
        onOpenChange={setTransitionOpen}
      />
      <AssignDialog application={application} open={assignOpen} onOpenChange={setAssignOpen} />
      <DocumentPreviewDialog doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      <ScheduleInterviewDialog
        applicationId={application.id}
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
      />
    </div>
  )
}
