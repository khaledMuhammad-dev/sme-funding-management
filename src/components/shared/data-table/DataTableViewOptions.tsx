import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { PlusIcon } from '@/components/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface ToggleableColumn {
  id: string
  label: string
  visible: boolean
  canHide: boolean
}

export interface DataTableViewOptionsProps {
  columns: ToggleableColumn[]
  onToggle: (id: string, visible: boolean) => void
}

/**
 * Column visibility menu.
 *
 * Standalone by design: a list of `{id, label, visible}` in, a toggle callback
 * out. Nothing about it knows what a TanStack column is.
 */
export function DataTableViewOptions({ columns, onToggle }: DataTableViewOptionsProps) {
  const { t } = useTranslation()
  const hideable = columns.filter((c) => c.canHide)
  if (hideable.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 data-[state=open]:bg-accent"
          aria-label={t('table.columns')}
          title={t('table.columns')}
        >
          <PlusIcon size={16} />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{t('table.toggleColumns')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-72 overflow-y-auto p-1">
          {hideable.map((column) => (
            <label
              key={column.id}
              className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <Checkbox
                checked={column.visible}
                onCheckedChange={(checked) => onToggle(column.id, checked === true)}
              />
              <span className="truncate">{column.label}</span>
            </label>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
