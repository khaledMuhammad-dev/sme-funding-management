import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export interface DataTableColumnHeaderProps {
  title: string
  sorted: false | 'asc' | 'desc'
  canSort: boolean
  onSort: (direction: 'asc' | 'desc') => void
  onClearSort: () => void
  align?: 'start' | 'end'
  className?: string
}

function SortGlyph({ direction }: { direction: false | 'asc' | 'desc' }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('shrink-0 transition-opacity', direction ? 'opacity-100' : 'opacity-40')}
    >
      {direction === 'asc' ? (
        <path d="M12 19V5m-6 6 6-6 6 6" />
      ) : direction === 'desc' ? (
        <path d="M12 5v14m6-6-6 6-6-6" />
      ) : (
        <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />
      )}
    </svg>
  )
}

/**
 * Sortable column header.
 *
 * Standalone by design: it reports the current direction and calls back — the
 * DataTable wires it to the column API, but a hand-rolled table can use it too.
 */
export function DataTableColumnHeader({
  title,
  sorted,
  canSort,
  onSort,
  onClearSort,
  align = 'start',
  className,
}: DataTableColumnHeaderProps) {
  const { t } = useTranslation()

  if (!canSort) {
    return (
      <span className={cn('block truncate', align === 'end' && 'text-end', className)}>
        {title}
      </span>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/*
          No `aria-sort` here — it belongs on the `columnheader` (the <th>),
          which DataTable sets. On a button it is simply ignored.
        */}
        <button
          type="button"
          className={cn(
            '-mx-2 flex items-center gap-1.5 rounded-md px-2 py-1 text-inherit hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent',
            align === 'end' && 'ms-auto',
            className,
          )}
        >
          <span className="truncate">{title}</span>
          <SortGlyph direction={sorted} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-40">
        <DropdownMenuItem onSelect={() => onSort('asc')} className="gap-2">
          <SortGlyph direction="asc" />
          {t('table.sortAsc')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSort('desc')} className="gap-2">
          <SortGlyph direction="desc" />
          {t('table.sortDesc')}
        </DropdownMenuItem>
        {sorted ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onClearSort}>{t('table.clearSort')}</DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
