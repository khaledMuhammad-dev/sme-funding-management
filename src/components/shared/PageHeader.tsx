import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface PageHeaderProps {
  title: string
  subtitle?: string
  eyebrow?: string
  /** Buttons pinned to the trailing edge. */
  actions?: ReactNode
  /** Tabs or filter chips that sit directly under the title block. */
  below?: ReactNode
  className?: string
}

/** The title block every page opens with. */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  below,
  className,
}: PageHeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn('flex flex-col gap-4', className)}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-terracotta-ink">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
          {subtitle ? (
            <p className="max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {below}
    </motion.header>
  )
}
