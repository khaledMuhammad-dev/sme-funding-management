import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { REGIONS } from '@/data/types'
import { makePersonalSchema, type PersonalValues } from '@/lib/schemas/apply'
import { useApplyWizardStore } from '@/stores/useApplyWizardStore'
import { ArrowIcon } from '@/components/icons'
import { FieldShell } from './FieldShell'

export function PersonalStep() {
  const { t } = useTranslation()
  const personal = useApplyWizardStore((s) => s.personal)
  const setPersonal = useApplyWizardStore((s) => s.setPersonal)
  const next = useApplyWizardStore((s) => s.next)

  const form = useForm<PersonalValues>({
    resolver: zodResolver(makePersonalSchema(t)),
    defaultValues: personal as PersonalValues,
    mode: 'onBlur',
  })

  const hasCr = form.watch('hasCommercialRegister')

  const onSubmit = form.handleSubmit((values) => {
    setPersonal({ ...values, commercialRegisterNo: values.commercialRegisterNo ?? '' })
    next()
  })

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <FieldShell label={t('apply.personal.fullName')} error={form.formState.errors.fullName} required>
          {(props) => <Input {...props} {...form.register('fullName')} autoComplete="name" />}
        </FieldShell>

        <FieldShell label={t('apply.personal.nationalId')} error={form.formState.errors.nationalId} required>
          {(props) => (
            <Input {...props} {...form.register('nationalId')} inputMode="numeric" maxLength={10} className="tabular" />
          )}
        </FieldShell>

        <FieldShell label={t('apply.personal.phone')} error={form.formState.errors.phone} required>
          {(props) => (
            <Input {...props} {...form.register('phone')} inputMode="tel" maxLength={10} dir="ltr" className="tabular text-start" />
          )}
        </FieldShell>

        <FieldShell label={t('apply.personal.email')} error={form.formState.errors.email} required>
          {(props) => <Input {...props} {...form.register('email')} type="email" dir="ltr" className="text-start" />}
        </FieldShell>

        <FieldShell label={t('apply.personal.region')} error={form.formState.errors.region} required>
          {(props) => (
            <Select
              value={form.watch('region')}
              onValueChange={(value) =>
                form.setValue('region', value as PersonalValues['region'], { shouldValidate: true })
              }
            >
              <SelectTrigger id={props.id} aria-describedby={props['aria-describedby']} className="w-full">
                <SelectValue placeholder={t('common.none')} />
              </SelectTrigger>
              <SelectContent>
                {REGIONS.map((region) => (
                  <SelectItem key={region} value={region}>
                    {t(`region.${region}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FieldShell>

        <FieldShell label={t('apply.personal.city')} error={form.formState.errors.city} required>
          {(props) => <Input {...props} {...form.register('city')} />}
        </FieldShell>

        <FieldShell
          label={t('apply.personal.iban')}
          error={form.formState.errors.iban}
          hint="SA0000000000000000000000"
          required
          className="sm:col-span-2"
        >
          {(props) => (
            <Input {...props} {...form.register('iban')} dir="ltr" maxLength={24} className="tabular text-start uppercase" />
          )}
        </FieldShell>
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-muted/50 p-4">
        <Checkbox
          checked={hasCr}
          onCheckedChange={(checked) => form.setValue('hasCommercialRegister', checked === true)}
        />
        <span className="text-sm font-medium">{t('apply.personal.hasCr')}</span>
      </label>

      {hasCr ? (
        <FieldShell
          label={t('apply.personal.crNo')}
          error={form.formState.errors.commercialRegisterNo}
          required
        >
          {(props) => (
            <Input {...props} {...form.register('commercialRegisterNo')} inputMode="numeric" className="tabular" />
          )}
        </FieldShell>
      ) : null}

      <div className="flex justify-end pt-2">
        <Button type="submit" size="lg">
          {t('common.next')}
          <ArrowIcon size={16} className="rtl-flip" />
        </Button>
      </div>
    </form>
  )
}
