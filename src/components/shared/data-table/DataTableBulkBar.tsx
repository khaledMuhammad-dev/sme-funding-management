import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { XIcon } from '@/components/icons'

export interface BulkAction<TData> {
  key: string
  label: string
  icon?: ReactNode
  onSelect: (rows: TData[]) => void
  destructive?: boolean
  disabled?: (rows: TData[]) => boolean
}

export interface DataTableBulkBarProps<TData> {
  selected: TData[]
  total: number
  actions: BulkAction<TData>[]
  onClear: () => void
}

/**
 * The floating bulk-action bar.
 *
 * Standalone by design: it only needs the selected rows and the actions, so it
 * also sits under card grids and the interview board where selection exists
 * without a table.
 */
export function DataTableBulkBar<TData>({
  selected,
  total,
  actions,
  onClear,
}: DataTableBulkBarProps<TData>) {
  const { t } = useTranslation()
  const count = selected.length

  return (
    <AnimatePresence>
      {count > 0 ? (
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4"
          role="status"
          aria-live="polite"
        >
          <div className="pointer-events-auto flex max-w-full items-center gap-2 overflow-x-auto rounded-2xl border border-border bg-popover p-2 ps-4 shadow-soft-lg">
            <span className="whitespace-nowrap text-sm font-medium tabular">
              {t('table.rowsSelected', { count, total })}
            </span>

            <Separator orientation="vertical" className="mx-1 h-6" />

            {actions.map((action) => (
              <Button
                key={action.key}
                size="sm"
                variant={action.destructive ? 'destructive' : 'secondary'}
                disabled={action.disabled?.(selected)}
                onClick={() => action.onSelect(selected)}
                className="whitespace-nowrap"
              >
                {action.icon}
                {action.label}
              </Button>
            ))}

            <Separator orientation="vertical" className="mx-1 h-6" />

            <Button
              size="icon"
              variant="ghost"
              onClick={onClear}
              aria-label={t('table.clearSelection')}
              className="size-8 shrink-0"
            >
              <XIcon size={15} />
            </Button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
