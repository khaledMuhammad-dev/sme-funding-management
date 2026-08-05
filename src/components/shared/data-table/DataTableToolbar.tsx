import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { XIcon } from '@/components/icons'
import { DataTableSearch } from './DataTableSearch'
import { DataTableViewOptions, type ToggleableColumn } from './DataTableViewOptions'

export interface DataTableToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  /** Facet filters and any other controls, rendered between search and options. */
  filters?: ReactNode
  /** Buttons pinned to the trailing edge (export, create, …). */
  actions?: ReactNode
  columns?: ToggleableColumn[]
  onToggleColumn?: (id: string, visible: boolean) => void
  /** Shown only when something is actually filtered. */
  isFiltered?: boolean
  onResetFilters?: () => void
}

/**
 * The toolbar row: search · filters · reset · column options · actions.
 *
 * Standalone by design: it composes the other micro-components and takes plain
 * values, so a page can drop it above a card grid with no table underneath.
 */
export function DataTableToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  filters,
  actions,
  columns,
  onToggleColumn,
  isFiltered,
  onResetFilters,
}: DataTableToolbarProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <DataTableSearch
          value={search}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          className="w-full min-w-[12rem] sm:w-72"
        />
        {filters}
        {isFiltered && onResetFilters ? (
          <Button variant="ghost" size="sm" onClick={onResetFilters} className="h-10">
            {t('common.clearAll')}
            <XIcon size={14} />
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {columns && onToggleColumn ? (
          <DataTableViewOptions columns={columns} onToggle={onToggleColumn} />
        ) : null}
        {actions}
      </div>
    </div>
  )
}
