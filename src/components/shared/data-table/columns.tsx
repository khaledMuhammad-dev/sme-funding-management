import type { ReactNode } from 'react'
import type { RowData } from '@tanstack/react-table'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from './DataTableColumnHeader'
import { DataTableRowActions, type RowAction } from './DataTableRowActions'
import { DataTableViewOptions } from './DataTableViewOptions'
import { createAppColumnHelper } from './table-hook'

/**
 * Column factories.
 *
 * A table's columns are assembled from these rather than hand-written, so the
 * checkbox column, the actions column and every sortable header behave
 * identically on every screen.
 */

/** Checkbox column — select-all in the header, select-row in each cell. */
export function selectColumn<TData extends RowData>(labels: { selectAll: string; selectRow: string }) {
  const helper = createAppColumnHelper<TData>()

  return helper.display({
    id: 'select',
    meta: { width: 44 },
    enableSorting: false,
    enableHiding: false,
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected()
            ? true
            : table.getIsSomePageRowsSelected()
              ? 'indeterminate'
              : false
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(value === true)}
        aria-label={labels.selectAll}
        className="translate-y-[1px]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(value === true)}
        aria-label={labels.selectRow}
        className="translate-y-[1px]"
        // Selecting a row must not also open it.
        onClick={(event) => event.stopPropagation()}
      />
    ),
  })
}

/**
 * Row action menu column, pinned to the trailing edge.
 *
 * Its header carries the column visibility menu — the one control that belongs
 * to the table itself rather than to any row.
 */
export function actionsColumn<TData extends RowData>(actions: RowAction<TData>[], label?: string) {
  const helper = createAppColumnHelper<TData>()

  return helper.display({
    id: 'actions',
    meta: { width: 60 },
    enableSorting: false,
    enableHiding: false,
    header: ({ table }) => (
      <div className="flex justify-end">
        <DataTableViewOptions
          columns={table.getAllColumns().map((column) => ({
            id: column.id,
            label: column.columnDef.meta?.label ?? column.id,
            visible: column.getIsVisible(),
            canHide: column.getCanHide(),
          }))}
          onToggle={(id, visible) => table.getColumn(id)?.toggleVisibility(visible)}
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
        <DataTableRowActions row={row.original} actions={actions} label={label} />
      </div>
    ),
  })
}

/**
 * Wraps a plain title in the sortable header control.
 * `header: sortableHeader('Amount')` is all a column needs to become sortable.
 */
export function sortableHeader(title: string, align: 'start' | 'end' = 'start') {
  return function Header({ column }: { column: any }) {
    return (
      <DataTableColumnHeader
        title={title}
        align={align}
        canSort={column.getCanSort()}
        sorted={column.getIsSorted()}
        onSort={(direction) => column.toggleSorting(direction === 'desc')}
        onClearSort={() => column.clearSorting()}
      />
    )
  }
}

/** Right-aligned numeric cell wrapper — keeps digits on the tabular figure set. */
export function NumericCell({ children }: { children: ReactNode }) {
  return <span className="block text-end tabular">{children}</span>
}
