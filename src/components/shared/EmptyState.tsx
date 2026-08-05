import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface EmptyStateProps {
  title: string
  hint?: string
  icon?: ReactNode
  action?: ReactNode
  /** `inline` sits inside a card; `page` fills the content area. */
  variant?: 'inline' | 'page'
  className?: string
}

/** The one empty state. Every list, tab and panel uses it. */
export function EmptyState({
  title,
  hint,
  icon,
  action,
  variant = 'inline',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-center',
        variant === 'page' ? 'min-h-[24rem] px-6 py-20' : 'px-6 py-12',
        className,
      )}
    >
      {icon ? (
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </span>
      ) : null}
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {hint ? <p className="mx-auto max-w-sm text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      {action}
    </div>
  )
}
