import { motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmptyState, SectionCard } from '@/components/shared'
import { AlertIcon, CheckIcon, XIcon } from '@/components/icons'
import type { Application, ScoreVerdict } from '@/data/types'
import { completenessPct, eligibilityChecks, weightedValue } from '@/lib/scoring'
import { useRecomputeScore } from '@/lib/api'
import { cn } from '@/lib/utils'

const VERDICT_CLASS: Record<ScoreVerdict, string> = {
  eligible: 'bg-success-soft text-success',
  manual_review: 'bg-warning-soft text-warning',
  ineligible: 'bg-destructive-soft text-destructive',
}

/** Circular gauge — the score's one moment of drama, animated once on mount. */
function ScoreGauge({ score, verdict }: { score: number; verdict: ScoreVerdict }) {
  const reduceMotion = useReducedMotion()
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const stroke =
    verdict === 'eligible'
      ? 'var(--success)'
      : verdict === 'manual_review'
        ? 'var(--warning)'
        : 'var(--destructive)'

  return (
    <div className="relative flex size-36 items-center justify-center">
      <svg viewBox="0 0 128 128" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="var(--muted)" strokeWidth="10" />
        <motion.circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          /* Reduced motion gets the finished arc immediately, never a sweep. */
          initial={{
            strokeDashoffset: reduceMotion
              ? circumference * (1 - score / 100)
              : circumference,
          }}
          animate={{ strokeDashoffset: circumference * (1 - score / 100) }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-semibold tabular" data-testid="score-total">
          {score}
        </span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    </div>
  )
}

export function ScoreCardPanel({ application }: { application: Application }) {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const recompute = useRecomputeScore()

  const checks = eligibilityChecks(application)
  const completeness = completenessPct(application)
  const score = application.score

  const recalcButton = (
    <Button
      variant="outline"
      size="sm"
      disabled={recompute.isPending}
      onClick={() =>
        recompute.mutate(application.id, {
          onSuccess: () => toast.success(t('scoring.recalculated')),
        })
      }
    >
      {recompute.isPending ? t('common.saving') : t('scoring.recalculate')}
    </Button>
  )

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <SectionCard title={t('scoring.title')} description={t('scoring.subtitle')} actions={recalcButton}>
        {!score ? (
          <EmptyState
            icon={<AlertIcon size={22} />}
            title={t('scoring.notScored')}
            hint={t('scoring.notScoredHint')}
            action={recalcButton}
          />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-6">
              <ScoreGauge score={score.total} verdict={score.verdict} />
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('scoring.verdict')}
                </p>
                <span
                  data-testid="score-verdict"
                  className={cn(
                    'inline-flex rounded-full px-3 py-1 text-sm font-semibold',
                    VERDICT_CLASS[score.verdict],
                  )}
                >
                  {t(`scoring.verdicts.${score.verdict}`)}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">{t('scoring.criteria')}</h3>
              {score.criteria.map((criterion) => {
                const totalWeight = score.criteria.reduce((sum, c) => sum + c.weight, 0)
                return (
                  <div key={criterion.key} data-testid="criterion-row" className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium">{t(`scoring.criterion.${criterion.key}`)}</span>
                      <span className="text-xs text-muted-foreground tabular">
                        {t('scoring.weight')} {criterion.weight}% · {t('scoring.weighted')}{' '}
                        {weightedValue(criterion, totalWeight)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        initial={{ width: reduceMotion ? `${criterion.value}%` : 0 }}
                        animate={{ width: `${criterion.value}%` }}
                        transition={reduceMotion ? { duration: 0 } : { duration: 0.6, ease: 'easeOut' }}
                        className="h-full rounded-full bg-primary"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title={t('scoring.eligibilityChecks')}>
        <div className="mb-4 space-y-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">{t('scoring.completeness')}</span>
            <span className="font-semibold tabular">{completeness}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <motion.div
              initial={{ width: reduceMotion ? `${completeness}%` : 0 }}
              animate={{ width: `${completeness}%` }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.6, ease: 'easeOut' }}
              className={cn(
                'h-full rounded-full',
                completeness === 100 ? 'bg-success' : 'bg-warning',
              )}
            />
          </div>
        </div>

        <ul className="space-y-2">
          {checks.map((check) => (
            <li key={check.key} className="flex items-center gap-2.5 text-sm">
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full',
                  check.passed ? 'bg-success-soft text-success' : 'bg-destructive-soft text-destructive',
                )}
              >
                {check.passed ? <CheckIcon size={12} strokeWidth={3} /> : <XIcon size={12} strokeWidth={3} />}
              </span>
              <span className={check.passed ? '' : 'text-muted-foreground'}>
                {t(`scoring.checks.${check.key}`)}
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  )
}
