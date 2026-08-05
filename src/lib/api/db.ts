import { useDemoDataStore } from '@/stores/useDemoDataStore'

/**
 * Reads the demo database at *call* time.
 *
 * Query functions must never close over a store snapshot taken during render:
 * a mutation writes to the store and invalidates in the same tick, so the
 * refetch that follows would run the previous render's closure and resolve with
 * pre-mutation data — the change then looks like it never happened.
 */
export const db = () => useDemoDataStore.getState()
