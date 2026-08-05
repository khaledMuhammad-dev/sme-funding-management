import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DataRow, DateText } from '@/components/shared'
import { DocumentIcon } from '@/components/icons'
import type { UploadedDoc } from '@/data/types'

export interface DocumentPreviewDialogProps {
  doc: UploadedDoc | null
  onClose: () => void
}

/**
 * Fake document viewer.
 *
 * There is no file store behind the demo, so the dialog shows the metadata the
 * officer actually checks plus a paper-like placeholder page — enough to review
 * the flow without pretending a PDF is being streamed.
 */
export function DocumentPreviewDialog({ doc, onClose }: DocumentPreviewDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={Boolean(doc)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg [&>*]:min-w-0">
        <DialogHeader className="min-w-0">
          <DialogTitle>{doc ? t(`docKind.${doc.kind}`) : t('applications.documents.preview')}</DialogTitle>
          <DialogDescription>{t('applications.documents.previewUnavailable')}</DialogDescription>
        </DialogHeader>

        {doc ? (
          <>
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/60 p-8">
              <span className="flex size-14 items-center justify-center rounded-xl bg-card text-muted-foreground shadow-soft-sm">
                <DocumentIcon size={26} />
              </span>
              <p className="text-sm font-medium tabular" dir="ltr">
                {doc.fileName}
              </p>
            </div>

            <dl className="grid gap-x-6 sm:grid-cols-2">
              <DataRow
                label={t('applications.documents.size')}
                value={<span className="tabular">{doc.sizeKb} KB</span>}
              />
              <DataRow
                label={t('applications.documents.uploadedAt')}
                value={<DateText value={doc.uploadedAt} />}
              />
            </dl>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
