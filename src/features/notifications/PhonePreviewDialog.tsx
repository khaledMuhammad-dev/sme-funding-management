import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { NotificationChannel } from '@/data/types'
import { cn } from '@/lib/utils'

export interface PhonePreviewDialogProps {
  open: boolean
  onClose: () => void
  /** Rendered message body, already localised and interpolated by the caller. */
  body: string
  /** Channels the viewer can switch between; the first one opens selected. */
  channels: NotificationChannel[]
  /** Optional label for what fired the message. */
  triggerLabel?: string
}

/**
 * WhatsApp bubbles are green and right-aligned in the real client, SMS bubbles
 * are grey, email is a card with a subject line — the frame only sells the
 * automation if the message looks like the app it would land in.
 */
const BUBBLE_CLASS: Record<NotificationChannel, string> = {
  sms: 'bg-muted text-foreground rounded-ss-sm',
  whatsapp: 'bg-success-soft text-success rounded-se-sm',
  email: 'bg-card text-foreground rounded-ss-sm border border-border',
}

/** Phone frame so the client sees the message the way the applicant will. */
export function PhonePreviewDialog({
  open,
  onClose,
  body,
  channels,
  triggerLabel,
}: PhonePreviewDialogProps) {
  const { t } = useTranslation()
  const available = channels.length > 0 ? channels : (['sms'] as NotificationChannel[])
  const [selected, setChannel] = useState<NotificationChannel>(available[0])

  // Reopening for a different message must not keep a channel that one does not
  // go out on — derived rather than synced, so there is no stale-state window.
  const channel = available.includes(selected) ? selected : available[0]

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-sm [&>*]:min-w-0" data-testid="phone-preview">
        <DialogHeader>
          <DialogTitle>{t('notifications.preview.title')}</DialogTitle>
        </DialogHeader>

        {available.length > 1 ? (
          <div className="flex justify-center gap-2" role="group">
            {available.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setChannel(option)}
                aria-pressed={option === channel}
                data-testid={`phone-preview-channel-${option}`}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  option === channel
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70',
                )}
              >
                {t(`notifications.channels.${option}`)}
              </button>
            ))}
          </div>
        ) : null}

        <div
          className="mx-auto w-full max-w-[17rem] rounded-[2rem] border-8 border-primary bg-background p-3 shadow-soft-lg"
          data-channel={channel}
        >
          <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-primary/40" />
          <div className="min-h-56 space-y-2 rounded-xl bg-muted/60 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t(`notifications.channels.${channel}`)} · {t('common.appShort')}
            </p>

            {channel === 'email' ? (
              <p className="text-xs font-semibold">{triggerLabel ?? t('notifications.title')}</p>
            ) : null}

            <motion.div
              key={`${channel}-${body}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              data-testid="phone-preview-body"
              className={cn(
                'rounded-xl p-3 text-sm leading-relaxed shadow-soft-sm',
                BUBBLE_CLASS[channel],
              )}
            >
              {body}
            </motion.div>

            <p className="text-end text-[10px] text-muted-foreground">
              {t('notifications.preview.now')} · {t('notifications.simulated')}
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {t('notifications.preview.description')}
        </p>
      </DialogContent>
    </Dialog>
  )
}
