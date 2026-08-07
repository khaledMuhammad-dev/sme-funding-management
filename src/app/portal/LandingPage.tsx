import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/shared'
import {
  ApplicationsIcon,
  ArrowIcon,
  CheckIcon,
  ContractIcon,
  DisbursementIcon,
  DocumentIcon,
  FollowUpIcon,
  InterviewIcon,
  SearchIcon,
} from '@/components/icons'
import { useDemoDataStore } from '@/stores/useDemoDataStore'
import { useUiStore } from '@/stores/useUiStore'
import { formatCurrency } from '@/lib/format'
import { ROUTES } from '../routes'
import { LandingHero } from './LandingHero'

const STEPS = [
  { key: 'submit', icon: ApplicationsIcon },
  { key: 'screen', icon: SearchIcon },
  { key: 'review', icon: DocumentIcon },
  { key: 'interview', icon: InterviewIcon },
  { key: 'contract', icon: ContractIcon },
  { key: 'disburse', icon: DisbursementIcon },
] as const

const ELIGIBILITY = ['saudi', 'age', 'project', 'docs'] as const

export default function LandingPage() {
  const { t } = useTranslation()
  const lang = useUiStore((s) => s.lang)
  const applications = useDemoDataStore((s) => s.applications)
  const disbursements = useDemoDataStore((s) => s.disbursements)

  const paid = disbursements.filter((d) => d.status === 'paid')
  const active = applications.filter((a) => ['disbursed', 'follow_up'].includes(a.status))

  return (
    <div className="w-full">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <LandingHero />

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      {/* ── Impact ───────────────────────────────────────────────────────── */}
      <section className="pb-16 pt-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={t('landing.stats.beneficiaries')} value={applications.length} />
          <StatCard
            label={t('landing.stats.disbursed')}
            value={paid.reduce((sum, d) => sum + d.amount, 0)}
            format={(value) => formatCurrency(value, lang, true)}
            featured
          />
          <StatCard label={t('landing.stats.projects')} value={active.length} />
          <StatCard label={t('landing.stats.avgDays')} value={18} format={(v) => `${v} ${t('common.days')}`} />
        </div>
      </section>

      {/* ── Journey ──────────────────────────────────────────────────────── */}
      <section className="grid gap-8 border-t border-border py-16 lg:grid-cols-[19rem_1fr] lg:gap-10">
        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">{t('landing.stepsTitle')}</h2>
            <p className="text-muted-foreground">{t('landing.stepsSubtitle')}</p>
          </div>

          {/* A real application mid-journey, beside the stages that describe it —
              the stages in the abstract on one side, one file moving through
              them on the other. Moved off the hero when the photograph took it. */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="relative rounded-2xl border border-border bg-card p-6 shadow-soft-lg"
          >
            <div className="absolute -top-3 end-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
              APP-{new Date().getFullYear()}-0042
            </div>

            <ol className="flex flex-col">
              {STEPS.map((step, index) => {
                const done = index < 4
                const current = index === 4
                return (
                  <li key={step.key} data-morph-host className="grid grid-cols-[1.75rem_1fr] gap-x-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={
                          done
                            ? 'flex size-7 items-center justify-center rounded-full bg-success-soft text-success'
                            : current
                              ? 'flex size-7 items-center justify-center rounded-full bg-terracotta text-terracotta-foreground'
                              : 'flex size-7 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground'
                        }
                      >
                        {done ? <CheckIcon size={14} strokeWidth={2.6} /> : <step.icon size={14} />}
                      </span>
                      {index < STEPS.length - 1 ? (
                        <span className={`w-px flex-1 ${done ? 'bg-success' : 'bg-border'}`} />
                      ) : null}
                    </div>
                    <div className={index < STEPS.length - 1 ? 'pb-4' : ''}>
                      <p className="text-sm font-semibold">{t(`landing.steps.${step.key}.title`)}</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {t(`landing.steps.${step.key}.desc`)}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </motion.div>
        </div>

        <ol className="grid gap-4 sm:grid-cols-2">
          {STEPS.map((step, index) => (
            <motion.li
              key={step.key}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
              data-morph-host
              className="rounded-xl border border-border bg-card p-5 shadow-soft-sm transition-shadow hover:shadow-soft-md"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <step.icon size={20} />
                </span>
                {/* The number is real information here: these stages are strictly ordered. */}
                <span className="text-xs font-semibold text-muted-foreground tabular">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>
              <h3 className="font-semibold">{t(`landing.steps.${step.key}.title`)}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {t(`landing.steps.${step.key}.desc`)}
              </p>
            </motion.li>
          ))}
        </ol>
      </section>

      {/* ── Eligibility ──────────────────────────────────────────────────── */}
      <section className="border-t border-border py-16">
        <div className="mb-8 space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">{t('landing.eligibilityTitle')}</h2>
          <p className="text-muted-foreground">{t('landing.eligibilitySubtitle')}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ELIGIBILITY.map((key) => (
            <div key={key} data-morph-host className="flex gap-3 rounded-xl border border-border bg-card p-5">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                <CheckIcon size={14} strokeWidth={2.6} />
              </span>
              <div>
                <h3 className="text-sm font-semibold">{t(`landing.eligibility.${key}.title`)}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {t(`landing.eligibility.${key}.desc`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────────────────── */}
      <section className="pb-20">
        <div className="flex flex-col items-center gap-5 rounded-2xl border border-border bg-primary px-6 py-12 text-center text-primary-foreground">
          <FollowUpIcon size={30} className="opacity-80" />
          <h2 className="max-w-xl text-2xl font-semibold text-balance">{t('landing.title')}</h2>
          <Button asChild size="lg" variant="secondary">
            <Link to={ROUTES.apply}>
              {t('landing.ctaApply')}
              <ArrowIcon size={17} className="rtl-flip" />
            </Link>
          </Button>
        </div>
      </section>
      </div>
    </div>
  )
}
