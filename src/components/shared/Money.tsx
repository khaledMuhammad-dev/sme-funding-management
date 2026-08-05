import { useUiStore } from '@/stores/useUiStore'
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Locale-aware primitives. Pages never call `Intl` directly — they render these,
 * so a language switch reformats every number and date in one pass.
 */

export function Money({
  value,
  compact,
  className,
}: {
  value: number
  compact?: boolean
  className?: string
}) {
  const lang = useUiStore((s) => s.lang)
  return <span className={cn('tabular', className)}>{formatCurrency(value, lang, compact)}</span>
}

export function Num({
  value,
  className,
  options,
}: {
  value: number
  className?: string
  options?: Intl.NumberFormatOptions
}) {
  const lang = useUiStore((s) => s.lang)
  return <span className={cn('tabular', className)}>{formatNumber(value, lang, options)}</span>
}

export function DateText({
  value,
  withTime,
  className,
}: {
  value: string
  withTime?: boolean
  className?: string
}) {
  const lang = useUiStore((s) => s.lang)
  return (
    <time dateTime={value} className={cn('tabular', className)}>
      {withTime ? formatDateTime(value, lang) : formatDate(value, lang)}
    </time>
  )
}
