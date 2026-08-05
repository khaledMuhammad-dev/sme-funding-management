import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ApplicantState {
  /**
   * Every reference the portal knows about, newest first.
   *
   * There is no authentication in this demo: the portal presents a single
   * signed-in applicant, and this list is how it works out *which* applications
   * are his — submitted through the wizard, or looked up on `/track`. One
   * applicant may apply more than once, so this is a list, and the newest entry
   * is the one the header identity is drawn from.
   */
  refs: string[]
  /**
   * The reference currently being looked at — the last one submitted or looked
   * up. Kept as its own field (rather than "the first of `refs`") because the
   * header bell shows the messages of *one* application, and clicking through
   * the list must not reorder the list itself.
   */
  ref: string | null
  /**
   * Notification ids already seen in the portal bell. Read state is local to the
   * device on purpose — the demo database's `read` flag belongs to the *staff*
   * inbox, and the applicant clearing his bell must not clear theirs.
   *
   * Ids are unique across the whole demo database, so one flat list stays
   * correct with several applications in play: it is "messages this browser has
   * seen", and switching between applications no longer wipes it (which used to
   * make already-read messages come back unread on the way back).
   */
  readIds: string[]
  /** Appends a reference (de-duplicated) and makes it the active one. */
  remember: (ref: string) => void
  /*
    Nothing in the portal surfaces these any more: the interface presents one
    signed-in applicant, and an "is this you? / forget" control is exactly the
    shared-browser reading the client asked us to remove. They stay as the
    store's reset path — used by tests and by a demo reset — not as a feature.
  */
  /** Drops one reference, or — with no argument — every one. */
  forget: (ref?: string) => void
  /** Drops every known reference and read mark. */
  forgetAll: () => void
  markRead: (ids: string[]) => void
}

const normalize = (ref: string) => ref.trim().toUpperCase()

type PersistedShape = Partial<Pick<ApplicantState, 'refs' | 'ref' | 'readIds'>>

/** Set when a v0 value was repaired on the way in, so it can be rewritten once. */
let repairedLegacy = false

/** Accepts either persisted shape and always returns the list-based one. */
function fromLegacy(persisted: unknown): PersistedShape {
  const state = (persisted ?? {}) as PersistedShape
  if (Array.isArray(state.refs)) return state
  const legacy = state.ref ? normalize(state.ref) : null
  // Nothing to rewrite for a browser that simply has no persisted value yet.
  if (legacy) repairedLegacy = true
  return { ...state, ref: legacy, refs: legacy ? [legacy] : [], readIds: state.readIds ?? [] }
}

/**
 * Applicant-side session stand-in — the presentational stand-in for "the signed-in
 * applicant". Deliberately separate from `useDemoDataStore` (the demo *database*):
 * this is only which applications the portal treats as his.
 */
export const useApplicantStore = create<ApplicantState>()(
  persist(
    (set, get) => ({
      refs: [],
      ref: null,
      readIds: [],
      remember: (ref) => {
        const next = normalize(ref)
        if (!next) return
        const { refs, ref: active } = get()
        const known = refs.includes(next)
        if (known && active === next) return
        // An already-known reference keeps its place: the list is ordered by when
        // each application was first seen, and re-opening one must not shuffle it.
        set({ ref: next, refs: known ? refs : [next, ...refs] })
      },
      forget: (ref) => {
        if (ref === undefined) {
          get().forgetAll()
          return
        }
        const target = normalize(ref)
        const refs = get().refs.filter((r) => r !== target)
        // Read marks are keyed by notification id, not by application, so there is
        // nothing per-application to clean up here.
        set({ refs, ref: get().ref === target ? (refs[0] ?? null) : get().ref })
      },
      forgetAll: () => set({ refs: [], ref: null, readIds: [] }),
      markRead: (ids) => set((state) => ({ readIds: [...new Set([...state.readIds, ...ids])] })),
    }),
    {
      name: 'applicant',
      partialize: (s) => ({ refs: s.refs, ref: s.ref, readIds: s.readIds }),
      version: 1,
      /*
        v0 stored a single `{ ref, readIds }` and — having declared no `version` —
        wrote `{"state":{…}}` with no version field at all. zustand only calls
        `migrate` when the stored version is a *number*, so that value would sail
        past it and rehydrate a state with no `refs`. Hence both hooks:

        - `migrate` upgrades any numbered older version, and
        - `merge` repairs the version-less v0 shape on the way in.

        Either way the remembered reference survives as a one-item list and stays
        the active one — losing it would lose her only way back to her application.
      */
      migrate: (persisted, version) =>
        (version >= 1 ? persisted : fromLegacy(persisted)) as ApplicantState,
      merge: (persisted, current) => ({ ...current, ...fromLegacy(persisted) }),
      /*
        A repaired v0 value only lives in memory until something writes, so it
        would be repaired again on every load. One no-op write through the store's
        own setter puts the new shape (and `version: 1`) in localStorage.

        `markRead([])` rather than `useApplicantStore.setState`: hydration runs
        synchronously inside `create()`, where that binding does not exist yet.
      */
      onRehydrateStorage: () => (state) => {
        if (state && repairedLegacy) {
          repairedLegacy = false
          state.markRead([])
        }
      },
    },
  ),
)
