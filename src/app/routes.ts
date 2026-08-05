import type { ComponentType } from 'react'

/**
 * The route table — the single source of truth for paths.
 * Navigation, breadcrumbs and links all read from here; no path string is
 * written twice in the app.
 */
export const ROUTES = {
  landing: '/',
  apply: '/apply',
  track: '/track',
  myApplications: '/my-applications',
  myContracts: '/my-contracts',
  followUpForm: (id = ':id') => `/follow-up/${id}`,

  admin: '/admin',
  applications: '/admin/applications',
  application: (id = ':id') => `/admin/applications/${id}`,
  interviews: '/admin/interviews',
  contracts: '/admin/contracts',
  disbursements: '/admin/disbursements',
  followUp: '/admin/follow-up',
  reports: '/admin/reports',
  settings: '/admin/settings',
} as const

export interface AdminNavItem {
  path: string
  labelKey: string
  icon: ComponentType<{ active?: boolean; size?: number }>
  section: 'workflow' | 'finance' | 'insights'
}
