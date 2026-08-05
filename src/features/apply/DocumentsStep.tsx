import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { DOCUMENT_KINDS, type DocumentKind } from '@/data/types'
import { REQUIRED_DOC_KINDS } from '@/lib/scoring'
import { useApplyWizardStore } from '@/stores/useApplyWizardStore'
import { ArrowIcon, CheckIcon, DocumentIcon, UploadIcon, XIcon } from '@/components/icons'
import { sizeInKb } from '@/lib/files'
import { cn } from '@/lib/utils'

/** Matches the copy in `apply.documents.hint`. */
const MAX_DOC_MB = 5
/** Photos are images; every other document is normally a scan or a PDF. */
const ACCEPT: Record<DocumentKind, string> = {
  national_id: 'application/pdf,image/*',
  iban_cert: 'application/pdf,image/*',
  commercial_register: 'application/pdf,image/*',
  feasibility_study: 'application/pdf,image/*',
  photos: 'image/*',
}

export function DocumentsStep() {
  const { t } = useTranslation()
  const documents = useApplyWizardStore((s) => s.documents)
  const addDocument = useApplyWizardStore((s) => s.addDocument)
  const removeDocument = useApplyWizardStore((s) => s.removeDocument)
  const next = useApplyWizardStore((s) => s.next)
  const back = useApplyWizardStore((s) => s.back)
  const [showError, setShowError] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const inputs = useRef<Partial<Record<DocumentKind, HTMLInputElement | null>>>({})

  /**
   * The applicant really picks a file: only its name and size are kept, because a
   * frontend-only demo has nowhere to send the bytes and the draft is persisted
   * to localStorage between visits.
   */
  const handleFile = (kind: DocumentKind, file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_DOC_MB * 1024 * 1024) {
      setFileError(t('apply.documents.tooLarge', { name: file.name, max: MAX_DOC_MB }))
      return
    }
    setFileError(null)
    setShowError(false)
    addDocument({ kind, fileName: file.name, sizeKb: sizeInKb(file.size) })
  }

  const openPicker = (kind: DocumentKind) => {
    const input = inputs.current[kind]
    if (input) {
      // Clearing first makes re-picking the same file fire `change` again.
      input.value = ''
      input.click()
    }
  }

  const uploaded = new Set(documents.map((d) => d.kind))
  const missingRequired = REQUIRED_DOC_KINDS.filter((kind) => !uploaded.has(kind))

  const handleContinue = () => {
    if (missingRequired.length > 0) {
      setShowError(true)
      return
    }
    next()
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="font-semibold">{t('apply.documents.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('apply.documents.hint')}</p>
      </div>

      <ul className="space-y-3">
        {DOCUMENT_KINDS.map((kind) => {
          const doc = documents.find((d) => d.kind === kind)
          const required = REQUIRED_DOC_KINDS.includes(kind as (typeof REQUIRED_DOC_KINDS)[number])
          const isMissing = showError && required && !doc

          return (
            <li
              key={kind}
              data-morph-host
              data-testid={`doc-${kind}`}
              className={cn(
                'flex flex-wrap items-center gap-3 rounded-xl border p-4 transition-colors',
                doc ? 'border-success bg-success-soft/40' : 'border-border bg-card',
                isMissing && 'border-destructive bg-destructive-soft/40',
              )}
            >
              <span
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-lg',
                  doc ? 'bg-success-soft text-success' : 'bg-muted text-muted-foreground',
                )}
              >
                {doc ? <CheckIcon size={18} strokeWidth={2.4} /> : <DocumentIcon size={18} />}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {t(`docKind.${kind}`)}
                  {required ? <span className="ms-1 text-terracotta-ink">*</span> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground tabular">
                  {doc ? `${doc.fileName} · ${doc.sizeKb} KB` : t('apply.documents.dropHere')}
                </p>
              </div>

              <input
                ref={(node) => {
                  inputs.current[kind] = node
                }}
                type="file"
                data-testid={`doc-input-${kind}`}
                accept={ACCEPT[kind]}
                /*
                  Visually hidden but still focusable by default: `sr-only` only
                  clips it. The visible Upload/Replace button opens this very
                  picker, so leaving it in the tab order added a stop where the
                  focus ring could not be seen.
                */
                tabIndex={-1}
                className="sr-only"
                aria-label={t(`docKind.${kind}`)}
                onChange={(event) => handleFile(kind, event.target.files?.[0])}
              />

              {doc ? (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openPicker(kind)}>
                    {t('apply.documents.replace')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9"
                    onClick={() => removeDocument(kind)}
                    aria-label={t('apply.documents.remove')}
                  >
                    <XIcon size={15} />
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => openPicker(kind)}>
                  <UploadIcon size={15} />
                  {t('apply.documents.upload')}
                </Button>
              )}
            </li>
          )
        })}
      </ul>

      {fileError ? (
        <p role="alert" className="rounded-lg bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive">
          {fileError}
        </p>
      ) : null}

      {showError && missingRequired.length > 0 ? (
        <p role="alert" className="rounded-lg bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive">
          {t('validation.requiredDocs')}
        </p>
      ) : null}

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" size="lg" onClick={back}>
          {t('common.back')}
        </Button>
        <Button type="button" size="lg" onClick={handleContinue}>
          {t('common.next')}
          <ArrowIcon size={16} className="rtl-flip" />
        </Button>
      </div>
    </div>
  )
}
