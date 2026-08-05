import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, PageHeader, SectionCard, DateText } from '@/components/shared'
import { AlertIcon, CheckIcon, UploadIcon, XIcon } from '@/components/icons'
import { FieldShell } from '@/features/apply/FieldShell'
import { makeFollowUpSchema, type FollowUpValues } from '@/lib/schemas/apply'
import { useApplication, useFollowUp, useSubmitFollowUp } from '@/lib/api'
import { readAsDataUrl, shrinkImageDataUrl } from '@/lib/files'
import { cn } from '@/lib/utils'

/**
 * Upload limits. Four photos is what a monthly report needs, and 5 MB per file
 * covers a phone camera shot while keeping the in-memory demo database sane —
 * everything is re-encoded to a ~900px JPEG before it is stored anyway.
 */
const MAX_PHOTOS = 4
const MAX_PHOTO_MB = 5

interface PickedPhoto {
  id: string
  name: string
  dataUrl: string
}

/** Mobile-first report the beneficiary fills in from a link in her SMS. */
export default function FollowUpFormPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()

  const { data: followUp, isLoading } = useFollowUp(id)
  const { data: application } = useApplication(followUp?.applicationId)
  const submit = useSubmitFollowUp()
  const [photos, setPhotos] = useState<PickedPhoto[]>([])

  const form = useForm<FollowUpValues>({
    resolver: zodResolver(makeFollowUpSchema(t)),
    mode: 'onBlur',
    /*
      `valueAsNumber` on an empty input yields NaN, so the fields start blank and
      the schema's localised "required" message covers the empty case.
    */
    defaultValues: { notes: '' },
  })

  const onSubmit = form.handleSubmit((values) => {
    if (!id) return
    submit.mutate(
      { followUpId: id, ...values, photos: photos.map((photo) => photo.dataUrl) },
      { onSuccess: () => toast.success(t('followUp.form.success')) },
    )
  })

  if (isLoading) {
    return (
      // Shaped like the loaded form (header, two summary rows, four fields,
      // the photo box and the submit button) so nothing jumps on arrival.
      <div
        data-testid="follow-up-loading"
        aria-busy="true"
        aria-live="polite"
        aria-label={t('common.loading')}
        className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6"
      >
        <div className="mb-6 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-soft-sm">
          <Skeleton className="h-11 rounded-lg" />
          <Skeleton className="h-11 rounded-lg" />
          {[0, 1, 2].map((row) => (
            <div key={row} className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 rounded-md" />
            </div>
          ))}
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-24 rounded-md" />
          </div>
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-11 w-full rounded-md" />
        </div>
      </div>
    )
  }

  if (!followUp) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-10">
        <EmptyState
          variant="page"
          icon={<AlertIcon size={22} />}
          title={t('track.notFound')}
          hint={t('track.notFoundHint')}
        />
      </div>
    )
  }

  if (followUp.submittedAt || submit.isSuccess) {
    return (
      <div
        data-testid="follow-up-success"
        className="mx-auto flex w-full max-w-lg flex-col items-center gap-5 px-4 py-24 text-center"
      >
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 18 }}
          className="flex size-16 items-center justify-center rounded-full bg-success-soft text-success"
        >
          <CheckIcon size={32} strokeWidth={2.2} />
        </motion.span>
        <h1 className="text-2xl font-semibold tracking-tight">{t('followUp.form.success')}</h1>
        {application ? (
          <p className="text-muted-foreground">
            {application.project.name} · <span className="tabular">{application.ref}</span>
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow={application?.ref}
        title={t('followUp.form.title')}
        subtitle={t('followUp.form.subtitle')}
        className="mb-6"
      />

      <SectionCard>
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3 text-sm">
            <span className="text-muted-foreground">{t('followUp.period')}</span>
            <span className="font-semibold tabular">{followUp.period}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3 text-sm">
            <span className="text-muted-foreground">{t('followUp.dueDate')}</span>
            <DateText value={followUp.dueDate} className="font-semibold" />
          </div>

          <FieldShell
            label={t('followUp.form.revenueLabel')}
            error={form.formState.errors.revenue}
            required
          >
            {(props) => (
              <Input {...props} {...form.register('revenue', { valueAsNumber: true })} inputMode="numeric" className="tabular" />
            )}
          </FieldShell>

          <FieldShell
            label={t('followUp.form.employeesLabel')}
            error={form.formState.errors.employees}
            required
          >
            {(props) => (
              <Input {...props} {...form.register('employees', { valueAsNumber: true })} inputMode="numeric" className="tabular" />
            )}
          </FieldShell>

          <FieldShell
            label={t('followUp.form.growthLabel')}
            error={form.formState.errors.growthPct}
            required
          >
            {(props) => (
              <Input {...props} {...form.register('growthPct', { valueAsNumber: true })} inputMode="numeric" className="tabular" />
            )}
          </FieldShell>

          <FieldShell label={t('followUp.form.notesLabel')} error={form.formState.errors.notes}>
            {(props) => <Textarea {...props} {...form.register('notes')} rows={4} />}
          </FieldShell>

          <PhotoPicker photos={photos} onChange={setPhotos} />

          <Button type="submit" size="lg" className="w-full" disabled={submit.isPending}>
            {submit.isPending ? t('common.saving') : t('followUp.form.submit')}
          </Button>
        </form>
      </SectionCard>
    </div>
  )
}

/**
 * Real photo upload for the beneficiary's phone: a file input (also reachable by
 * dragging onto the box on a desktop), thumbnail previews, per-photo removal and
 * localized limit errors. Files are read in the browser and shrunk to a data URL
 * — there is no server in this demo.
 */
function PhotoPicker({
  photos,
  onChange,
}: {
  photos: PickedPhoto[]
  onChange: (photos: PickedPhoto[]) => void
}) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  // A monotonic counter keeps keys unique when the same file is picked twice —
  // no `Math.random()`, so runs stay deterministic.
  const seq = useRef(0)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)

  const accept = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const files = [...fileList]
    setBusy(true)

    const rejected = files.find((file) => !file.type.startsWith('image/'))
    const oversize = files.find((file) => file.size > MAX_PHOTO_MB * 1024 * 1024)
    const usable = files.filter(
      (file) => file.type.startsWith('image/') && file.size <= MAX_PHOTO_MB * 1024 * 1024,
    )
    const room = Math.max(0, MAX_PHOTOS - photos.length)
    const taken = usable.slice(0, room)

    let message: string | null = null
    if (rejected) message = t('followUp.form.photoInvalid', { name: rejected.name })
    else if (oversize)
      message = t('followUp.form.photoTooLarge', { name: oversize.name, max: MAX_PHOTO_MB })
    else if (usable.length > room) message = t('followUp.form.photoLimit', { max: MAX_PHOTOS })

    const added: PickedPhoto[] = []
    for (const file of taken) {
      try {
        const dataUrl = await shrinkImageDataUrl(await readAsDataUrl(file))
        seq.current += 1
        added.push({ id: `photo-${seq.current}`, name: file.name, dataUrl })
      } catch {
        message = t('followUp.form.photoInvalid', { name: file.name })
      }
    }

    if (added.length > 0) onChange([...photos, ...added])
    setError(message)
    setBusy(false)
    // Allow re-picking the exact same file after a removal.
    if (inputRef.current) inputRef.current.value = ''
  }

  const remove = (id: string) => {
    setError(null)
    onChange(photos.filter((photo) => photo.id !== id))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{t('followUp.form.photosLabel')}</span>
        <span data-testid="photo-count" className="text-xs text-muted-foreground tabular">
          {t('followUp.form.photoCount', { used: photos.length, max: MAX_PHOTOS })}
        </span>
      </div>

      <div
        data-testid="photo-dropzone"
        aria-busy={busy}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          void accept(event.dataTransfer.files)
        }}
        className={cn(
          'flex flex-col items-center gap-2 rounded-lg border border-dashed border-input p-5 text-center text-sm text-muted-foreground transition-colors',
          dragging && 'border-primary bg-primary/5',
        )}
      >
        <UploadIcon size={20} />
        {/*
          The input comes first so the label can mirror its focus ring through
          `peer-*`: `sr-only` only clips the element, so the real focus outline
          lands inside a 1px box and cannot be seen by a keyboard user.
        */}
        <input
          ref={inputRef}
          id="follow-up-photos"
          data-testid="photo-input"
          type="file"
          accept="image/*"
          multiple
          className="peer sr-only"
          onChange={(event) => void accept(event.target.files)}
        />
        <label
          htmlFor="follow-up-photos"
          className="cursor-pointer rounded-sm text-sm font-semibold text-primary underline-offset-4 hover:underline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring"
        >
          {t('followUp.form.photosAdd')}
        </label>
        <p className="text-xs">{t('followUp.form.photosHint', { max: MAX_PHOTOS, size: MAX_PHOTO_MB })}</p>
      </div>

      {error ? (
        <p role="alert" className="flex items-center gap-2 text-sm font-medium text-destructive">
          <AlertIcon size={15} />
          {error}
        </p>
      ) : null}

      {photos.length > 0 ? (
        <ul data-testid="photo-previews" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo) => (
            <li key={photo.id} className="relative">
              <img
                src={photo.dataUrl}
                alt={photo.name}
                data-testid="photo-preview"
                className="aspect-square w-full rounded-lg border border-border object-cover"
              />
              <button
                type="button"
                onClick={() => remove(photo.id)}
                aria-label={t('followUp.form.removePhoto', { name: photo.name })}
                className="absolute end-1 top-1 flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm hover:bg-destructive-soft hover:text-destructive"
              >
                <XIcon size={13} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
