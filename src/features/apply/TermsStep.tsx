import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useApplyWizardStore } from '@/stores/useApplyWizardStore'
import { ArrowIcon, CheckIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

const CLAUSES = ['clause1', 'clause2', 'clause3', 'clause4'] as const

export function TermsStep() {
  const { t } = useTranslation()
  const accepted = useApplyWizardStore((s) => s.termsAccepted)
  const setAccepted = useApplyWizardStore((s) => s.setTermsAccepted)
  const next = useApplyWizardStore((s) => s.next)
  const back = useApplyWizardStore((s) => s.back)

  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrolledToEnd, setScrolledToEnd] = useState(false)

  // Acceptance unlocks only once the applicant has actually reached the end.
  const handleScroll = () => {
    const node = scrollRef.current
    if (!node) return
    if (node.scrollTop + node.clientHeight >= node.scrollHeight - 24) setScrolledToEnd(true)
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="font-semibold">{t('apply.terms.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('apply.terms.scrollHint')}</p>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        tabIndex={0}
        role="region"
        aria-label={t('apply.terms.title')}
        data-testid="terms-scroll"
        className="h-72 space-y-4 overflow-y-auto rounded-xl border border-border bg-muted/40 p-5 text-sm leading-relaxed"
      >
        <p className="font-medium">{t('contracts.doc.preamble')}</p>
        {CLAUSES.map((clause, index) => (
          <p key={clause}>
            <span className="me-1.5 font-semibold tabular">{index + 1}.</span>
            {t(`contracts.doc.${clause}`)}
          </p>
        ))}
        {/* Repeated so the scroll is real rather than a token gesture. */}
        {CLAUSES.map((clause, index) => (
          <p key={`${clause}-b`}>
            <span className="me-1.5 font-semibold tabular">{index + 5}.</span>
            {t(`contracts.doc.${clause}`)}
          </p>
        ))}
        <p className="flex items-center gap-2 pt-2 text-xs font-medium text-success">
          <CheckIcon size={14} strokeWidth={2.4} />
          {t('apply.terms.scrollHint')}
        </p>
      </div>

      <label
        className={cn(
          'flex items-start gap-3 rounded-xl border p-4 transition-colors',
          scrolledToEnd ? 'cursor-pointer border-border bg-card' : 'cursor-not-allowed border-border bg-muted/50 opacity-70',
        )}
      >
        <Checkbox
          checked={accepted}
          disabled={!scrolledToEnd}
          onCheckedChange={(checked) => setAccepted(checked === true)}
          className="mt-0.5"
        />
        <span className="text-sm">
          {t('apply.terms.accept')}
          {!scrolledToEnd ? (
            <span className="mt-1 block text-xs font-medium text-terracotta-ink">
              {t('apply.terms.mustScroll')}
            </span>
          ) : null}
        </span>
      </label>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" size="lg" onClick={back}>
          {t('common.back')}
        </Button>
        <Button type="button" size="lg" disabled={!accepted} onClick={next}>
          {t('common.next')}
          <ArrowIcon size={16} className="rtl-flip" />
        </Button>
      </div>
    </div>
  )
}
