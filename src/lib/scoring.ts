import type { Application, CriterionKey, ScoreCard, ScoreCriterion } from '@/data/types'
import { CRITERION_KEYS } from '@/data/types'

/** Programme funding cap — also enforced by the apply wizard's zod schema. */
export const AMOUNT_MIN = 20_000
export const AMOUNT_MAX = 300_000

export const REQUIRED_DOC_KINDS = ['national_id', 'iban_cert', 'feasibility_study'] as const

export interface EligibilityCheck {
  key: 'docsComplete' | 'termsAccepted' | 'amountWithinCap' | 'hasIban' | 'incomeDeclared'
  passed: boolean
}

export function eligibilityChecks(app: Application): EligibilityCheck[] {
  const uploaded = new Set(app.documents.filter((d) => !d.missing).map((d) => d.kind))
  return [
    { key: 'docsComplete', passed: REQUIRED_DOC_KINDS.every((k) => uploaded.has(k)) },
    { key: 'termsAccepted', passed: app.termsAccepted },
    {
      key: 'amountWithinCap',
      passed:
        app.project.requestedAmount >= AMOUNT_MIN && app.project.requestedAmount <= AMOUNT_MAX,
    },
    { key: 'hasIban', passed: Boolean(app.beneficiary.iban) },
    { key: 'incomeDeclared', passed: app.project.monthlyIncome > 0 },
  ]
}

export function completenessPct(app: Application): number {
  const checks = eligibilityChecks(app)
  return Math.round((checks.filter((c) => c.passed).length / checks.length) * 100)
}

/**
 * Derives each criterion's raw 0–100 value from the application itself, so
 * editing weights in settings re-scores every application coherently.
 */
export function criterionValue(app: Application, key: CriterionKey): number {
  switch (key) {
    case 'income_stability':
      return clamp((app.project.monthlyIncome / 20_000) * 100)
    case 'project_experience':
      return clamp((app.project.experienceYears / 10) * 100)
    case 'seriousness':
      // A commercial register and a long description both signal commitment.
      return clamp(
        (app.beneficiary.hasCommercialRegister ? 55 : 25) +
          Math.min(45, app.project.description.length / 4),
      )
    case 'repayment_ability': {
      const ratio = (app.project.monthlyIncome * 12) / Math.max(1, app.project.requestedAmount)
      return clamp(ratio * 140)
    }
    case 'data_completeness':
      return completenessPct(app)
    default:
      return 0
  }
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function computeScore(app: Application, weights: Record<CriterionKey, number>): ScoreCard {
  const criteria: ScoreCriterion[] = CRITERION_KEYS.map((key) => ({
    key,
    weight: weights[key],
    value: criterionValue(app, key),
  }))

  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0) || 100
  const total = Math.round(
    criteria.reduce((sum, c) => sum + (c.value * c.weight) / totalWeight, 0),
  )

  return {
    total,
    verdict: total >= 70 ? 'eligible' : total >= 50 ? 'manual_review' : 'ineligible',
    criteria,
    computedAt: new Date().toISOString(),
  }
}

export function weightedValue(criterion: ScoreCriterion, totalWeight: number) {
  return Math.round((criterion.value * criterion.weight) / (totalWeight || 100))
}
