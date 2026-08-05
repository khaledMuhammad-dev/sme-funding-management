import { type ReactNode, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { RowData } from '@tanstack/react-table'
import type { AppColumnDef } from './types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useAppTable } from './table-hook'
import { DataTableToolbar } from './DataTableToolbar'
import { DataTablePagination } from './DataTablePagination'
import { DataTableBulkBar, type BulkAction } from './DataTableBulkBar'
import { DataTableEmpty, DataTableError, DataTableSkeletonRows } from './DataTableStates'

export interface DataTableProps<TData extends RowData> {
  columns: AppColumnDef<TData>[]
  data: TData[]
  getRowId: (row: TData) => string

  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void

  /** Toolbar */
  searchPlaceholder?: string
  filters?: ReactNode
  toolbarActions?: ReactNode
  isFiltered?: boolean
  onResetFilters?: () => void
  hideToolbar?: boolean

  /** Selection */
  bulkActions?: BulkAction<TData>[]

  /** Row interaction */
  onRowClick?: (row: TData) => void

  /** Empty state */
  emptyTitle?: string
  emptyHint?: string
  emptyIcon?: ReactNode
  emptyAction?: ReactNode

  initialPageSize?: number
  className?: string
}

/**
 * The composed table.
 *
 * This file owns *assembly only* — the toolbar, search, filters, column
 * options, selection bar and pagination are each independent components that
 * work without it. Pages that need something the composition doesn't do can
 * import the parts directly instead of adding props here.
 */
export function DataTable<TData extends RowData>({
  columns,
  data,
  getRowId,
  isLoading,
  isError,
  onRetry,
  searchPlaceholder,
  filters,
  toolbarActions,
  isFiltered,
  onResetFilters,
  hideToolbar,
  bulkActions,
  onRowClick,
  emptyTitle,
  emptyHint,
  emptyIcon,
  emptyAction,
  initialPageSize = 10,
  className,
}: DataTableProps<TData>) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')

  const table = useAppTable<TData>({
    columns,
    data,
    getRowId,
    enableRowSelection: Boolean(bulkActions?.length),
    initialState: { pagination: { pageIndex: 0, pageSize: initialPageSize } },
    // Supplying `onGlobalFilterChange` hands the state to us: without the
    // matching `state.globalFilter` the table never sees a search term and the
    // field filters nothing.
    state: { globalFilter: search },
    onGlobalFilterChange: setSearch,
    globalFilterFn: 'includesString',
  })

  // Global filter is driven from our own state so the toolbar stays reusable.
  const state = table.state
  const pagination = state.pagination ?? { pageIndex: 0, pageSize: initialPageSize }

  // Derived every render on purpose: memoising it would go stale the moment a
  // column's visibility changed, since the flag lives on the column instance.
  const toggleableColumns = table.getAllColumns().map((column) => ({
    id: column.id,
    label: column.columnDef.meta?.label ?? column.id,
    visible: column.getIsVisible(),
    canHide: column.getCanHide(),
  }))

  // The actions column renders the visibility menu in its own header, so the
  // toolbar must not show a second one.
  const hasActionsColumn = columns.some((column) => column.id === 'actions')

  const selectedRows = table.getFilteredSelectedRowModel().rows.map((row) => row.original)
  const rows = table.getRowModel().rows
  const columnCount = table.getAllLeafColumns().filter((c) => c.getIsVisible()).length

  const showEmpty = !isLoading && !isError && rows.length === 0

  return (
    <div className={cn('overflow-hidden rounded-xl border border-border bg-card shadow-soft-sm', className)}>
      {hideToolbar ? null : (
        <DataTableToolbar
          search={search}
          onSearchChange={(value) => {
            table.setGlobalFilter(value)
            table.setPageIndex(0)
          }}
          searchPlaceholder={searchPlaceholder}
          filters={filters}
          actions={toolbarActions}
          columns={hasActionsColumn ? undefined : toggleableColumns}
          onToggleColumn={
            hasActionsColumn
              ? undefined
              : (id, visible) => table.getColumn(id)?.toggleVisibility(visible)
          }
          isFiltered={isFiltered || search.length > 0}
          onResetFilters={() => {
            table.setGlobalFilter('')
            onResetFilters?.()
          }}
        />
      )}

      <div className="overflow-x-auto border-t border-border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={
                      header.column.columnDef.meta?.width
                        ? { width: header.column.columnDef.meta.width }
                        : undefined
                    }
                    /*
                      `aria-sort` is only meaningful on the column header itself.
                      It used to sit on the sort <button> inside, where the role
                      is `button`, not `columnheader` — so assistive tech dropped
                      it and the sort direction was never announced.
                    */
                    aria-sort={
                      header.column.getCanSort()
                        ? header.column.getIsSorted() === 'asc'
                          ? 'ascending'
                          : header.column.getIsSorted() === 'desc'
                            ? 'descending'
                            : 'none'
                        : undefined
                    }
                    className="h-11 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {isLoading ? (
              /*
                The skeleton must be as tall as the page it stands in for. It
                used to draw 6 rows while the first page renders 10, so every
                table grew by four rows (~230px) the moment the data landed.
              */
              <DataTableSkeletonRows columns={columnCount} rows={Math.min(initialPageSize, 10)} />
            ) : isError || showEmpty ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columnCount} className="p-0">
                  {isError ? (
                    <DataTableError onRetry={onRetry} />
                  ) : (
                    <DataTableEmpty
                      title={emptyTitle}
                      hint={emptyHint}
                      icon={emptyIcon}
                      action={emptyAction}
                    />
                  )}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <motion.tr
                  key={row.id}
                  // Stagger only on first paint — re-sorting must not re-animate.
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: Math.min(index * 0.02, 0.2) }}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    'border-b border-border transition-colors last:border-0 hover:bg-accent data-[state=selected]:bg-primary-soft',
                    onRowClick && 'cursor-pointer',
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3">
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </motion.tr>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/*
        The footer is ~57px tall and only existed once rows had loaded, so every
        table grew by a footer's height when the simulated read resolved and the
        page visibly jumped. A placeholder of the same shape holds the space.
      */}
      {isLoading ? (
        <div
          aria-hidden="true"
          className="flex flex-col gap-4 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-56" />
        </div>
      ) : null}

      {!isLoading && !isError && rows.length > 0 ? (
        <DataTablePagination
          pageIndex={pagination.pageIndex}
          pageCount={table.getPageCount()}
          pageSize={pagination.pageSize}
          totalRows={table.getFilteredRowModel().rows.length}
          onPageChange={(index) => table.setPageIndex(index)}
          onPageSizeChange={(size) => {
            table.setPageSize(size)
            table.setPageIndex(0)
          }}
        />
      ) : null}

      {bulkActions?.length ? (
        <DataTableBulkBar
          selected={selectedRows}
          total={table.getFilteredRowModel().rows.length}
          actions={bulkActions}
          onClear={() => table.resetRowSelection()}
        />
      ) : null}

      {/* Announces result count to assistive tech after filtering. */}
      <span className="sr-only" role="status" aria-live="polite">
        {t('table.showing', {
          from: rows.length === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1,
          to: Math.min(
            table.getFilteredRowModel().rows.length,
            (pagination.pageIndex + 1) * pagination.pageSize,
          ),
          total: table.getFilteredRowModel().rows.length,
        })}
      </span>
    </div>
  )
}
