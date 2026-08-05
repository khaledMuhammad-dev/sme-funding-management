import type { CellData, ColumnDef, RowData, TableFeatures } from '@tanstack/react-table'
import type { appFeatures } from './table-hook'

/**
 * Column metadata used by the shared table parts.
 * `label` feeds the column-visibility menu; `width` and `align` are applied by
 * `DataTable`, so column defs never carry presentation classes themselves.
 */
declare module '@tanstack/table-core' {
  interface ColumnMeta<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
    TValue extends CellData = CellData,
  > {
    label?: string
    width?: number
    align?: 'start' | 'end'
  }
}

/** A column definition bound to this app's feature set. */
export type AppColumnDef<TData extends RowData> = ColumnDef<typeof appFeatures, TData, any>
