import { z } from 'zod'
import type { TFunction } from 'i18next'
import { REGIONS, SECTORS } from '@/data/types'
import { AMOUNT_MAX, AMOUNT_MIN } from '@/lib/scoring'

/**
 * Schema factories take `t` so every validation message is localised.
 * Never inline an error string here — it must come from `validation.*`.
 */

export function makePersonalSchema(t: TFunction) {
  return z
    .object({
      fullName: z.string().min(6, t('validation.minLength', { count: 6 })),
      nationalId: z
        .string()
        .regex(/^[12]\d{9}$/, t('validation.nationalId')),
      phone: z.string().regex(/^05\d{8}$/, t('validation.phone')),
      email: z.email(t('validation.email')),
      region: z.enum(REGIONS, { message: t('validation.required') }),
      city: z.string().min(2, t('validation.required')),
      iban: z
        .string()
        .regex(/^SA\d{22}$/, t('validation.iban')),
      hasCommercialRegister: z.boolean(),
      commercialRegisterNo: z.string().optional(),
    })
    .refine(
      (values) => !values.hasCommercialRegister || (values.commercialRegisterNo ?? '').length >= 10,
      { path: ['commercialRegisterNo'], message: t('validation.crRequired') },
    )
}

export function makeProjectSchema(t: TFunction) {
  return z.object({
    name: z.string().min(3, t('validation.minLength', { count: 3 })),
    sector: z.enum(SECTORS, { message: t('validation.required') }),
    description: z.string().min(60, t('validation.minLength', { count: 60 })),
    requestedAmount: z
      .number()
      .min(AMOUNT_MIN, t('validation.amountRange', { min: AMOUNT_MIN, max: AMOUNT_MAX }))
      .max(AMOUNT_MAX, t('validation.amountRange', { min: AMOUNT_MIN, max: AMOUNT_MAX })),
    monthlyIncome: z.number().min(0, t('validation.min', { min: 0 })),
    experienceYears: z
      .number()
      .min(0, t('validation.min', { min: 0 }))
      .max(50, t('validation.max', { max: 50 })),
  })
}

export function makeFollowUpSchema(t: TFunction) {
  /*
    `valueAsNumber` yields NaN for an empty or non-numeric input. Zod reports that
    as an invalid_type issue whose default message is untranslated English, so the
    message is overridden here — otherwise the beneficiary sees raw library copy.
  */
  const numeric = () => z.number({ error: t('validation.required') })

  return z.object({
    revenue: numeric().min(0, t('validation.min', { min: 0 })),
    employees: numeric()
      .int(t('followUp.form.wholeNumber'))
      .min(0, t('validation.min', { min: 0 }))
      .max(500, t('validation.max', { max: 500 })),
    growthPct: numeric()
      .min(-100, t('validation.min', { min: -100 }))
      .max(500, t('validation.max', { max: 500 })),
    notes: z.string().optional(),
  })
}

export type PersonalValues = z.infer<ReturnType<typeof makePersonalSchema>>
export type ProjectValues = z.infer<ReturnType<typeof makeProjectSchema>>
export type FollowUpValues = z.infer<ReturnType<typeof makeFollowUpSchema>>
