import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog, PageHeader, SectionCard } from '@/components/shared'
import { AlertIcon, CheckIcon } from '@/components/icons'
import { PhonePreviewDialog } from '@/features/notifications/PhonePreviewDialog'
import {
  CRITERION_KEYS,
  NOTIFICATION_TRIGGERS,
  type NotificationChannel,
  type NotificationTrigger,
} from '@/data/types'
import { renderTemplate } from '@/data/notificationTemplates'
import { SignaturePad } from '@/features/contracts/SignaturePad'
import { DEFAULT_ORG_SIGNATURE, useSettingsStore, weightsTotal } from '@/stores/useSettingsStore'
import { useUiStore } from '@/stores/useUiStore'
import { useDemoDataCounts, useResetDemoData, useSaveWeights } from '@/lib/api'
import { cn } from '@/lib/utils'

const CHANNELS: NotificationChannel[] = ['sms', 'whatsapp', 'email']

/** The demo database's tables, in lifecycle order — shown as live row counts. */
const DEMO_TABLES = [
  'applications',
  'interviews',
  'contracts',
  'disbursements',
  'followUps',
  'notifications',
] as const

/** Stand-in applicant for the template preview — no real file is involved. */
const SAMPLE_REF = 'APP-2026-0042'
const SAMPLE_NAME: Record<'ar' | 'en', string> = { ar: 'نورة', en: 'Noura' }

export default function SettingsPage() {
  const { t } = useTranslation()
  const lang = useUiStore((s) => s.lang)
  const { weights, channels, setWeight, resetWeights, toggleChannel } = useSettingsStore()
  const saveWeights = useSaveWeights()
  const [previewFor, setPreviewFor] = useState<NotificationTrigger | null>(null)

  const counts = useDemoDataCounts()
  const resetDemoData = useResetDemoData()
  const [resetMode, setResetMode] = useState<'empty' | 'seed' | null>(null)

  const previewBody = previewFor
    ? renderTemplate(previewFor, lang, { ref: SAMPLE_REF, name: SAMPLE_NAME[lang] })
    : ''

  const total = weightsTotal(weights)
  const valid = total === 100

  const handleSave = () => {
    if (!valid) return
    // Saving weights re-scores every application that has ever been scored.
    saveWeights.mutate(weights, {
      onSuccess: () => toast.success(t('settings.saved')),
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <Tabs defaultValue="scoring">
        <TabsList>
          <TabsTrigger value="scoring">{t('settings.tabs.scoring')}</TabsTrigger>
          <TabsTrigger value="notifications">{t('settings.tabs.notifications')}</TabsTrigger>
          <TabsTrigger value="signature">{t('settings.tabs.signature')}</TabsTrigger>
          <TabsTrigger value="demo-data">{t('settings.tabs.demoData')}</TabsTrigger>
        </TabsList>

        <TabsContent value="scoring" className="mt-5">
          <SectionCard
            title={t('settings.weightsTitle')}
            description={t('settings.weightsHint')}
            actions={
              <>
                <Button variant="ghost" onClick={resetWeights}>
                  {t('settings.resetDefaults')}
                </Button>
                <Button onClick={handleSave} disabled={!valid || saveWeights.isPending}>
                  {saveWeights.isPending ? t('common.saving') : t('common.save')}
                </Button>
              </>
            }
          >
            <div className="space-y-5">
              {CRITERION_KEYS.map((key) => (
                <div key={key} className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="space-y-1.5">
                    <Label htmlFor={`weight-${key}`}>{t(`scoring.criterion.${key}`)}</Label>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-300"
                        style={{ width: `${Math.min(100, weights[key])}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      id={`weight-${key}`}
                      type="number"
                      min={0}
                      max={100}
                      value={weights[key]}
                      onChange={(event) => setWeight(key, Number(event.target.value) || 0)}
                      className="w-24 tabular"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              ))}

              <div
                className={cn(
                  'flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium',
                  valid ? 'bg-success-soft text-success' : 'bg-destructive-soft text-destructive',
                )}
                role="status"
              >
                {valid ? <CheckIcon size={16} strokeWidth={2.4} /> : <AlertIcon size={16} />}
                {t('settings.weightsSum')}: <span className="tabular">{total}%</span>
                {!valid ? <span>· {t('settings.weightsInvalid')}</span> : null}
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="notifications" className="mt-5">
          <SectionCard title={t('settings.channelsTitle')} description={t('settings.channelsHint')} flush>
            <ul>
              {NOTIFICATION_TRIGGERS.map((trigger) => (
                <li
                  key={trigger}
                  className="flex flex-wrap items-center gap-4 border-b border-border px-5 py-4 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{t(`notifications.triggers.${trigger}`)}</p>
                    {/* Rendered with the sample applicant: raw `{{ref}}` braces
                        on an admin screen read as a broken template. */}
                    <p className="truncate text-xs text-muted-foreground">
                      {renderTemplate(trigger, lang, { ref: SAMPLE_REF, name: SAMPLE_NAME[lang] })}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    {CHANNELS.map((channel) => (
                      <label key={channel} className="flex items-center gap-2 text-sm">
                        <Switch
                          checked={channels[trigger].includes(channel)}
                          onCheckedChange={() => toggleChannel(trigger, channel)}
                          aria-label={`${t(`notifications.triggers.${trigger}`)} — ${t(`notifications.channels.${channel}`)}`}
                        />
                        <span className="hidden text-muted-foreground sm:inline">
                          {t(`notifications.channels.${channel}`)}
                        </span>
                      </label>
                    ))}

                    <Button variant="outline" size="sm" onClick={() => setPreviewFor(trigger)}>
                      {t('common.view')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </TabsContent>

        <TabsContent value="signature" className="mt-5">
          <OrgSignatureSection />
        </TabsContent>

        <TabsContent value="demo-data" className="mt-5">
          <SectionCard title={t('settings.demoData.title')} description={t('settings.demoData.hint')}>
            <div className="space-y-5">
              <dl
                data-testid="demo-data-counts"
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
              >
                {DEMO_TABLES.map((table) => (
                  <div key={table} className="rounded-lg border border-border bg-muted/40 p-3">
                    <dt className="text-xs text-muted-foreground">{t(`settings.demoData.${table}`)}</dt>
                    <dd
                      data-testid={`demo-count-${table}`}
                      className="mt-1 text-xl font-semibold tabular"
                    >
                      {counts[table].length}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center">
                <Button
                  variant="outline"
                  onClick={() => setResetMode('empty')}
                  disabled={resetDemoData.isPending}
                >
                  {t('settings.demoData.startClean')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setResetMode('seed')}
                  disabled={resetDemoData.isPending}
                >
                  {t('settings.demoData.restore')}
                </Button>
                <p className="text-xs text-muted-foreground sm:ms-auto">
                  {t('settings.demoData.urlHint')}
                </p>
              </div>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={Boolean(resetMode)}
        onOpenChange={(open) => !open && setResetMode(null)}
        title={
          resetMode === 'seed'
            ? t('settings.demoData.restoreConfirmTitle')
            : t('settings.demoData.startCleanConfirmTitle')
        }
        description={
          resetMode === 'seed'
            ? t('settings.demoData.restoreConfirmBody')
            : t('settings.demoData.startCleanConfirmBody')
        }
        confirmLabel={t('common.confirm')}
        isPending={resetDemoData.isPending}
        onConfirm={() => {
          if (!resetMode) return
          resetDemoData.mutate(resetMode, {
            onSuccess: () => {
              toast.success(
                t(resetMode === 'seed' ? 'settings.demoData.restored' : 'settings.demoData.cleared'),
              )
              setResetMode(null)
            },
          })
        }}
      />

      <PhonePreviewDialog
        open={Boolean(previewFor)}
        onClose={() => setPreviewFor(null)}
        body={previewBody}
        // Preview only the channels this trigger is actually configured to use,
        // so switching a channel off also removes it from the demo preview.
        channels={previewFor ? channels[previewFor] : []}
        triggerLabel={previewFor ? t(`notifications.triggers.${previewFor}`) : undefined}
      />
    </div>
  )
}

/**
 * The programme's own signature, configured once.
 *
 * The funding company does not draw a signature per applicant: this authorised
 * signatory is stamped onto every contract at the moment it is drawn up. Only
 * the beneficiary signs interactively, and she does it in her own portal.
 *
 * A signatory ships pre-configured so a presenter who never opens this screen
 * still issues properly signed contracts — and it is plainly editable here.
 */
function OrgSignatureSection() {
  const { t } = useTranslation()
  const orgSignature = useSettingsStore((s) => s.orgSignature)
  const setOrgSignature = useSettingsStore((s) => s.setOrgSignature)
  const resetOrgSignature = useSettingsStore((s) => s.resetOrgSignature)

  const [name, setName] = useState(orgSignature.name)
  // The pad cannot be pre-filled with a stored bitmap, so the saved mark is
  // shown above it and only replaced once someone actually draws a new one.
  const [mark, setMark] = useState<string | null>(orgSignature.image)

  const dirty = name !== orgSignature.name || mark !== orgSignature.image
  const valid = name.trim().length >= 3

  return (
    <SectionCard
      title={t('settings.signature.title')}
      description={t('settings.signature.hint')}
      actions={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              resetOrgSignature()
              setName(DEFAULT_ORG_SIGNATURE.name)
              setMark(DEFAULT_ORG_SIGNATURE.image)
              toast.success(t('settings.signature.reset'))
            }}
          >
            {t('settings.resetDefaults')}
          </Button>
          <Button
            disabled={!valid || !dirty}
            data-testid="save-signatory"
            onClick={() => {
              setOrgSignature({ name: name.trim(), image: mark })
              toast.success(t('settings.signature.saved'))
            }}
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="signatory-name">{t('settings.signature.nameLabel')}</Label>
          <Input
            id="signatory-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={DEFAULT_ORG_SIGNATURE.name}
          />
          {!valid ? (
            <p className="text-xs font-medium text-destructive">
              {t('settings.signature.nameRequired')}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t('settings.signature.currentLabel')}</p>
          <div
            data-testid="signatory-preview"
            className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4"
          >
            {mark ? (
              <img
                src={mark}
                alt={t('contracts.doc.orgSignatureAlt')}
                className="h-14 w-auto max-w-full object-contain object-start"
              />
            ) : (
              <p className="text-2xl text-terracotta-ink" style={{ fontFamily: 'cursive' }}>
                {name.trim() || DEFAULT_ORG_SIGNATURE.name}
              </p>
            )}
            <span className="text-xs text-muted-foreground">
              {name.trim() || DEFAULT_ORG_SIGNATURE.name}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>{t('settings.signature.padLabel')}</Label>
          <SignaturePad onChange={setMark} typedName={name} />
        </div>
      </div>
    </SectionCard>
  )
}
