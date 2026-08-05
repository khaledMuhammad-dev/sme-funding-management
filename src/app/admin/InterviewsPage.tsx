import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DataTable,
  DataTableSearch,
  DateText,
  EmptyState,
  PageHeader,
  actionsColumn,
  createAppColumnHelper,
  sortableHeader,
  type AppColumnDef,
} from '@/components/shared'
import { CheckIcon, InterviewIcon, XIcon } from '@/components/icons'
import type { Interview, InterviewVerdict } from '@/data/types'
import { useApplications, useInterviews, useSaveInterviewNotes } from '@/lib/api'
import { useUiStore } from '@/stores/useUiStore'
import { formatDatePart, formatTime } from '@/lib/format'
import { ScheduleInterviewDialog } from '@/features/interviews/ScheduleInterviewDialog'
import { ROUTES } from '../routes'
import { cn } from '@/lib/utils'
import { byDate } from '@/lib/sort'

const STATUS_CLASS: Record<Interview['status'], string> = {
  scheduled: 'bg-status-awaiting-interview-soft text-status-awaiting-interview',
  done: 'bg-success-soft text-success',
  no_show: 'bg-destructive-soft text-destructive',
}

/** An interview plus the applicant fields the board renders, resolved once. */
type InterviewRow = Interview & { beneficiaryName: string; applicationRef: string }

/** Local `YYYY-MM-DD` key — never `toISOString()`, which would shift the day in +03. */
function dayKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

export default function InterviewsPage() {
  const { t } = useTranslation()
  const lang = useUiStore((s) => s.lang)
  const navigate = useNavigate()

  const [view, setView] = useState<'list' | 'week'>('list')
  const [search, setSearch] = useState('')
  const [notesFor, setNotesFor] = useState<Interview | null>(null)
  const [scheduleFor, setScheduleFor] = useState<string | null>(null)

  const { data: interviews = [], isLoading } = useInterviews()
  const { data: applications = [] } = useApplications()

  const appById = useMemo(
    () => new Map(applications.map((a) => [a.id, a])),
    [applications],
  )

  /**
   * The applicant's name is folded into the row rather than looked up from the
   * column definitions: a column def that closes over `appById` gets a new
   * identity on every applications refetch, which remounts every cell — closing
   * any open row menu mid-click.
   */
  const rows = useMemo<InterviewRow[]>(
    () =>
      interviews.map((interview) => {
        const app = appById.get(interview.applicationId)
        return {
          ...interview,
          beneficiaryName: app?.beneficiary.fullName ?? '—',
          applicationRef: app?.ref ?? '',
        }
      }),
    [interviews, appById],
  )

  const columns = useMemo<AppColumnDef<InterviewRow>[]>(() => {
    const helper = createAppColumnHelper<InterviewRow>()
    return [
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
      helper.accessor('scheduledAt', {
        header: sortableHeader(t('interviews.scheduledAt')),
        meta: { label: t('interviews.scheduledAt'), width: 190 },
        cell: ({ getValue }) => <DateText value={getValue()} withTime />,
      }),
      helper.accessor('interviewer', {
        header: sortableHeader(t('interviews.interviewer')),
        meta: { label: t('interviews.interviewer') },
      }),
      helper.accessor('meetingUrl', {
        header: t('interviews.meetingLink'),
        meta: { label: t('interviews.meetingLink'), width: 150 },
        enableSorting: false,
        cell: ({ getValue }) => (
          <a
            href={getValue() as string}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {t('interviews.openMeeting')}
          </a>
        ),
      }),
      helper.accessor('status', {
        header: sortableHeader(t('common.status')),
        meta: { label: t('common.status'), width: 130 },
        cell: ({ getValue }) => (
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS_CLASS[getValue() as Interview['status']])}>
            {t(`interviews.statuses.${getValue() as Interview['status']}`)}
          </span>
        ),
      }),
      actionsColumn<InterviewRow>(
        [
          {
            key: 'application',
            label: t('common.details'),
            onSelect: (row) => navigate(ROUTES.application(row.applicationId)),
          },
          {
            key: 'notes',
            label: t('interviews.notes.title'),
            onSelect: (row) => setNotesFor(row),
          },
          {
            key: 'reschedule',
            label: t('interviews.reschedule'),
            onSelect: (row) => setScheduleFor(row.applicationId),
          },
        ],
        t('common.actions'),
      ),
    ] as AppColumnDef<InterviewRow>[]
  }, [t, navigate])

  /** Next seven days, each with the interviews that fall inside it. */
  const week = useMemo(() => {
    const days: { date: Date; items: InterviewRow[] }[] = []
    for (let i = 0; i < 7; i++) {
      const date = new Date()
      date.setDate(date.getDate() + i)
      date.setHours(0, 0, 0, 0)
      days.push({
        date,
        items: rows
          .filter((interview) => {
            const at = new Date(interview.scheduledAt)
            return at.toDateString() === date.toDateString()
          })
          .sort(byDate((i) => i.scheduledAt, 'asc', (i) => i.id)),
      })
    }
    return days
  }, [rows])

  const filteredWeek = search
    ? week.map((day) => ({
        ...day,
        items: day.items.filter((item) =>
          item.beneficiaryName.toLowerCase().includes(search.toLowerCase()),
        ),
      }))
    : week

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('interviews.title')}
        subtitle={t('interviews.subtitle')}
        actions={
          <Tabs value={view} onValueChange={(value) => setView(value as 'list' | 'week')}>
            <TabsList>
              <TabsTrigger value="list">{t('interviews.listView')}</TabsTrigger>
              <TabsTrigger value="week">{t('interviews.weekView')}</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {view === 'list' ? (
        <DataTable
          columns={columns}
          data={rows}
          getRowId={(row) => row.id}
          isLoading={isLoading}
          onRowClick={(row) => setNotesFor(row)}
          emptyIcon={<InterviewIcon size={22} />}
          emptyTitle={t('interviews.empty')}
          emptyHint={t('interviews.emptyHint')}
        />
      ) : (
        <div className="space-y-4">
          {/* The board reuses the table's search control rather than growing its own. */}
          <DataTableSearch value={search} onChange={setSearch} className="sm:w-72" />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {filteredWeek.map((day) => (
              <div
                key={day.date.toISOString()}
                data-day-cell={dayKey(day.date)}
                className="rounded-xl border border-border bg-card p-3"
              >
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="text-sm font-semibold">
                    {formatDatePart(day.date.toISOString(), lang, { weekday: 'short' })}
                  </span>
                  <span className="text-xs text-muted-foreground tabular">
                    {formatDatePart(day.date.toISOString(), lang, { day: '2-digit', month: 'short' })}
                  </span>
                </div>

                {isLoading ? (
                  /* Same footprint as a day holding one interview — the board
                     must not collapse and then push itself open on arrival. */
                  <div className="space-y-2 py-1" role="status" aria-label={t('common.loading')}>
                    <Skeleton className="h-12 w-full rounded-lg" />
                  </div>
                ) : day.items.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">{t('common.none')}</p>
                ) : (
                  <ul className="space-y-2">
                    {day.items.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setNotesFor(item)}
                          className="w-full rounded-lg border border-border bg-background p-2.5 text-start transition-colors hover:border-input hover:bg-accent"
                        >
                          <p className="text-xs font-semibold tabular">
                            {formatTime(item.scheduledAt, lang)}
                          </p>
                          <p className="mt-0.5 truncate text-xs">{item.beneficiaryName}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <InterviewNotesSheet interview={notesFor} onClose={() => setNotesFor(null)} />
      <ScheduleInterviewDialog
        applicationId={scheduleFor}
        open={Boolean(scheduleFor)}
        onOpenChange={(open) => !open && setScheduleFor(null)}
      />
    </div>
  )
}

const VERDICTS: InterviewVerdict[] = ['recommend', 'conditional', 'not_recommend']

function InterviewNotesSheet({
  interview,
  onClose,
}: {
  interview: Interview | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const lang = useUiStore((s) => s.lang)
  const save = useSaveInterviewNotes()

  const [notes, setNotes] = useState('')
  const [verdict, setVerdict] = useState<InterviewVerdict>('recommend')

  /**
   * Radix only calls `onOpenChange` for *user* interactions, so seeding the form
   * from there left the sheet blank whenever it was opened programmatically —
   * and saving then wiped the notes it was supposed to show.
   */
  useEffect(() => {
    if (!interview) return
    setNotes(interview.notes ?? '')
    setVerdict(interview.verdict ?? 'recommend')
  }, [interview])

  const handleSave = (status: 'done' | 'no_show') => {
    if (!interview) return
    save.mutate(
      { interviewId: interview.id, notes, verdict, status },
      {
        onSuccess: () => {
          toast.success(t('interviews.notes.saved'))
          onClose()
        },
      },
    )
  }

  return (
    <Sheet
      open={Boolean(interview)}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent side={lang === 'ar' ? 'left' : 'right'} className="w-full gap-0 p-0 sm:max-w-md [&>*]:min-w-0">
        {interview ? (
          <>
            <SheetHeader className="border-b border-border p-5">
              <SheetTitle>{t('interviews.notes.title')}</SheetTitle>
              <SheetDescription>{t('interviews.notes.description')}</SheetDescription>
            </SheetHeader>

            <div className="space-y-5 p-5">
              <div className="space-y-2">
                <Label>{t('interviews.notes.verdict')}</Label>
                <div className="flex flex-wrap gap-2">
                  {VERDICTS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setVerdict(option)}
                      aria-pressed={verdict === option}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                        verdict === option
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border hover:bg-accent',
                      )}
                    >
                      {t(`interviews.notes.verdicts.${option}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="interview-notes">{t('common.notes')}</Label>
                <Textarea
                  id="interview-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder={t('interviews.notes.placeholder')}
                  rows={7}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => handleSave('done')} disabled={save.isPending}>
                  <CheckIcon size={16} />
                  {t('interviews.notes.markDone')}
                </Button>
                <Button variant="outline" onClick={() => handleSave('no_show')} disabled={save.isPending}>
                  <XIcon size={16} />
                  {t('interviews.notes.markNoShow')}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState title={t('interviews.empty')} />
        )}
      </SheetContent>
    </Sheet>
  )
}
