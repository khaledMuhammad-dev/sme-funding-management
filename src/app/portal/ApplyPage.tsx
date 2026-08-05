import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared'
import { CheckIcon } from '@/components/icons'
import type { Application, Region, Sector } from '@/data/types'
import { nextApplicationRef, useSubmitApplication } from '@/lib/api'
import { useApplyWizardStore, WIZARD_STEPS, type WizardStep } from '@/stores/useApplyWizardStore'
import { useUiStore } from '@/stores/useUiStore'
import { useApplicantStore } from '@/stores/useApplicantStore'
import { WizardStepper } from '@/features/apply/WizardStepper'
import { PersonalStep } from '@/features/apply/PersonalStep'
import { ProjectStep } from '@/features/apply/ProjectStep'
import { DocumentsStep } from '@/features/apply/DocumentsStep'
import { TermsStep } from '@/features/apply/TermsStep'
import { ReviewStep } from '@/features/apply/ReviewStep'
import { ROUTES } from '../routes'

/** Turns the wizard draft into a real Application the demo store accepts. */
function draftToApplication(draft: ReturnType<typeof useApplyWizardStore.getState>): Application {
  const now = new Date().toISOString()
  // Reference continues the demo database's own numbering, so it can never
  // collide with a seeded application and send /track to the wrong file.
  const ref = nextApplicationRef()
  const seq = ref.slice(-4)

  return {
    id: `APP-NEW-${seq}`,
    ref,
    beneficiary: {
      id: `BEN-NEW-${seq}`,
      fullName: draft.personal.fullName,
      fullNameEn: draft.personal.fullName,
      nationalId: draft.personal.nationalId,
      phone: draft.personal.phone,
      email: draft.personal.email,
      region: draft.personal.region as Region,
      city: draft.personal.city,
      iban: draft.personal.iban,
      hasCommercialRegister: draft.personal.hasCommercialRegister,
      commercialRegisterNo: draft.personal.commercialRegisterNo || undefined,
    },
    project: {
      name: draft.project.name,
      nameEn: draft.project.name,
      sector: draft.project.sector as Sector,
      description: draft.project.description,
      requestedAmount: Number(draft.project.requestedAmount) || 0,
      monthlyIncome: Number(draft.project.monthlyIncome) || 0,
      experienceYears: Number(draft.project.experienceYears) || 0,
    },
    documents: draft.documents.map((doc, index) => ({
      id: `DOC-NEW-${seq}-${index}`,
      kind: doc.kind,
      fileName: doc.fileName,
      sizeKb: doc.sizeKb,
      uploadedAt: now,
    })),
    termsAccepted: draft.termsAccepted,
    status: 'new',
    timeline: [
      {
        id: `TL-NEW-${seq}`,
        kind: 'status_change',
        at: now,
        messageKey: 'timeline.submitted',
        params: { status: 'new' },
        actor: draft.personal.fullName,
        to: 'new',
      },
    ],
    createdAt: now,
    updatedAt: now,
  }
}

export default function ApplyPage() {
  const { t } = useTranslation()
  const lang = useUiStore((s) => s.lang)
  const step = useApplyWizardStore((s) => s.step)
  const direction = useApplyWizardStore((s) => s.direction)
  const goTo = useApplyWizardStore((s) => s.goTo)
  const submittedRef = useApplyWizardStore((s) => s.submittedRef)
  const setSubmittedRef = useApplyWizardStore((s) => s.setSubmittedRef)
  const clearDraft = useApplyWizardStore((s) => s.clearDraft)
  const reset = useApplyWizardStore((s) => s.reset)

  const [completed, setCompleted] = useState<WizardStep[]>([])
  const submit = useSubmitApplication()
  const rememberRef = useApplicantStore((s) => s.remember)

  // Slide direction follows reading order, so back always moves "backwards".
  const slide = (lang === 'ar' ? -1 : 1) * direction * 28

  const handleSubmit = () => {
    const draft = useApplyWizardStore.getState()
    const application = draftToApplication(draft)
    submit.mutate(application, {
      onSuccess: () => {
        setSubmittedRef(application.ref)
        // The reference is the applicant's only identity — remembering it here is
        // what lets the portal header show her a notification bell afterwards.
        rememberRef(application.ref)
        // The draft has become a real application — nothing left to restore.
        clearDraft()
        toast.success(t('apply.success.title'))
      },
    })
  }

  if (submittedRef) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 px-4 py-24 text-center">
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 18 }}
          className="flex size-16 items-center justify-center rounded-full bg-success-soft text-success"
        >
          <CheckIcon size={32} strokeWidth={2.2} />
        </motion.span>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{t('apply.success.title')}</h1>
          <p className="text-muted-foreground">{t('apply.success.subtitle')}</p>
        </div>

        <p
          data-testid="submitted-ref"
          className="rounded-xl border border-gold bg-gold-soft px-6 py-4 text-2xl font-semibold text-gold-ink tabular"
        >
          {submittedRef}
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to={`${ROUTES.track}?ref=${submittedRef}`}>{t('apply.success.trackNow')}</Link>
          </Button>
          <Button variant="outline" size="lg" onClick={reset}>
            {t('apply.success.newApplication')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader title={t('apply.title')} subtitle={t('apply.subtitle')} className="mb-6" />

      <div className="mb-6 rounded-xl border border-border bg-card p-3 shadow-soft-sm">
        <WizardStepper
          current={step}
          completed={completed.length ? completed : WIZARD_STEPS.slice(0, WIZARD_STEPS.indexOf(step))}
          onSelect={goTo}
        />
      </div>

      {/*
        `mode="wait"` unmounts the outgoing step before the next one mounts, so
        without a floor the card collapses to its padding for a frame and the
        page under it jumps. The floor is shorter than every real step, so it
        never adds empty space.
      */}
      <div className="min-h-96 rounded-xl border border-border bg-card p-5 shadow-soft-sm sm:p-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: slide }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -slide }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onAnimationComplete={() =>
              setCompleted((prev) =>
                prev.includes(step) ? prev : [...prev, ...WIZARD_STEPS.slice(0, WIZARD_STEPS.indexOf(step))],
              )
            }
          >
            {step === 'personal' ? <PersonalStep /> : null}
            {step === 'project' ? <ProjectStep /> : null}
            {step === 'documents' ? <DocumentsStep /> : null}
            {step === 'terms' ? <TermsStep /> : null}
            {step === 'review' ? (
              <ReviewStep onSubmit={handleSubmit} isPending={submit.isPending} />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">{t('apply.draftSaved')}</p>
    </div>
  )
}
