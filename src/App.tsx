import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { Toaster } from "@/components/ui/sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useLangEffect, useThemeEffect } from "@/components/shared";
import { AdminShell } from "./app/AdminShell";
import { PortalShell } from "./app/PortalShell";
import { ROUTES } from "./app/routes";

/* Route pages are split so the landing page paints before the admin bundle. */
const LandingPage = lazy(() => import("./app/portal/LandingPage"));
const ApplyPage = lazy(() => import("./app/portal/ApplyPage"));
const TrackPage = lazy(() => import("./app/portal/TrackPage"));
const MyApplicationsPage = lazy(
  () => import("./app/portal/MyApplicationsPage"),
);
const MyContractsPage = lazy(() => import("./app/portal/MyContractsPage"));
const FollowUpFormPage = lazy(() => import("./app/portal/FollowUpFormPage"));
const NotFoundPage = lazy(() => import("./app/portal/NotFoundPage"));

const DashboardPage = lazy(() => import("./app/admin/DashboardPage"));
const ApplicationsPage = lazy(() => import("./app/admin/ApplicationsPage"));
const ApplicationDetailPage = lazy(
  () => import("./app/admin/ApplicationDetailPage"),
);
const InterviewsPage = lazy(() => import("./app/admin/InterviewsPage"));
const ContractsPage = lazy(() => import("./app/admin/ContractsPage"));
const DisbursementsPage = lazy(() => import("./app/admin/DisbursementsPage"));
const FollowUpPage = lazy(() => import("./app/admin/FollowUpPage"));
const ReportsPage = lazy(() => import("./app/admin/ReportsPage"));
const SettingsPage = lazy(() => import("./app/admin/SettingsPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The demo's "server" is in memory, so nothing goes stale on its own.
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

/**
 * Companion to `window.__demoStore` in `main.tsx`.
 *
 * A test that drives a mutation straight on the store — the applicant's
 * signature, while her portal mount point is still pending — has to be able to
 * tell the cache the demo's "server" moved underneath it, exactly as the
 * mutation hooks do. Dev/preview only; the client build never exposes it.
 */
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__queryClient = queryClient;
}

/** Matches the page frame so switching routes never shifts the layout. */
function RouteFallback() {
  return (
    <div className="space-y-6 p-2">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-4 w-96" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}

function AppEffects() {
  useThemeEffect();
  useLangEffect();
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/*
        Framer animates through inline styles in JS, so the global
        `prefers-reduced-motion` rule in `index.css` — which only reaches CSS
        animations and transitions — never touched page transitions, the landing
        page, the timeline or any other motion component. `reducedMotion="user"`
        makes every one of them honour the OS setting in one place, instead of
        each component remembering to ask.
      */}
      <MotionConfig reducedMotion="user">
        <AppEffects />
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route element={<PortalShell />}>
                <Route path={ROUTES.landing} element={<LandingPage />} />
                <Route path={ROUTES.apply} element={<ApplyPage />} />
                <Route path={ROUTES.track} element={<TrackPage />} />
                <Route
                  path={ROUTES.myApplications}
                  element={<MyApplicationsPage />}
                />
                <Route
                  path={ROUTES.myContracts}
                  element={<MyContractsPage />}
                />
                <Route
                  path={ROUTES.followUpForm()}
                  element={<FollowUpFormPage />}
                />
                <Route path="*" element={<NotFoundPage />} />
              </Route>

              <Route element={<AdminShell />}>
                <Route path={ROUTES.admin} element={<DashboardPage />} />
                <Route
                  path={ROUTES.applications}
                  element={<ApplicationsPage />}
                />
                <Route
                  path={ROUTES.application()}
                  element={<ApplicationDetailPage />}
                />
                <Route path={ROUTES.interviews} element={<InterviewsPage />} />
                <Route path={ROUTES.contracts} element={<ContractsPage />} />
                <Route
                  path={ROUTES.disbursements}
                  element={<DisbursementsPage />}
                />
                <Route path={ROUTES.followUp} element={<FollowUpPage />} />
                <Route path={ROUTES.reports} element={<ReportsPage />} />
                <Route path={ROUTES.settings} element={<SettingsPage />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster position="top-center" richColors closeButton />
      </MotionConfig>
    </QueryClientProvider>
  );
}
