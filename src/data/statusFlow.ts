import type { ApplicationStatus } from './types'

/**
 * The workflow engine's rule table. Every status change in the app is validated
 * against this — there is no other place a transition may be authorised.
 */
export const STATUS_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  new: ['incomplete', 'under_review'],
  incomplete: ['under_review'],
  under_review: ['awaiting_interview', 'rejected'],
  awaiting_interview: ['approved', 'rejected'],
  approved: ['disbursed'],
  rejected: [],
  disbursed: ['follow_up'],
  follow_up: [],
}

/** Statuses that end the journey — no further transition is possible. */
export const TERMINAL_STATUSES: ApplicationStatus[] = ['rejected', 'follow_up']

/** Ordered lifecycle used by the applicant-facing stepper on /track. */
export const HAPPY_PATH: ApplicationStatus[] = [
  'new',
  'under_review',
  'awaiting_interview',
  'approved',
  'disbursed',
  'follow_up',
]

export function allowedTransitions(from: ApplicationStatus): ApplicationStatus[] {
  return STATUS_TRANSITIONS[from] ?? []
}

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return allowedTransitions(from).includes(to)
}

export function isTerminal(status: ApplicationStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}

/**
 * Position on the happy path, used to render the stepper.
 * Off-path statuses (`incomplete`, `rejected`) report the step they branched from.
 */
export function happyPathIndex(status: ApplicationStatus): number {
  if (status === 'incomplete') return HAPPY_PATH.indexOf('new')
  if (status === 'rejected') return HAPPY_PATH.indexOf('awaiting_interview')
  return HAPPY_PATH.indexOf(status)
}

/** Transitions that must capture a reason before they are allowed to proceed. */
export const REASON_REQUIRED: ApplicationStatus[] = ['rejected', 'incomplete']

export function requiresReason(to: ApplicationStatus): boolean {
  return REASON_REQUIRED.includes(to)
}
