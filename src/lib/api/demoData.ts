import { useMutation } from '@tanstack/react-query'
import { useDemoDataStore } from '@/stores/useDemoDataStore'
import { simulateMutation } from './simulateFetch'
import { db } from './db'
import { useInvalidate } from './useInvalidate'

/** Live row counts, for the demo-data panel in settings. */
export function useDemoDataCounts() {
  const applications = useDemoDataStore((s) => s.applications)
  const interviews = useDemoDataStore((s) => s.interviews)
  const contracts = useDemoDataStore((s) => s.contracts)
  const disbursements = useDemoDataStore((s) => s.disbursements)
  const followUps = useDemoDataStore((s) => s.followUps)
  const notifications = useDemoDataStore((s) => s.notifications)

  return { applications, interviews, contracts, disbursements, followUps, notifications } as const
}

/**
 * Empties or re-seeds the whole demo database.
 *
 * Goes through the API layer like every other mutation so the query cache is
 * invalidated afterwards — resetting the store without that would leave every
 * open screen rendering rows that no longer exist.
 */
export function useResetDemoData() {
  const startClean = useDemoDataStore((s) => s.startClean)
  const restoreDemoData = useDemoDataStore((s) => s.restoreDemoData)
  const { invalidateAll, client } = useInvalidate()

  return useMutation({
    mutationFn: async (mode: 'empty' | 'seed') => simulateMutation(mode),
    onSuccess: (mode) => {
      if (mode === 'empty') startClean()
      else restoreDemoData()

      // A hard reset changes every list at once, so drop the whole cache rather
      // than the application-scoped keys `invalidateAll` knows about.
      void client.invalidateQueries()
      invalidateAll()
    },
  })
}

/** True when the app was opened with `?empty=1` — used once, at boot. */
export function wantsEmptyStart(search = window.location.search) {
  const value = new URLSearchParams(search).get('empty')
  return value === '1' || value === 'true'
}

/** Applies `?empty=1` before the first render, so no seeded row is ever painted. */
export function applyEmptyStart() {
  if (wantsEmptyStart()) db().startClean()
}
