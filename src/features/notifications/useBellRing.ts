import { useEffect, useRef, useState } from 'react'

/** How long a bell keeps swinging after a message goes out. */
export const BELL_RING_MS = 1400

/**
 * The badge number changing is easy to miss in a demo, so the bell physically
 * swings when a new message arrives. Tracked by newest id rather than by count:
 * marking everything read also changes the unread count and must not ring.
 *
 * Shared by the admin header bell and the portal bell so both behave identically.
 *
 * The stop timer deliberately lives in a ref and is only cleared on unmount.
 * Owning it through the effect's cleanup looks tidier but is wrong: the effect
 * re-runs whenever `newestId` changes, including to `undefined` while a refetch
 * has no data yet. The cleanup then cancelled the pending stop and the guard
 * returned early, so the bell swung forever — and because the popover is
 * anchored to the bell, it never stopped moving either.
 */
export function useBellRing(newestId: string | undefined) {
  const seenNewest = useRef<string | undefined>(newestId)
  const timer = useRef<number | undefined>(undefined)
  const [ringing, setRinging] = useState(false)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  useEffect(() => {
    // An empty moment mid-refetch is not "no messages" — keep the last id.
    if (!newestId || seenNewest.current === newestId) return

    const isFirstRender = seenNewest.current === undefined
    seenNewest.current = newestId
    if (isFirstRender) return

    setRinging(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setRinging(false), BELL_RING_MS)
  }, [newestId])

  return ringing
}
