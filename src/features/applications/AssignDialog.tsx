import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared'
import { CheckIcon } from '@/components/icons'
import type { Application } from '@/data/types'
import { useAssign } from '@/lib/api'
import { initialsOf } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * The programme's case officers.
 *
 * Personal names are data, not copy, so they are not translated — the same
 * roster appears in both languages exactly as it is written on the payroll.
 */
const CASE_OFFICERS = [
  'فاطمة الأنصاري',
  'عمر السالم',
  'ليلى الحمد',
  'يوسف النعيمي',
] as const

export interface AssignDialogProps {
  application: Application | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Hands an application to a case officer. The only assignment surface. */
export function AssignDialog({ application, open, onOpenChange }: AssignDialogProps) {
  const { t } = useTranslation()
  const [assignee, setAssignee] = useState<string | null>(null)
  const assign = useAssign()

  useEffect(() => {
    if (open) setAssignee(application?.assignee ?? null)
  }, [open, application?.id, application?.assignee])

  if (!application) return null

  const handleConfirm = () => {
    if (!assignee) return
    assign.mutate(
      { applicationId: application.id, assignee },
      {
        onSuccess: () => {
          toast.success(t('applications.assign.success', { name: assignee }))
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('applications.assign.title')}
      description={t('applications.assign.description')}
      confirmLabel={t('applications.assign.confirm')}
      disabled={!assignee || assignee === application.assignee}
      isPending={assign.isPending}
      onConfirm={handleConfirm}
    >
      <ul className="space-y-2" role="radiogroup" aria-label={t('common.assignee')}>
        {CASE_OFFICERS.map((officer) => {
          const selected = assignee === officer
          return (
            <li key={officer}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setAssignee(officer)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border p-3 text-start transition-colors',
                  selected
                    ? 'border-primary bg-primary-soft'
                    : 'border-border hover:border-input hover:bg-accent',
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                  {initialsOf(officer)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{officer}</span>
                {selected ? <CheckIcon size={16} strokeWidth={2.4} className="text-primary" /> : null}
              </button>
            </li>
          )
        })}
      </ul>
    </ConfirmDialog>
  )
}
