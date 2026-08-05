import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { BellIcon } from '@/components/icons'
import { EmptyState } from '@/components/shared'
import { PhonePreviewDialog } from '@/features/notifications/PhonePreviewDialog'
import { useBellRing } from '@/features/notifications/useBellRing'
import type { AppNotification } from '@/data/types'
import { useMarkNotificationsRead, useNotifications } from '@/lib/api'
import { useUiStore } from '@/stores/useUiStore'
import { formatRelative } from '@/lib/format'
import { newestFirst } from '@/lib/sort'
import { ROUTES } from './routes'

const CHANNEL_CLASS: Record<string, string> = {
  sms: 'bg-info-soft text-info',
  whatsapp: 'bg-success-soft text-success',
  email: 'bg-terracotta-soft text-terracotta-ink',
}

/** Header bell + notification centre. The bell rings while anything is unread. */
export function NotificationBell() {
  const { t } = useTranslation()
  const lang = useUiStore((s) => s.lang)
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<AppNotification | null>(null)
  const { data: notifications = [] } = useNotifications()
  const markAllRead = useMarkNotificationsRead()

  const unread = notifications.filter((n) => !n.read)
  // The store prepends, but the seeded rows carry their own timestamps — sorting
  // here is what guarantees "newest first" regardless of where a row came from.
  const recent = [...notifications].sort(newestFirst((n) => n.sentAt)).slice(0, 8)

  const ringing = useBellRing(recent[0]?.id)

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={t('nav.notifications')}
            data-testid="notification-bell"
            data-unread={unread.length}
            data-ringing={ringing ? 'true' : 'false'}
          >
            {/* Morphs to the ringing shape whenever something is unread. */}
            {/* The bell rings itself: body and clapper swing against each other. */}
            <BellIcon active={unread.length > 0} ringing={ringing} size={18} />

            {unread.length > 0 ? (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                data-testid="notification-badge"
                className="absolute -top-0.5 -end-0.5 flex min-w-4 items-center justify-center rounded-full bg-terracotta px-1 text-[10px] font-bold text-terracotta-foreground tabular"
              >
                {unread.length > 9 ? '9+' : unread.length}
              </motion.span>
            ) : null}
          </Button>
        </PopoverTrigger>

        <PopoverContent align="end" className="w-[22rem] p-0" data-testid="notification-center">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="text-sm font-semibold">{t('notifications.title')}</h2>
            {unread.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                disabled={markAllRead.isPending}
                onClick={() => markAllRead.mutate()}
              >
                {t('notifications.markAllRead')}
              </Button>
            ) : null}
          </div>
          <Separator />

          {recent.length === 0 ? (
            <EmptyState title={t('notifications.empty')} hint={t('notifications.emptyHint')} />
          ) : (
            <ul className="max-h-96 overflow-y-auto" data-testid="notification-list">
              {recent.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    data-testid="notification-item"
                    data-trigger={notification.trigger}
                    data-channel={notification.channel}
                    onClick={() => setPreview(notification)}
                    className="flex w-full gap-3 border-b border-border px-4 py-3 text-start last:border-0 hover:bg-muted/60"
                  >
                    <span
                      className={`mt-0.5 flex h-fit shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${CHANNEL_CLASS[notification.channel]}`}
                    >
                      {t(`notifications.channels.${notification.channel}`)}
                    </span>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm leading-snug">
                        {lang === 'ar' ? notification.body : notification.bodyEn}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(`notifications.triggers.${notification.trigger}`)} ·{' '}
                        {formatRelative(notification.sentAt, lang)}
                      </p>
                    </div>
                    {!notification.read ? (
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-terracotta" />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Separator />
          <div className="p-2">
            <Button asChild variant="ghost" size="sm" className="w-full">
              <Link to={ROUTES.settings} onClick={() => setOpen(false)}>
                {t('settings.channelsTitle')}
              </Link>
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <PhonePreviewDialog
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        body={preview ? (lang === 'ar' ? preview.body : preview.bodyEn) : ''}
        channels={preview ? [preview.channel] : []}
        triggerLabel={preview ? t(`notifications.triggers.${preview.trigger}`) : undefined}
      />
    </>
  )
}
