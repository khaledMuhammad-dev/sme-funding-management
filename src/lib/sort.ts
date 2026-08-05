/**
 * Chronological comparators with a deterministic tie-break.
 *
 * `(a, b) => (a.sentAt < b.sentAt ? 1 : -1)` reads fine but is an *inconsistent*
 * comparator: for two equal timestamps it answers "a first" whichever way it is
 * asked, so equal items can swap places between renders. That is not academic
 * here — a notification fans out to several channels in the same tick, so those
 * records share a `sentAt` exactly. A list whose first element keeps changing
 * identity re-triggers anything keyed on it (the bell's ring, for one) forever.
 *
 * Always pass a tie-break for data that can share a timestamp.
 */
export function byDate<T>(
  pick: (item: T) => string,
  order: 'asc' | 'desc' = 'asc',
  tiebreak?: (item: T) => string,
) {
  const direction = order === 'asc' ? 1 : -1

  return (a: T, b: T): number => {
    const left = pick(a)
    const right = pick(b)
    if (left !== right) return left < right ? -direction : direction

    if (!tiebreak) return 0
    const leftId = tiebreak(a)
    const rightId = tiebreak(b)
    if (leftId === rightId) return 0
    return leftId < rightId ? -1 : 1
  }
}

/** Newest first, ties broken by id — the ordering every inbox-style list wants. */
export function newestFirst<T extends { id: string }>(pick: (item: T) => string) {
  return byDate<T>(pick, 'desc', (item) => item.id)
}
