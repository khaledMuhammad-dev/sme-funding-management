import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CriterionKey, NotificationChannel, NotificationTrigger } from '@/data/types'
import { DEFAULT_WEIGHTS } from '@/data/fixtures'
import { DEFAULT_CHANNELS } from '@/data/notificationTemplates'
import { DEFAULT_ORG_SIGNATORY_NAME, DEFAULT_ORG_SIGNATURE_IMAGE } from '@/data/orgSignature'

/**
 * The organisation's single, centrally configured signature.
 *
 * It is applied automatically to every contract the programme issues — the
 * funding company never draws a signature per applicant. Only the beneficiary
 * signs interactively, and she does it in her own portal.
 */
export interface OrgSignature {
  /** Name of the authorised signatory printed under the mark. */
  name: string
  /** Data-URL of the signature mark, or `null` if only a name is configured. */
  image: string | null
}

export const DEFAULT_ORG_SIGNATURE: OrgSignature = {
  name: DEFAULT_ORG_SIGNATORY_NAME,
  image: DEFAULT_ORG_SIGNATURE_IMAGE,
}

interface SettingsState {
  weights: Record<CriterionKey, number>
  channels: Record<NotificationTrigger, NotificationChannel[]>
  orgSignature: OrgSignature
  setWeight: (key: CriterionKey, value: number) => void
  setWeights: (weights: Record<CriterionKey, number>) => void
  resetWeights: () => void
  toggleChannel: (trigger: NotificationTrigger, channel: NotificationChannel) => void
  setOrgSignature: (signature: OrgSignature) => void
  resetOrgSignature: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      weights: { ...DEFAULT_WEIGHTS },
      channels: { ...DEFAULT_CHANNELS },
      orgSignature: { ...DEFAULT_ORG_SIGNATURE },

      setWeight: (key, value) => set({ weights: { ...get().weights, [key]: value } }),
      setWeights: (weights) => set({ weights }),
      resetWeights: () => set({ weights: { ...DEFAULT_WEIGHTS } }),

      toggleChannel: (trigger, channel) => {
        const current = get().channels[trigger]
        const next = current.includes(channel)
          ? current.filter((c) => c !== channel)
          : [...current, channel]
        set({ channels: { ...get().channels, [trigger]: next } })
      },

      setOrgSignature: (signature) => set({ orgSignature: signature }),
      resetOrgSignature: () => set({ orgSignature: { ...DEFAULT_ORG_SIGNATURE } }),
    }),
    {
      name: 'org-signature',
      /*
        Only the signatory is persisted. Scoring weights and notification
        channels are demo knobs that every session is expected to start from
        their defaults — carrying those across reloads would quietly change the
        numbers a presenter walks the client through.
      */
      partialize: (state) => ({ orgSignature: state.orgSignature }),
    },
  ),
)

/** A contract may only be issued once the programme has a signatory on file. */
export function hasOrgSignatory(signature: OrgSignature) {
  return signature.name.trim().length > 0
}

export function weightsTotal(weights: Record<CriterionKey, number>) {
  return Object.values(weights).reduce((sum, w) => sum + w, 0)
}
