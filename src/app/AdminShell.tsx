import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useMatch } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { BrandMark, LangSwitch, ThemeToggle } from '@/components/shared'
import {
  ApplicationsIcon,
  ContractIcon,
  DashboardIcon,
  DisbursementIcon,
  FollowUpIcon,
  HomeIcon,
  InterviewIcon,
  ReportsIcon,
  SettingsIcon,
} from '@/components/icons'
import { useUiStore } from '@/stores/useUiStore'
import { cn } from '@/lib/utils'
import { ROUTES, type AdminNavItem } from './routes'
import { PageTransition } from './PageTransition'
import { NotificationBell } from './NotificationBell'

const NAV: AdminNavItem[] = [
  { path: ROUTES.admin, labelKey: 'nav.dashboard', icon: DashboardIcon, section: 'workflow' },
  { path: ROUTES.applications, labelKey: 'nav.applications', icon: ApplicationsIcon, section: 'workflow' },
  { path: ROUTES.interviews, labelKey: 'nav.interviews', icon: InterviewIcon, section: 'workflow' },
  { path: ROUTES.contracts, labelKey: 'nav.contracts', icon: ContractIcon, section: 'finance' },
  { path: ROUTES.disbursements, labelKey: 'nav.disbursements', icon: DisbursementIcon, section: 'finance' },
  { path: ROUTES.followUp, labelKey: 'nav.followUp', icon: FollowUpIcon, section: 'insights' },
  { path: ROUTES.reports, labelKey: 'nav.reports', icon: ReportsIcon, section: 'insights' },
  { path: ROUTES.settings, labelKey: 'nav.settings', icon: SettingsIcon, section: 'insights' },
]

const SECTIONS = ['workflow', 'finance', 'insights'] as const

function NavItems({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation()

  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4" aria-label={t('nav.adminArea')}>
      {SECTIONS.map((section) => (
        <div key={section} className="flex flex-col gap-1">
          {!collapsed ? (
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {t(`nav.sections.${section}`)}
            </p>
          ) : null}

          {NAV.filter((item) => item.section === section).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === ROUTES.admin}
              onClick={onNavigate}
              title={collapsed ? t(item.labelKey) : undefined}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  collapsed && 'justify-center px-0',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon active={isActive} size={18} />
                  {!collapsed ? <span className="truncate">{t(item.labelKey)}</span> : null}
                </>
              )}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )
}

function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation()
  return (
    <Link
      to={ROUTES.admin}
      // Collapsed, the mark is the only content — the label keeps the link named.
      aria-label={t('common.appShort')}
      className={cn('flex items-center gap-2.5 px-4 py-4', collapsed && 'justify-center px-0')}
    >
      <BrandMark size={32} className="text-sidebar-primary" />
      {!collapsed ? (
        <span className="truncate text-sm font-semibold leading-tight">{t('common.appShort')}</span>
      ) : null}
    </Link>
  )
}

/** Breadcrumb derived from the route table — never hand-written per page. */
function Breadcrumbs() {
  const { t } = useTranslation()
  const location = useLocation()
  const detail = useMatch(ROUTES.application())

  const current = NAV.find((item) =>
    item.path === ROUTES.admin
      ? location.pathname === ROUTES.admin
      : location.pathname.startsWith(item.path),
  )

  return (
    <nav aria-label="breadcrumb" className="hidden min-w-0 items-center gap-2 text-sm md:flex">
      <Link to={ROUTES.admin} className="text-muted-foreground hover:text-foreground">
        {t('nav.adminArea')}
      </Link>
      {current && current.path !== ROUTES.admin ? (
        <>
          <span className="text-muted-foreground/60" aria-hidden="true">
            /
          </span>
          <Link
            to={current.path}
            className={cn(
              'truncate',
              detail ? 'text-muted-foreground hover:text-foreground' : 'font-medium',
            )}
          >
            {t(current.labelKey)}
          </Link>
        </>
      ) : null}
      {detail ? (
        <>
          <span className="text-muted-foreground/60" aria-hidden="true">
            /
          </span>
          <span className="truncate font-medium tabular">{detail.params.id}</span>
        </>
      ) : null}
    </nav>
  )
}

/** Staff-facing shell: collapsible sidebar, breadcrumb header, notification bell. */
export function AdminShell() {
  const { t } = useTranslation()
  const location = useLocation()
  const lang = useUiStore((s) => s.lang)
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-dvh bg-background">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        {t('common.skipToContent')}
      </a>

      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 248 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="sticky top-0 hidden h-dvh shrink-0 flex-col border-e border-sidebar-border bg-sidebar lg:flex"
      >
        <SidebarBrand collapsed={collapsed} />
        <NavItems collapsed={collapsed} />

        <div
          className={cn(
            'flex items-center gap-1 border-t border-sidebar-border p-3',
            collapsed && 'flex-col',
          )}
        >
          <ThemeToggle />
          <LangSwitch />
          {/* The way back to the portal used to live here, where a collapsed
              sidebar — and every screen below `lg`, which has no sidebar at
              all — hid it completely. It is in the header now, always. */}
        </div>
      </motion.aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6">
          {/* Mobile drawer */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t('nav.openMenu')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </Button>
            </SheetTrigger>
            {/* The drawer opens from the reading-start edge in both directions. */}
            <SheetContent side={lang === 'ar' ? 'right' : 'left'} className="w-64 bg-sidebar p-0 [&>*]:min-w-0">
              <SheetTitle className="sr-only">{t('nav.adminArea')}</SheetTitle>
              <SidebarBrand collapsed={false} />
              <NavItems collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="hidden lg:inline-flex"
            aria-label={t('nav.toggleSidebar')}
            aria-expanded={!collapsed}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="rtl-flip">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M9 4v16" />
            </svg>
          </Button>

          <Breadcrumbs />

          <div className="ms-auto flex items-center gap-1">
            {/* Mirrors the admin button in the portal header: outline, icon
                before the label, present at every width. The button's own
                `gap` keeps the glyph on the reading-start side in both
                directions, and it is the officer's only route back on mobile. */}
            <Button asChild size="sm" variant="outline">
              <Link to={ROUTES.landing}>
                <HomeIcon size={16} />
                {t('nav.portal')}
              </Link>
            </Button>
            <NotificationBell />
            {/* Decorative avatar for the signed-in officer — the initials are a
                monogram, so they are hidden rather than read out as letters. */}
            <span
              aria-hidden="true"
              className="ms-1 flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
            >
              ف.أ
            </span>
          </div>
        </header>

        <main id="admin-main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <AnimatePresence mode="wait" initial={false}>
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
