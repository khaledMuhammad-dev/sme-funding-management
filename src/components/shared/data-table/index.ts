/**
 * The table system.
 *
 * `DataTable` is the assembled default, but every part below stands on its own
 * and is used outside the table elsewhere in the app — the toolbar sits above
 * the interview board, the bulk bar drives the disbursement queue's card view,
 * the pagination runs the notification feed.
 */
export { DataTable, type DataTableProps } from './DataTable'
export { DataTableToolbar, type DataTableToolbarProps } from './DataTableToolbar'
export { DataTableSearch, type DataTableSearchProps } from './DataTableSearch'
export {
  DataTableFacetFilter,
  type DataTableFacetFilterProps,
  type FacetOption,
} from './DataTableFacetFilter'
export { DataTableViewOptions, type ToggleableColumn } from './DataTableViewOptions'
export { DataTableColumnHeader } from './DataTableColumnHeader'
export { DataTableRowActions, type RowAction } from './DataTableRowActions'
export { DataTableBulkBar, type BulkAction } from './DataTableBulkBar'
export { DataTablePagination, type DataTablePaginationProps } from './DataTablePagination'
export { DataTableEmpty, DataTableError, DataTableSkeletonRows } from './DataTableStates'
export { selectColumn, actionsColumn, sortableHeader, NumericCell } from './columns'
export { useAppTable, createAppColumnHelper } from './table-hook'
export type { AppColumnDef } from './types'
