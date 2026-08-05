import { type ReactNode, useId } from 'react'
import type { FieldError } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { AlertIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

export interface FieldShellProps {
  label: string
  error?: FieldError
  hint?: string
  required?: boolean
  className?: string
  /** Receives the wiring every control needs: id, aria-invalid, aria-describedby. */
  children: (props: {
    id: string
    'aria-invalid': boolean
    'aria-describedby': string | undefined
  }) => ReactNode
}

/**
 * The form field wrapper. Every input in the app is wrapped in this, so label
 * association, the error icon and `aria-describedby` are never forgotten —
 * and the error state is signalled by icon and text, not colour alone.
 */
export function FieldShell({
  label,
  error,
  hint,
  required,
  className,
  children,
}: FieldShellProps) {
  const { t } = useTranslation()
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`

  const describedBy = error ? errorId : hint ? hintId : undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {required ? (
          <span className="text-terracotta-ink" aria-label={t('common.required')}>
            *
          </span>
        ) : (
          <span className="text-xs font-normal text-muted-foreground">
            ({t('common.optional')})
          </span>
        )}
      </Label>

      <div className={cn(error && '[&_input]:border-destructive [&_textarea]:border-destructive')}>
        {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      </div>

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-center gap-1.5 text-xs font-medium text-destructive"
        >
          <AlertIcon size={13} strokeWidth={2.2} />
          {error.message}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
