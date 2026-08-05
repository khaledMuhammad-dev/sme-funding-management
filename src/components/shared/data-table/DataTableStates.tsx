import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TableCell, TableRow } from '@/components/ui/table'
import { AlertIcon, SearchIcon } from '@/components/icons'

/**
 * Loading / empty / error rows.
 *
 * Kept separate so every list surface in the app — table, card grid, sheet —
 * shows the same three states with the same shape and copy.
 */

export function DataTableSkeletonRows({ rows = 8, columns }: { rows?: number; columns: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={rowIndex} className="hover:bg-transparent">
          {Array.from({ length: columns }).map((__, colIndex) => (
            <TableCell key={colIndex} className="h-[3.25rem]">
              {/* Widths vary so the skeleton reads as content, not a barcode. */}
              <Skeleton
                className="h-4"
                style={{ width: `${[70, 90, 55, 80, 45, 65][(rowIndex + colIndex) % 6]}%` }}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

export interface DataTableEmptyProps {
  title?: string
  hint?: string
  icon?: ReactNode
  action?: ReactNode
}

export function DataTableEmpty({ title, hint, icon, action }: DataTableEmptyProps) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <SearchIcon size={22} />}
      </span>
      <div className="space-y-1">
        <p className="font-medium">{title ?? t('common.noResults')}</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          {hint ?? t('common.noResultsHint')}
        </p>
      </div>
      {action}
    </div>
  )
}

export function DataTableError({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive-soft text-destructive">
        <AlertIcon size={22} />
      </span>
      <div className="space-y-1">
        <p className="font-medium">{t('common.error')}</p>
        <p className="text-sm text-muted-foreground">{t('common.errorHint')}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      ) : null}
    </div>
  )
}
