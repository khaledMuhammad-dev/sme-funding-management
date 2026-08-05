import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SECTORS } from '@/data/types'
import { AMOUNT_MAX, AMOUNT_MIN } from '@/lib/scoring'
import { makeProjectSchema, type ProjectValues } from '@/lib/schemas/apply'
import { useApplyWizardStore } from '@/stores/useApplyWizardStore'
import { useUiStore } from '@/stores/useUiStore'
import { formatCurrency } from '@/lib/format'
import { ArrowIcon } from '@/components/icons'
import { FieldShell } from './FieldShell'

export function ProjectStep() {
  const { t } = useTranslation()
  const lang = useUiStore((s) => s.lang)
  const project = useApplyWizardStore((s) => s.project)
  const setProject = useApplyWizardStore((s) => s.setProject)
  const next = useApplyWizardStore((s) => s.next)
  const back = useApplyWizardStore((s) => s.back)

  const form = useForm<ProjectValues>({
    resolver: zodResolver(makeProjectSchema(t)),
    // Empty numeric fields start as NaN rather than '' so zod sees a number.
    defaultValues: {
      ...project,
      requestedAmount: Number(project.requestedAmount) || undefined,
      monthlyIncome: Number(project.monthlyIncome) || undefined,
      experienceYears: Number(project.experienceYears) || undefined,
    } as unknown as ProjectValues,
    mode: 'onBlur',
  })

  const description = form.watch('description') ?? ''

  const onSubmit = form.handleSubmit((values) => {
    setProject({ ...values, sector: values.sector })
    next()
  })

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <FieldShell label={t('apply.project.name')} error={form.formState.errors.name} required>
          {(props) => <Input {...props} {...form.register('name')} />}
        </FieldShell>

        <FieldShell label={t('apply.project.sector')} error={form.formState.errors.sector} required>
          {(props) => (
            <Select
              value={form.watch('sector')}
              onValueChange={(value) =>
                form.setValue('sector', value as ProjectValues['sector'], { shouldValidate: true })
              }
            >
              <SelectTrigger id={props.id} aria-describedby={props['aria-describedby']} className="w-full">
                <SelectValue placeholder={t('common.none')} />
              </SelectTrigger>
              <SelectContent>
                {SECTORS.map((sector) => (
                  <SelectItem key={sector} value={sector}>
                    {t(`sector.${sector}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FieldShell>
      </div>

      <FieldShell
        label={t('apply.project.description')}
        error={form.formState.errors.description}
        hint={t('apply.project.descriptionHint')}
        required
      >
        {(props) => (
          <div className="space-y-1">
            <Textarea {...props} {...form.register('description')} rows={5} />
            <p className="text-end text-xs text-muted-foreground tabular">{description.length} / 60</p>
          </div>
        )}
      </FieldShell>

      <div className="grid gap-5 sm:grid-cols-3">
        <FieldShell
          label={t('apply.project.requestedAmount')}
          error={form.formState.errors.requestedAmount}
          hint={`${formatCurrency(AMOUNT_MIN, lang)} – ${formatCurrency(AMOUNT_MAX, lang)}`}
          required
        >
          {(props) => (
            <Input {...props} {...form.register('requestedAmount', { valueAsNumber: true })} inputMode="numeric" className="tabular" />
          )}
        </FieldShell>

        <FieldShell
          label={t('apply.project.monthlyIncome')}
          error={form.formState.errors.monthlyIncome}
          required
        >
          {(props) => (
            <Input {...props} {...form.register('monthlyIncome', { valueAsNumber: true })} inputMode="numeric" className="tabular" />
          )}
        </FieldShell>

        <FieldShell
          label={t('apply.project.experienceYears')}
          error={form.formState.errors.experienceYears}
          required
        >
          {(props) => (
            <Input {...props} {...form.register('experienceYears', { valueAsNumber: true })} inputMode="numeric" className="tabular" />
          )}
        </FieldShell>
      </div>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" size="lg" onClick={back}>
          {t('common.back')}
        </Button>
        <Button type="submit" size="lg">
          {t('common.next')}
          <ArrowIcon size={16} className="rtl-flip" />
        </Button>
      </div>
    </form>
  )
}
