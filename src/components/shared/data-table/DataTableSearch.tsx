import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { SearchIcon, XIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

export interface DataTableSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Debounce in ms — set to 0 for controlled parents that already debounce. */
  debounceMs?: number
  className?: string
}

/**
 * Debounced search field.
 *
 * Standalone by design: it takes a value and a setter, not a table instance, so
 * the same control filters a card grid, a sheet list, or a DataTable.
 */
export function DataTableSearch({
  value,
  onChange,
  placeholder,
  debounceMs = 250,
  className,
}: DataTableSearchProps) {
  const { t } = useTranslation()
  const [local, setLocal] = useState(value)

  // Keep in step when the parent clears the filter from elsewhere.
  useEffect(() => setLocal(value), [value])

  useEffect(() => {
    if (local === value) return
    const timer = setTimeout(() => onChange(local), debounceMs)
    return () => clearTimeout(timer)
  }, [local, value, onChange, debounceMs])

  return (
    <div className={cn('relative', className)}>
      <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-muted-foreground">
        <SearchIcon size={16} />
      </span>
      <Input
        type="search"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder ?? t('common.searchPlaceholder')}
        aria-label={t('common.search')}
        className="h-10 ps-9 pe-9"
      />
      {local ? (
        <button
          type="button"
          onClick={() => setLocal('')}
          aria-label={t('common.clear')}
          className="absolute inset-y-0 end-0 flex items-center pe-3 text-muted-foreground hover:text-foreground"
        >
          <XIcon size={15} />
        </button>
      ) : null}
    </div>
  )
}
