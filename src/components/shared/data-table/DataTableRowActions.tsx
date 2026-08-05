import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export interface RowAction<TData> {
  key: string
  label: string
  icon?: ReactNode
  onSelect: (row: TData) => void
  /** Renders in destructive colours and below a separator. */
  destructive?: boolean
  disabled?: (row: TData) => boolean
  hidden?: (row: TData) => boolean
}

export interface DataTableRowActionsProps<TData> {
  row: TData
  actions: RowAction<TData>[]
  label?: string
  align?: 'start' | 'end'
}

/**
 * The row action menu.
 *
 * Standalone by design: give it any object and a list of actions. Used inside
 * the table's actions column, and also on cards and detail headers where the
 * same set of row operations must appear.
 */
export function DataTableRowActions<TData>({
  row,
  actions,
  label,
  align = 'end',
}: DataTableRowActionsProps<TData>) {
  const { t } = useTranslation()

  const visible = actions.filter((a) => !a.hidden?.(row))
  if (visible.length === 0) return null

  const regular = visible.filter((a) => !a.destructive)
  const destructive = visible.filter((a) => a.destructive)

  const renderItem = (action: RowAction<TData>) => (
    <DropdownMenuItem
      key={action.key}
      disabled={action.disabled?.(row)}
      onSelect={() => action.onSelect(row)}
      className={cn('gap-2', action.destructive && 'text-destructive focus:text-destructive')}
    >
      {action.icon}
      {action.label}
    </DropdownMenuItem>
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 data-[state=open]:bg-accent"
          aria-label={t('common.openMenu')}
        >
          {/* Three dots — a glyph, not an icon that needs to morph. */}
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="3" r="1.5" fill="currentColor" />
            <circle cx="8" cy="8" r="1.5" fill="currentColor" />
            <circle cx="8" cy="13" r="1.5" fill="currentColor" />
          </svg>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align={align} className="w-48">
        <DropdownMenuLabel>{label ?? t('common.actions')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {regular.map(renderItem)}
        {destructive.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            {destructive.map(renderItem)}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
