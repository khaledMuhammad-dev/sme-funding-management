import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { BellIcon } from '@/components/icons'
import { PhonePreviewDialog } from '@/features/notifications/PhonePreviewDialog'
import { useBellRing } from '@/features/notifications/useBellRing'
import type { AppNotification } from '@/data/types'
import { useApplicationsByRefs, useNotificationsForMany } from '@/lib/api'
import { useApplicantStore } from '@/stores/useApplicantStore'
import { useUiStore } from '@/stores/useUiStore'
import { formatRelative } from '@/lib/format'
import { newestFirst } from '@/lib/sort'
import { ROUTES } from '@/app/routes'

const CHANNEL_CLASS: Record<string, string> = {
  sms: 'bg-info-soft text-info',
  whatsapp: 'bg-success-soft text-success',
  email: 'bg-terracotta-soft text-terracotta-ink',
}

/**
 * The signed-in applicant's bell.
 *
 * The portal presents one person throughout, so this never asks who is holding
 * the browser. Which messages it shows is still resolved from the references the
 * portal knows about — submitted through the wizard, or looked up on `/track` —
 * but that is plumbing: with nothing submitted yet the bell simply says there
 * are no messages, and points at applying or tracking.
 *
 * Read state lives in `useApplicantStore`, not in the demo database: this is his
 * copy of messages that really went out by SMS / WhatsApp / email, and clicking
 * one opens the same phone frame the staff see, which is the point — the bell is
 * the in-app mirror of a message he already has on his phone.
 */
export function PortalNotificationBell() {
  const { t } = useTranslation()
  const lang = useUiStore((s) => s.lang)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<AppNotification | null>(null)

  const refs = useApplicantStore((s) => s.refs)
  const readIds = useApplicantStore((s) => s.readIds)
  const markRead = useApplicantStore((s) => s.markRead)

  /*
    Every one of his applications, not just the active one: an applicant with two
    files in flight would otherwise see a badge for whichever he happened to open
    last, and silently miss messages about the other.
  */
  const { data: rows = [] } = useApplicationsByRefs(refs)
  const resolved = rows.filter((row) => row.application)
  const byId = new Map(resolved.map((row) => [row.application!.id, row.application!]))
  const { data: notifications = [] } = useNotificationsForMany([...byId.keys()])

  const recent = [...notifications].sort(newestFirst((n) => n.sentAt))
  const unread = recent.filter((n) => !readIds.includes(n.id))
  const ringing = useBellRing(recent[0]?.id)

  /*
    Whether there is anything to show yet — not "do we know who this is". The
    bell is always in the header either way; before the first application it
    explains where messages will arrive instead of showing a dead icon.

    `application` can be missing for a known ref after a reload, because the demo
    database lives in memory: the ref is real, the record is gone.
  */
  const identified = resolved.length > 0

  /** Opens one message's own application — messages from several now interleave. */
  const openRef = (applicationRef?: string) => {
    setOpen(false)
    navigate(applicationRef ? `${ROUTES.track}?ref=${applicationRef}` : ROUTES.track)
  }

  const openTrack = () => openRef(resolved[0]?.application?.ref)

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={t('notifications.portal.title')}
            data-testid="portal-notification-bell"
            data-identified={identified ? 'true' : 'false'}
            data-unread={unread.length}
            data-ringing={ringing ? 'true' : 'false'}
          >
            {/* The bell rings itself: body and clapper swing against each other. */}
            <BellIcon active={unread.length > 0} ringing={ringing} size={18} />

            {unread.length > 0 ? (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                data-testid="portal-notification-badge"
                className="absolute -top-0.5 -end-0.5 flex min-w-4 items-center justify-center rounded-full bg-terracotta px-1 text-[10px] font-bold text-terracotta-foreground tabular"
              >
                {unread.length > 9 ? '9+' : unread.length}
              </motion.span>
            ) : null}
          </Button>
        </PopoverTrigger>

        <PopoverContent align="end" className="w-[22rem] p-0" data-testid="portal-notification-center">
          <div className="flex items-start justify-between gap-2 px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">{t('notifications.portal.title')}</h2>
              {identified ? (
                <p className="truncate text-xs text-muted-foreground tabular" dir="ltr">
                  {resolved.length === 1
                    ? resolved[0].application!.ref
                    : t('notifications.portal.acrossApplications', { count: resolved.length })}
                </p>
              ) : null}
            </div>
            {identified && unread.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 text-xs"
                data-testid="portal-notification-mark-read"
                onClick={() => markRead(recent.map((n) => n.id))}
              >
                {t('notifications.markAllRead')}
              </Button>
            ) : null}
          </div>
          <Separator />

          {!identified ? (
            <div
              className="space-y-1 px-4 py-6 text-center"
              data-testid="portal-notification-anonymous"
            >
              <p className="text-sm font-medium">{t('notifications.portal.emptyTitle')}</p>
              <p className="text-xs text-muted-foreground">{t('notifications.portal.emptyHint')}</p>
            </div>
          ) : recent.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {t('track.noNotifications')}
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto" data-testid="portal-notification-list">
              {recent.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    data-testid="portal-notification-item"
                    data-trigger={notification.trigger}
                    data-channel={notification.channel}
                    data-read={readIds.includes(notification.id) ? 'true' : 'false'}
                    data-ref={byId.get(notification.applicationId)?.ref}
                    onClick={() => {
                      setPreview(notification)
                      markRead([notification.id])
                    }}
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
                      {/* Which file this is about — only meaningful once there are several. */}
                      {resolved.length > 1 ? (
                        <p className="truncate text-[11px] text-muted-foreground tabular" dir="ltr">
                          {byId.get(notification.applicationId)?.ref}
                        </p>
                      ) : null}
                    </div>
                    {!readIds.includes(notification.id) ? (
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-terracotta" />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Separator />
          <div className="flex flex-col gap-1 p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              data-testid="portal-notification-open"
              onClick={openTrack}
            >
              {identified ? t('notifications.portal.open') : t('notifications.portal.trackCta')}
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
