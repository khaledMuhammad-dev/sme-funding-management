import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { BrandMark, LangSwitch, ThemeToggle } from '@/components/shared'
import { UserIcon } from '@/components/icons'
import { PortalNotificationBell } from '@/features/notifications/PortalNotificationBell'
import { useApplicationsByRefs } from '@/lib/api'
import { useApplicantStore } from '@/stores/useApplicantStore'
import { useUiStore } from '@/stores/useUiStore'
import { ROUTES } from './routes'
import { PageTransition } from './PageTransition'
import { cn } from '@/lib/utils'

/** Wordmark: the client's mark in brand ink, next to the short app name. */
function Wordmark() {
  const { t } = useTranslation()
  return (
    // The name is hidden below `sm`, so the label carries it on small screens.
    <Link
      to={ROUTES.landing}
      aria-label={t('common.appShort')}
      className="flex items-center gap-2.5 font-semibold"
    >
      {/* Decorative — the app name is right beside it as real text. */}
      <BrandMark size={32} className="text-primary" />
      <span className="hidden text-sm leading-tight sm:block">{t('common.appShort')}</span>
    </Link>
  )
}

interface PortalNavItem {
  to: string
  key: string
  end: boolean
}

/*
  Every entry is permanent. The portal presents one signed-in applicant, and a
  signed-in user's own sections do not appear and disappear underneath him —
  "my applications" and "my contracts" with nothing in them show their empty
  state, which is a normal signed-in experience.
*/
const NAV: PortalNavItem[] = [
  { to: ROUTES.landing, key: 'nav.home', end: true },
  { to: ROUTES.apply, key: 'nav.apply', end: false },
  { to: ROUTES.track, key: 'nav.track', end: false },
  { to: ROUTES.myApplications, key: 'nav.myApplications', end: false },
  { to: ROUTES.myContracts, key: 'nav.myContracts', end: false },
]

/** First letters of the first two words — a monogram, not readable text. */
function monogram(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => [...word][0])
    .join('')
}

/**
 * The signed-in applicant, in the same register as the officer chip in the
 * admin shell.
 *
 * There is no authentication in this demo, so the name is read from the most
 * recently remembered application — the same reference set the bell and the
 * applications list already work from. Before anything has been submitted there
 * is no name to show, so it falls back to a neutral account label rather than
 * inventing a person.
 */
function SignedInChip() {
  const { t } = useTranslation()
  const lang = useUiStore((s) => s.lang)
  const refs = useApplicantStore((s) => s.refs)

  // Same query key as the bell and the list, so this shares their one read.
  const { data: rows = [] } = useApplicationsByRefs(refs)
  // `rows` follows `refs`, which is newest-first; a reference whose record the
  // in-memory demo database no longer holds falls through to the next one.
  const application = rows.find((row) => row.application)?.application ?? null
  const name = application
    ? lang === 'ar'
      ? application.beneficiary.fullName
      : application.beneficiary.fullNameEn
    : ''
  const label = name || t('nav.account')

  return (
    <div
      className="flex min-w-0 items-center gap-2 ps-1"
      data-testid="portal-identity"
      data-named={name ? 'true' : 'false'}
    >
      {/* The whole chip is one piece of information; the monogram and the
          truncated name are decoration around this label. */}
      <span className="sr-only">{name ? t('nav.signedInAs', { name }) : label}</span>
      <span
        aria-hidden="true"
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
          name ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
        )}
      >
        {name ? monogram(name) : <UserIcon size={16} />}
      </span>
      <span
        aria-hidden="true"
        data-testid="portal-identity-name"
        className="hidden max-w-36 truncate text-sm font-medium lg:block"
      >
        {label}
      </span>
    </div>
  )
}

/** Beneficiary-facing shell: top nav, centred container, mobile-first. */
export function PortalShell() {
  const { t } = useTranslation()
  const location = useLocation()

  return (
    <div className="relative flex min-h-dvh flex-col grain">
      <a
        href="#portal-main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        {t('common.skipToContent')}
      </a>

      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Wordmark />

          <nav
            className="ms-auto flex min-w-0 flex-wrap items-center justify-end gap-0.5"
            aria-label={t('nav.portal')}
          >
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )
                }
              >
                {t(item.key)}
              </NavLink>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-1">
            {/* Always in the header — this is where the signed-in applicant's
                messages arrive, before as well as after there are any. */}
            <PortalNotificationBell />
            <ThemeToggle />
            <LangSwitch />
            <Button asChild size="sm" variant="outline" className="hidden md:inline-flex">
              <Link to={ROUTES.admin}>{t('nav.adminArea')}</Link>
            </Button>
            <SignedInChip />
          </div>
        </div>
      </header>

      <main id="portal-main" className="relative z-10 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </main>

      <footer className="relative z-10 border-t border-border py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>{t('common.appName')}</p>
          <Link to={ROUTES.admin} className="font-medium hover:text-foreground md:hidden">
            {t('nav.adminArea')}
          </Link>
        </div>
      </footer>
    </div>
  )
}
