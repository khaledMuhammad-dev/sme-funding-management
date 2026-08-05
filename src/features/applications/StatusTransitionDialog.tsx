import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog, StatusBadge } from '@/components/shared'
import { ArrowIcon } from '@/components/icons'
import type { Application, ApplicationStatus } from '@/data/types'
import { allowedTransitions, requiresReason } from '@/data/statusFlow'
import { useUpdateStatus } from '@/lib/api'
import { cn } from '@/lib/utils'

export interface StatusTransitionDialogProps {
  application: Application | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * The only way a status changes in the app.
 *
 * The choices come from `statusFlow.ts`, so an illegal transition can't be
 * offered; rejections and document requests must carry a reason the applicant
 * will read.
 */
export function StatusTransitionDialog({
  application,
  open,
  onOpenChange,
}: StatusTransitionDialogProps) {
  const { t } = useTranslation()
  const [target, setTarget] = useState<ApplicationStatus | null>(null)
  const [reason, setReason] = useState('')
  const updateStatus = useUpdateStatus()

  useEffect(() => {
    if (open) {
      setTarget(null)
      setReason('')
    }
  }, [open, application?.id])

  if (!application) return null

  const options = allowedTransitions(application.status)
  const reasonNeeded = target ? requiresReason(target) : false
  const canConfirm = Boolean(target) && (!reasonNeeded || reason.trim().length >= 10)

  const handleConfirm = () => {
    if (!target) return
    updateStatus.mutate(
      { applicationId: application.id, to: target, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(t('applications.transition.success'))
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('applications.transition.title')}
      description={t('applications.transition.description')}
      confirmLabel={t('applications.transition.confirm')}
      destructive={target === 'rejected'}
      disabled={!canConfirm}
      isPending={updateStatus.isPending}
      onConfirm={handleConfirm}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-lg bg-muted px-4 py-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">{t('applications.transition.from')}</p>
          <StatusBadge status={application.status} />
        </div>
        <ArrowIcon size={18} className="mt-4 rtl-flip text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{t('applications.transition.to')}</p>
          {target ? (
            <StatusBadge status={target} />
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>
      </div>

      {options.length === 0 ? (
        <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
          {t('applications.transition.noTransitions')}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('applications.transition.to')}>
          {options.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={target === option}
              onClick={() => setTarget(option)}
              className={cn(
                'rounded-lg border p-1 transition-colors',
                target === option
                  ? 'border-primary ring-2 ring-ring ring-offset-2 ring-offset-background'
                  : 'border-border hover:border-input',
              )}
            >
              <StatusBadge status={option} size="md" />
            </button>
          ))}
        </div>
      )}

      {reasonNeeded ? (
        <div className="space-y-1.5">
          <Label htmlFor="transition-reason">
            {t('applications.transition.reasonLabel')}
            <span className="text-terracotta-ink">*</span>
          </Label>
          <Textarea
            id="transition-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t('applications.transition.reasonPlaceholder')}
            rows={3}
            aria-invalid={reason.trim().length > 0 && reason.trim().length < 10}
          />
          {reason.trim().length < 10 ? (
            <p className="text-xs text-muted-foreground">
              {t('applications.transition.reasonRequired')}
            </p>
          ) : null}
        </div>
      ) : null}
    </ConfirmDialog>
  )
}
