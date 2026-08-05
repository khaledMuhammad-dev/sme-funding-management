import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { APPLICATION_SCOPE } from './queryKeys'

/**
 * One place that knows what to refetch after a mutation.
 * Mutation hooks call `invalidateAll()` rather than listing keys themselves.
 */
export function useInvalidate() {
  const client = useQueryClient()

  const invalidateAll = useCallback(() => {
    for (const key of APPLICATION_SCOPE) {
      void client.invalidateQueries({ queryKey: key as unknown as string[] })
    }
    for (const key of [
      ['interviews'],
      ['interview-for'],
      ['contracts'],
      ['contract-for'],
      ['disbursements'],
      ['disbursement-for'],
      ['follow-ups'],
      ['follow-ups-for'],
      ['follow-up'],
      ['notifications-for'],
    ]) {
      void client.invalidateQueries({ queryKey: key })
    }
  }, [client])

  return { invalidateAll, client }
}
