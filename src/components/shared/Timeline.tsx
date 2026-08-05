import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import type { ApplicationStatus, TimelineEvent } from '@/data/types'
import { useUiStore } from '@/stores/useUiStore'
import { formatDateTime, formatRelative } from '@/lib/format'
import { STATUS_DOT } from './StatusBadge'
import { cn } from '@/lib/utils'
import { byDate } from '@/lib/sort'

export interface TimelineProps {
  events: TimelineEvent[]
  /** Newest first (detail pages) or oldest first (applicant journey). */
  order?: 'desc' | 'asc'
  className?: string
}

const KIND_DOT: Record<string, string> = {
  document: 'bg-info',
  note: 'bg-muted-foreground',
  notification: 'bg-terracotta',
  interview: 'bg-status-awaiting-interview',
  contract: 'bg-status-approved',
  disbursement: 'bg-status-disbursed',
  follow_up: 'bg-status-follow-up',
}

/** Vertical event rail used on the application detail page and on /track. */
export function Timeline({ events, order = 'desc', className }: TimelineProps) {
  const { t } = useTranslation()
  const lang = useUiStore((s) => s.lang)

  const sorted = [...events].sort(
    byDate<TimelineEvent>((event) => event.at, order, (event) => event.id),
  )

  return (
    <ol className={cn('flex flex-col', className)}>
      {sorted.map((event, index) => {
        const dot =
          event.kind === 'status_change' && event.to
            ? STATUS_DOT[event.to as ApplicationStatus]
            : (KIND_DOT[event.kind] ?? 'bg-muted-foreground')

        // Translated message; params carry the status/doc/trigger to interpolate.
        const params = event.params ?? {}
        const message = t(event.messageKey, {
          ...params,
          status: params.status ? t(`status.${params.status}`) : undefined,
          doc: params.doc ? t(`docKind.${params.doc}`) : undefined,
          trigger: params.trigger ? t(`notifications.triggers.${params.trigger}`) : undefined,
        })

        return (
          <motion.li
            key={event.id}
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.24) }}
            className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3"
          >
            <div className="flex flex-col items-center">
              <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', dot)} />
              {index < sorted.length - 1 ? <span className="w-px flex-1 bg-border" /> : null}
            </div>

            <div className={cn('pb-5', index === sorted.length - 1 && 'pb-0')}>
              <p className="text-sm font-medium">{message}</p>
              {params.reason ? (
                <p className="mt-1 rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                  {String(params.reason)}
                </p>
              ) : null}
              <p className="mt-0.5 text-xs text-muted-foreground">
                <time dateTime={event.at}>{formatDateTime(event.at, lang)}</time>
                <span className="mx-1.5">·</span>
                {formatRelative(event.at, lang)}
                <span className="mx-1.5">·</span>
                {t('timeline.by')} {event.actor}
              </p>
            </div>
          </motion.li>
        )
      })}
    </ol>
  )
}
