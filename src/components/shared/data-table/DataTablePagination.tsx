import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface DataTablePaginationProps {
  pageIndex: number
  pageCount: number
  pageSize: number
  totalRows: number
  onPageChange: (index: number) => void
  onPageSizeChange: (size: number) => void
  pageSizeOptions?: number[]
  className?: string
}

/** Chevron glyphs — mirrored by `rtl-flip` rather than by swapping icons. */
function Chevron({ double = false }: { double?: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="rtl-flip"
    >
      {double ? <path d="M11 5l-7 7 7 7M20 5l-7 7 7 7" /> : <path d="M15 5l-7 7 7 7" />}
    </svg>
  )
}

/**
 * Pagination controls.
 *
 * Standalone by design: plain numbers in, callbacks out — no table instance —
 * so the notification feed and the interview board paginate with the same UI.
 */
export function DataTablePagination({
  pageIndex,
  pageCount,
  pageSize,
  totalRows,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 30, 50],
  className,
}: DataTablePaginationProps) {
  const { t } = useTranslation()

  const from = totalRows === 0 ? 0 : pageIndex * pageSize + 1
  const to = Math.min(totalRows, (pageIndex + 1) * pageSize)
  const canPrev = pageIndex > 0
  const canNext = pageIndex < pageCount - 1

  return (
    <div
      className={cn(
        'flex flex-col gap-4 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p className="text-sm text-muted-foreground tabular" aria-live="polite">
        {t('table.showing', { from, to, total: totalRows })}
      </p>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {t('table.rowsPerPage')}
          </span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger size="sm" className="w-[4.5rem]" aria-label={t('table.rowsPerPage')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1">
          <span className="me-2 whitespace-nowrap text-sm font-medium tabular">
            {t('table.page', { page: pageCount === 0 ? 0 : pageIndex + 1, total: pageCount })}
          </span>

          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled={!canPrev}
            onClick={() => onPageChange(0)}
            aria-label={t('table.first')}
          >
            <Chevron double />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled={!canPrev}
            onClick={() => onPageChange(pageIndex - 1)}
            aria-label={t('table.previous')}
          >
            <Chevron />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8 rotate-180"
            disabled={!canNext}
            onClick={() => onPageChange(pageIndex + 1)}
            aria-label={t('table.next')}
          >
            <Chevron />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8 rotate-180"
            disabled={!canNext}
            onClick={() => onPageChange(pageCount - 1)}
            aria-label={t('table.last')}
          >
            <Chevron double />
          </Button>
        </div>
      </div>
    </div>
  )
}
