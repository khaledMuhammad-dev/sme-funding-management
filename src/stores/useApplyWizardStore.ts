import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DocumentKind, Region, Sector } from '@/data/types'

export const WIZARD_STEPS = ['personal', 'project', 'documents', 'terms', 'review'] as const
export type WizardStep = (typeof WIZARD_STEPS)[number]

export interface PersonalDraft {
  fullName: string
  nationalId: string
  phone: string
  email: string
  region: Region | ''
  city: string
  iban: string
  hasCommercialRegister: boolean
  commercialRegisterNo: string
}

export interface ProjectDraft {
  name: string
  sector: Sector | ''
  description: string
  requestedAmount: number | ''
  monthlyIncome: number | ''
  experienceYears: number | ''
}

export interface DocDraft {
  kind: DocumentKind
  fileName: string
  sizeKb: number
}

interface WizardState {
  step: WizardStep
  /** Which way the next step should slide in — RTL flips this at render time. */
  direction: 1 | -1
  personal: PersonalDraft
  project: ProjectDraft
  documents: DocDraft[]
  termsAccepted: boolean
  submittedRef: string | null

  goTo: (step: WizardStep) => void
  next: () => void
  back: () => void
  setPersonal: (values: PersonalDraft) => void
  setProject: (values: ProjectDraft) => void
  addDocument: (doc: DocDraft) => void
  removeDocument: (kind: DocumentKind) => void
  setTermsAccepted: (accepted: boolean) => void
  setSubmittedRef: (ref: string) => void
  /** Empties the draft after a successful submit — the success screen stays put. */
  clearDraft: () => void
  reset: () => void
}

const emptyPersonal: PersonalDraft = {
  fullName: '',
  nationalId: '',
  phone: '',
  email: '',
  region: '',
  city: '',
  iban: '',
  hasCommercialRegister: false,
  commercialRegisterNo: '',
}

const emptyProject: ProjectDraft = {
  name: '',
  sector: '',
  description: '',
  requestedAmount: '',
  monthlyIncome: '',
  experienceYears: '',
}

const emptyDraft = {
  step: 'personal' as WizardStep,
  direction: 1 as const,
  personal: emptyPersonal,
  project: emptyProject,
  documents: [] as DocDraft[],
  termsAccepted: false,
}

/**
 * The draft is persisted so a refresh mid-wizard never costs the applicant her
 * answers. The submitted reference is deliberately NOT persisted — it belongs to
 * the session that produced it, and the draft is cleared once the form is sent.
 */
export const useApplyWizardStore = create<WizardState>()(
  persist(
    (set, get) => ({
      ...emptyDraft,
      submittedRef: null,

      goTo: (step) => {
        const from = WIZARD_STEPS.indexOf(get().step)
        const to = WIZARD_STEPS.indexOf(step)
        set({ step, direction: to >= from ? 1 : -1 })
      },
      next: () => {
        const i = WIZARD_STEPS.indexOf(get().step)
        if (i < WIZARD_STEPS.length - 1) set({ step: WIZARD_STEPS[i + 1], direction: 1 })
      },
      back: () => {
        const i = WIZARD_STEPS.indexOf(get().step)
        if (i > 0) set({ step: WIZARD_STEPS[i - 1], direction: -1 })
      },

      setPersonal: (personal) => set({ personal }),
      setProject: (project) => set({ project }),
      addDocument: (doc) =>
        set({ documents: [...get().documents.filter((d) => d.kind !== doc.kind), doc] }),
      removeDocument: (kind) => set({ documents: get().documents.filter((d) => d.kind !== kind) }),
      setTermsAccepted: (termsAccepted) => set({ termsAccepted }),
      setSubmittedRef: (submittedRef) => set({ submittedRef }),

      clearDraft: () => set({ ...emptyDraft }),
      reset: () => set({ ...emptyDraft, submittedRef: null }),
    }),
    {
      name: 'apply-draft',
      partialize: (s) => ({
        step: s.step,
        personal: s.personal,
        project: s.project,
        documents: s.documents,
        termsAccepted: s.termsAccepted,
      }),
    },
  ),
)
