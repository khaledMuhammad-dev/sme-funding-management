import { type ReactNode, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { prefersReducedMotion } from '@/lib/gsap'
import { cn } from '@/lib/utils'

export interface StatCardProps {
  label: string
  /** Pass a number to get the count-up; pass a string for pre-formatted values. */
  value: number | string
  /** Wraps the counted number, e.g. `(n) => formatCurrency(n, lang)`. */
  format?: (value: number) => string
  trend?: { value: number; positive?: boolean }
  icon?: ReactNode
  hint?: string
  /** Highlights the tile in brass — reserved for the single headline metric. */
  featured?: boolean
  isLoading?: boolean
  className?: string
}

/** Counts from 0 to `target` on mount; snaps when reduced motion is requested. */
function useCountUp(target: number, enabled: boolean) {
  const [value, setValue] = useState(enabled ? 0 : target)

  useEffect(() => {
    if (!enabled || prefersReducedMotion()) {
      setValue(target)
      return
    }

    let frame = 0
    const duration = 900
    const start = performance.now()

    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      // easeOutCubic — fast start, settled finish
      const eased = 1 - (1 - progress) ** 3
      setValue(Math.round(target * eased))
      if (progress < 1) frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, enabled])

  return value
}

export function StatCard({
  label,
  value,
  format,
  trend,
  icon,
  hint,
  featured,
  isLoading,
  className,
}: StatCardProps) {
  const { t } = useTranslation()
  const isNumeric = typeof value === 'number'
  const counted = useCountUp(isNumeric ? value : 0, isNumeric && !isLoading)

  const display = isLoading
    ? null
    : isNumeric
      ? (format?.(counted) ?? String(counted))
      : value

  return (
    <div
      data-morph-host
      className={cn(
        'flex flex-col gap-2 rounded-xl border p-5 shadow-soft-sm transition-shadow hover:shadow-soft-md',
        featured
          ? 'border-gold bg-gold-soft text-gold-ink'
          : 'border-border bg-card text-card-foreground',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'text-sm font-medium',
            featured ? 'text-gold-ink' : 'text-muted-foreground',
          )}
        >
          {label}
        </span>
        {icon ? (
          <span className={featured ? 'text-gold-ink' : 'text-muted-foreground'}>{icon}</span>
        ) : null}
      </div>

      {isLoading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <span className="text-3xl font-semibold leading-none tracking-tight tabular">
          {display}
        </span>
      )}

      {trend && !isLoading ? (
        <span
          className={cn(
            'inline-flex items-center gap-1 text-xs font-semibold',
            trend.positive === false ? 'text-destructive' : 'text-success',
          )}
        >
          <span aria-hidden="true">{trend.positive === false ? '▼' : '▲'}</span>
          {Math.abs(trend.value)}%
          {hint ? <span className="font-normal text-muted-foreground">· {hint}</span> : null}
        </span>
      ) : hint && !isLoading ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}

      {isLoading ? <span className="sr-only">{t('common.loading')}</span> : null}
    </div>
  )
}
