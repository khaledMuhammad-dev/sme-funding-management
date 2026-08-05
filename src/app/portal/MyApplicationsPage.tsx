import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DataRow,
  DateText,
  EmptyState,
  Money,
  PageHeader,
  SectionCard,
  StatusBadge,
} from '@/components/shared'
import { AlertIcon, SearchIcon } from '@/components/icons'
import { useApplicationsByRefs } from '@/lib/api'
import { useApplicantStore } from '@/stores/useApplicantStore'
import { ROUTES } from '../routes'

/**
 * The signed-in applicant's own funding applications.
 *
 * There is no authentication in this demo, so which applications these are is
 * still resolved from the references the portal has collected — submitted
 * through the wizard, or looked up on `/track`. That is plumbing: the screen
 * reads as one person's list of his own applications, and never offers to stop
 * being that person.
 */
export default function MyApplicationsPage() {
  const { t } = useTranslation()
  const refs = useApplicantStore((s) => s.refs)
  const activeRef = useApplicantStore((s) => s.ref)

  const { data: rows, isPending } = useApplicationsByRefs(refs)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader
        title={t('myApplications.title')}
        subtitle={t('myApplications.subtitle')}
        className="mb-6"
      />

      {refs.length === 0 ? (
        <div data-testid="my-applications-empty">
          <EmptyState
            variant="page"
            icon={<SearchIcon size={22} />}
            title={t('myApplications.emptyTitle')}
            hint={t('myApplications.emptyHint')}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild>
                  <Link to={ROUTES.track}>{t('myApplications.emptyTrackCta')}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to={ROUTES.apply}>{t('myApplications.emptyApplyCta')}</Link>
                </Button>
              </div>
            }
          />
        </div>
      ) : isPending || !rows ? (
        /*
          One skeleton per remembered reference, at the height of a real row, so
          the list does not jump as the simulated read resolves.
        */
        <div
          data-testid="my-applications-loading"
          aria-busy="true"
          aria-live="polite"
          aria-label={t('common.loading')}
          className="space-y-4"
        >
          {refs.map((ref) => (
            <Skeleton key={ref} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : (
        <ul data-testid="my-applications-list" className="space-y-4">
          {rows.map(({ ref, application }) => (
            <li key={ref}>
              <SectionCard className="h-full">
                <div
                  data-testid="my-application-row"
                  data-ref={ref}
                  data-resolved={application ? 'true' : 'false'}
                  data-active={activeRef === ref ? 'true' : 'false'}
                  className="space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('common.reference')}
                      </p>
                      <p className="text-lg font-semibold tabular" dir="ltr">
                        {ref}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {application ? (
                          application.project.name
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-warning">
                            <AlertIcon size={15} />
                            {t('myApplications.unavailable')}
                          </span>
                        )}
                      </p>
                    </div>
                    {application ? <StatusBadge status={application.status} size="md" /> : null}
                  </div>

                  {application ? (
                    <dl className="grid gap-x-6 sm:grid-cols-2">
                      <DataRow
                        label={t('track.submittedAt')}
                        value={<DateText value={application.createdAt} />}
                      />
                      <DataRow
                        label={t('apply.project.requestedAmount')}
                        value={<Money value={application.project.requestedAmount} />}
                      />
                    </dl>
                  ) : (
                    // Same block height as the details grid above, so a row that
                    // stopped resolving does not resize the list around it.
                    <p className="py-2 text-sm text-muted-foreground">
                      {t('myApplications.unavailableHint')}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild size="sm" data-testid="my-application-open">
                      <Link to={`${ROUTES.track}?ref=${encodeURIComponent(ref)}`}>
                        {t('myApplications.open')}
                      </Link>
                    </Button>
                  </div>
                </div>
              </SectionCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
