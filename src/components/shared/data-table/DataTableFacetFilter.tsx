import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { PlusIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

export interface FacetOption<T extends string = string> {
  value: T
  label: string
  count?: number
}

export interface DataTableFacetFilterProps<T extends string = string> {
  title: string
  options: FacetOption<T>[]
  selected: T[]
  onChange: (values: T[]) => void
  className?: string
}

/**
 * Multi-select facet filter in a popover.
 *
 * Standalone by design: it works from a plain `selected`/`onChange` pair, so the
 * same control drives a table, a chart's series filter, or a kanban board.
 */
export function DataTableFacetFilter<T extends string = string>({
  title,
  options,
  selected,
  onChange,
  className,
}: DataTableFacetFilterProps<T>) {
  const { t } = useTranslation()
  const selectedSet = new Set(selected)

  const toggle = (value: T) => {
    const next = new Set(selectedSet)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    onChange([...next])
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn('h-10 border-dashed', className)}>
          <PlusIcon size={15} />
          {title}
          {selected.length > 0 ? (
            <>
              <Separator orientation="vertical" className="mx-1 h-4" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal tabular">
                {selected.length}
              </Badge>
            </>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-56 p-0">
        <div className="max-h-72 overflow-y-auto p-1">
          {options.map((option) => {
            const checked = selectedSet.has(option.value)
            return (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <Checkbox checked={checked} onCheckedChange={() => toggle(option.value)} />
                <span className="flex-1 truncate">{option.label}</span>
                {option.count !== undefined ? (
                  <span className="tabular text-xs text-muted-foreground">{option.count}</span>
                ) : null}
              </label>
            )
          })}
        </div>

        {selected.length > 0 ? (
          <>
            <Separator />
            <div className="p-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center text-xs"
                onClick={() => onChange([])}
              >
                {t('common.clear')}
              </Button>
            </div>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
