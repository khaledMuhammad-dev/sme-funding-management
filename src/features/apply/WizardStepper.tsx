import { useTranslation } from 'react-i18next'
import { CheckIcon } from '@/components/icons'
import { WIZARD_STEPS, type WizardStep } from '@/stores/useApplyWizardStore'
import { cn } from '@/lib/utils'

export interface WizardStepperProps {
  current: WizardStep
  /** Steps already validated — only these are clickable. */
  completed: WizardStep[]
  onSelect: (step: WizardStep) => void
}

/** Horizontal progress rail for the apply wizard. */
export function WizardStepper({ current, completed, onSelect }: WizardStepperProps) {
  const { t } = useTranslation()
  const currentIndex = WIZARD_STEPS.indexOf(current)

  return (
    <ol className="-mx-1 flex w-full min-w-0 items-center gap-1 overflow-x-auto px-1 pb-1">
      {WIZARD_STEPS.map((step, index) => {
        const isDone = completed.includes(step) && index < currentIndex
        const isCurrent = step === current
        const reachable = isDone || isCurrent

        return (
          <li key={step} className="flex min-w-0 flex-1 items-center gap-1">
            <button
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onSelect(step)}
              aria-current={isCurrent ? 'step' : undefined}
              className={cn(
                'flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-start transition-colors',
                reachable ? 'cursor-pointer hover:bg-accent' : 'cursor-not-allowed opacity-60',
              )}
            >
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular',
                  isDone
                    ? 'bg-success-soft text-success'
                    : isCurrent
                      ? 'bg-terracotta text-terracotta-foreground'
                      : 'border border-border bg-muted text-muted-foreground',
                )}
              >
                {isDone ? <CheckIcon size={13} strokeWidth={2.8} /> : index + 1}
              </span>
              <span
                className={cn(
                  'hidden truncate text-xs font-medium sm:block',
                  isCurrent ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {t(`apply.steps.${step}`)}
              </span>
            </button>

            {index < WIZARD_STEPS.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn('h-px w-4 shrink-0', isDone ? 'bg-success' : 'bg-border')}
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
