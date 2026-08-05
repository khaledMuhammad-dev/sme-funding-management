import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfirmDialog } from '@/components/shared'
import { useInterviews, useScheduleInterview } from '@/lib/api'
import { useUiStore } from '@/stores/useUiStore'
import { formatDatePart } from '@/lib/format'
import { cn } from '@/lib/utils'

const INTERVIEWERS = ['د. هيا العريفي', 'أ. سلمان الدوسري', 'أ. مريم القحطاني']
const SLOTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00']

/** Next ten working days — the demo never offers a slot in the past. */
function upcomingDays() {
  const days: Date[] = []
  const cursor = new Date()
  while (days.length < 10) {
    cursor.setDate(cursor.getDate() + 1)
    if (cursor.getDay() !== 5 && cursor.getDay() !== 6) days.push(new Date(cursor))
  }
  return days
}

/** `2026-08-06` for a local date — the key the week board and tests match on. */
function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function slotAt(day: Date, slot: string) {
  const [hours, minutes] = slot.split(':').map(Number)
  const at = new Date(day)
  at.setHours(hours, minutes, 0, 0)
  return at
}

export function ScheduleInterviewDialog({
  applicationId,
  open,
  onOpenChange,
}: {
  applicationId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const lang = useUiStore((s) => s.lang)
  const days = upcomingDays()

  const [day, setDay] = useState(0)
  const [slot, setSlot] = useState(SLOTS[1])
  const [interviewer, setInterviewer] = useState(INTERVIEWERS[0])
  const schedule = useScheduleInterview()
  const { data: interviews = [] } = useInterviews()

  /**
   * The same interviewer cannot be in two places at once, so slots already
   * held by her are closed. The application being (re)scheduled is excluded —
   * moving an interview must not collide with the slot it is leaving.
   */
  const takenSlots = useMemo(() => {
    const taken = new Set<number>()
    for (const interview of interviews) {
      if (interview.status !== 'scheduled') continue
      if (interview.applicationId === applicationId) continue
      if (interview.interviewer !== interviewer) continue
      taken.add(new Date(interview.scheduledAt).getTime())
    }
    return taken
  }, [interviews, interviewer, applicationId])

  const isTaken = (option: string) => takenSlots.has(slotAt(days[day], option).getTime())

  const handleConfirm = () => {
    if (!applicationId || isTaken(slot)) return
    const scheduledAt = slotAt(days[day], slot)

    schedule.mutate(
      { applicationId, scheduledAt: scheduledAt.toISOString(), interviewer },
      {
        onSuccess: () => {
          toast.success(t('interviews.dialog.success'))
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('interviews.dialog.title')}
      description={t('interviews.dialog.description')}
      confirmLabel={t('interviews.dialog.confirm')}
      disabled={isTaken(slot)}
      isPending={schedule.isPending}
      onConfirm={handleConfirm}
    >
      <div className="min-w-0 space-y-2">
        <Label>{t('interviews.dialog.date')}</Label>
        {/*
          Ten day-chips are wider than the dialog by design — the strip scrolls
          rather than stretching it. `-mx-1 px-1` keeps the focus ring of the
          first and last chip from being clipped by the scroll container.
        */}
        <div
          className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-2"
          role="radiogroup"
          aria-label={t('interviews.dialog.date')}
        >
          {days.map((date, index) => (
            <button
              key={date.toISOString()}
              type="button"
              role="radio"
              aria-checked={day === index}
              data-date={dateKey(date)}
              data-day={date.getDate()}
              onClick={() => setDay(index)}
              className={cn(
                'flex w-16 shrink-0 snap-start flex-col items-center gap-0.5 rounded-lg border px-2 py-2 leading-none transition-colors',
                day === index
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-accent',
              )}
            >
              <span className="text-[11px] opacity-80">
                {formatDatePart(date.toISOString(), lang, { weekday: 'short' })}
              </span>
              <span className="text-lg font-semibold tabular">{date.getDate()}</span>
              <span className="text-[10px] opacity-75">
                {formatDatePart(date.toISOString(), lang, { month: 'short' })}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t('interviews.dialog.slot')}</Label>
        <div className="flex flex-wrap gap-2">
          {SLOTS.map((option) => {
            const taken = isTaken(option)
            return (
              <button
                key={option}
                type="button"
                onClick={() => setSlot(option)}
                disabled={taken}
                title={taken ? t('interviews.dialog.slotTaken') : undefined}
                aria-pressed={slot === option}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-sm tabular transition-colors',
                  taken && 'cursor-not-allowed border-border text-muted-foreground line-through opacity-50',
                  !taken && slot === option
                    ? 'border-terracotta-ink bg-terracotta text-terracotta-foreground'
                    : 'border-border',
                  !taken && slot !== option && 'hover:bg-accent',
                )}
              >
                {option}
              </button>
            )
          })}
        </div>
        {isTaken(slot) ? (
          <p className="text-xs text-destructive">{t('interviews.dialog.slotTaken')}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="interviewer">{t('interviews.dialog.interviewer')}</Label>
        <Select value={interviewer} onValueChange={setInterviewer}>
          <SelectTrigger id="interviewer" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INTERVIEWERS.map((name) => (
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
