import { useTranslation } from 'react-i18next'
import type { ApplicationStatus } from '@/data/types'
import { StatusIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

/**
 * Status → colour + translated label + icon, in one place.
 *
 * Colour is never the only signal: the badge always carries its label, and the
 * icon differs per status, so the eight states stay distinguishable under any
 * colour-vision deficiency.
 */
const STATUS_CLASS: Record<ApplicationStatus, string> = {
  new: 'bg-status-new-soft text-status-new',
  incomplete: 'bg-status-incomplete-soft text-status-incomplete',
  under_review: 'bg-status-under-review-soft text-status-under-review',
  awaiting_interview: 'bg-status-awaiting-interview-soft text-status-awaiting-interview',
  approved: 'bg-status-approved-soft text-status-approved',
  rejected: 'bg-status-rejected-soft text-status-rejected',
  disbursed: 'bg-status-disbursed-soft text-status-disbursed',
  follow_up: 'bg-status-follow-up-soft text-status-follow-up',
}

/** Solid dot / rail colour for timelines and steppers. */
export const STATUS_DOT: Record<ApplicationStatus, string> = {
  new: 'bg-status-new',
  incomplete: 'bg-status-incomplete',
  under_review: 'bg-status-under-review',
  awaiting_interview: 'bg-status-awaiting-interview',
  approved: 'bg-status-approved',
  rejected: 'bg-status-rejected',
  disbursed: 'bg-status-disbursed',
  follow_up: 'bg-status-follow-up',
}

export interface StatusBadgeProps {
  status: ApplicationStatus
  size?: 'sm' | 'md'
  withIcon?: boolean
  className?: string
}

export function StatusBadge({
  status,
  size = 'sm',
  withIcon = true,
  className,
}: StatusBadgeProps) {
  const { t } = useTranslation()

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold',
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        STATUS_CLASS[status],
        className,
      )}
    >
      {withIcon ? <StatusIcon status={status} size={size === 'sm' ? 13 : 15} strokeWidth={2.2} /> : null}
      {t(`status.${status}`)}
    </span>
  )
}
