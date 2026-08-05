import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface SectionCardProps {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  /** Removes the body padding for tables and lists that own their own edges. */
  flush?: boolean
  className?: string
  contentClassName?: string
}

/** The standard panel: bordered card, optional header row, consistent padding. */
export function SectionCard({
  title,
  description,
  actions,
  children,
  flush,
  className,
  contentClassName,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-card shadow-soft-sm',
        className,
      )}
    >
      {title || actions ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="space-y-0.5">
            {title ? <h2 className="font-semibold">{title}</h2> : null}
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}

      <div className={cn(flush ? '' : 'p-5', contentClassName)}>{children}</div>
    </section>
  )
}

/** Label/value row used across every detail panel. */
export function DataRow({
  label,
  value,
  className,
}: {
  label: string
  value: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-0.5 py-2', className)}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  )
}
