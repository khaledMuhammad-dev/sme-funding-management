import type { RowData } from '@tanstack/react-table'
import {
  columnFacetingFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  createCoreRowModel,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  createTableHook,
  filterFns,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from '@tanstack/react-table'

/**
 * The one table configuration in the app. Every DataTable — and every table-ish
 * surface that only wants a slice of the behaviour — is built on this hook, so
 * features, row models and filter/sort functions can never drift between screens.
 */
export const { useAppTable, createAppColumnHelper, appFeatures } = createTableHook({
  features: tableFeatures({
    columnFacetingFeature,
    columnFilteringFeature,
    columnVisibilityFeature,
    globalFilteringFeature,
    rowPaginationFeature,
    rowSelectionFeature,
    rowSortingFeature,
    coreRowModel: createCoreRowModel(),
    filteredRowModel: createFilteredRowModel(),
    sortedRowModel: createSortedRowModel(),
    paginatedRowModel: createPaginatedRowModel(),
    facetedRowModel: createFacetedRowModel(),
    facetedUniqueValues: createFacetedUniqueValues(),
    filterFns,
    sortFns,
  }),
  tableComponents: {},
  cellComponents: {},
  headerComponents: {},
})

export type AppTable<TData extends RowData> = ReturnType<typeof useAppTable<TData>>
