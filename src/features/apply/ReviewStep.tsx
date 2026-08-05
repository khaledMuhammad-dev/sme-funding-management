import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { DataRow, SectionCard } from '@/components/shared'
import { Money } from '@/components/shared'
import { CheckIcon } from '@/components/icons'
import { useApplyWizardStore, type WizardStep } from '@/stores/useApplyWizardStore'

export function ReviewStep({
  onSubmit,
  isPending,
}: {
  onSubmit: () => void
  isPending: boolean
}) {
  const { t } = useTranslation()
  const { personal, project, documents, goTo, back } = useApplyWizardStore()

  const editButton = (step: WizardStep) => (
    <Button variant="ghost" size="sm" onClick={() => goTo(step)}>
      {t('apply.review.editSection')}
    </Button>
  )

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="font-semibold">{t('apply.review.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('apply.review.hint')}</p>
      </div>

      <SectionCard title={t('apply.steps.personal')} actions={editButton('personal')}>
        <dl className="grid gap-x-6 sm:grid-cols-2">
          <DataRow label={t('apply.personal.fullName')} value={personal.fullName} />
          <DataRow label={t('apply.personal.nationalId')} value={<span className="tabular">{personal.nationalId}</span>} />
          <DataRow label={t('apply.personal.phone')} value={<span className="tabular" dir="ltr">{personal.phone}</span>} />
          <DataRow label={t('apply.personal.email')} value={<span dir="ltr">{personal.email}</span>} />
          <DataRow label={t('apply.personal.region')} value={personal.region ? t(`region.${personal.region}`) : '—'} />
          <DataRow label={t('apply.personal.city')} value={personal.city} />
          <DataRow label={t('apply.personal.iban')} value={<span className="tabular" dir="ltr">{personal.iban}</span>} />
          {personal.hasCommercialRegister ? (
            <DataRow label={t('apply.personal.crNo')} value={<span className="tabular">{personal.commercialRegisterNo}</span>} />
          ) : null}
        </dl>
      </SectionCard>

      <SectionCard title={t('apply.steps.project')} actions={editButton('project')}>
        <dl className="grid gap-x-6 sm:grid-cols-2">
          <DataRow label={t('apply.project.name')} value={project.name} />
          <DataRow label={t('apply.project.sector')} value={project.sector ? t(`sector.${project.sector}`) : '—'} />
          <DataRow
            label={t('apply.project.requestedAmount')}
            value={<Money value={Number(project.requestedAmount) || 0} />}
          />
          <DataRow
            label={t('apply.project.monthlyIncome')}
            value={<Money value={Number(project.monthlyIncome) || 0} />}
          />
          <DataRow
            label={t('apply.project.experienceYears')}
            value={<span className="tabular">{project.experienceYears}</span>}
          />
          <DataRow
            label={t('apply.project.description')}
            value={<span className="font-normal">{project.description}</span>}
            className="sm:col-span-2"
          />
        </dl>
      </SectionCard>

      <SectionCard title={t('apply.steps.documents')} actions={editButton('documents')}>
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li key={doc.kind} className="flex items-center gap-3 text-sm">
              <span className="flex size-6 items-center justify-center rounded-full bg-success-soft text-success">
                <CheckIcon size={13} strokeWidth={2.6} />
              </span>
              <span className="font-medium">{t(`docKind.${doc.kind}`)}</span>
              <span className="ms-auto text-xs text-muted-foreground tabular">
                {doc.fileName} · {doc.sizeKb} KB
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <div className="flex flex-wrap justify-between gap-3 pt-2">
        <Button type="button" variant="outline" size="lg" onClick={back} disabled={isPending}>
          {t('common.back')}
        </Button>
        <Button
          type="button"
          size="lg"
          onClick={onSubmit}
          disabled={isPending}
          className="border border-terracotta-ink bg-terracotta text-terracotta-foreground hover:bg-terracotta/90"
        >
          {isPending ? t('common.saving') : t('apply.review.submit')}
        </Button>
      </div>
    </div>
  )
}
