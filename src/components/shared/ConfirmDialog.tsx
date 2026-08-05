import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  /** Extra fields — a reason textarea, a summary block, a warning. */
  children?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  isPending?: boolean
  disabled?: boolean
  onConfirm: () => void
}

/** Every confirmation in the app routes through this, so the shape never varies. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel,
  destructive,
  isPending,
  disabled,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        DialogContent is a grid, so its items default to `min-width: auto` and a
        wide child (a day strip, a long select) can force the track past the
        dialog's max-width and spill out of the box. `[&>*]:min-w-0` caps every
        row at the dialog width so overflow becomes the child's own problem to
        solve — usually by scrolling.
      */}
      <DialogContent className="sm:max-w-lg [&>*]:min-w-0">
        <DialogHeader className="min-w-0">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        {children ? <div className="min-w-0 space-y-4 py-1">{children}</div> : null}

        <DialogFooter className="min-w-0 flex-wrap">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {cancelLabel ?? t('common.cancel')}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={disabled || isPending}
          >
            {isPending ? t('common.saving') : (confirmLabel ?? t('common.confirm'))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
