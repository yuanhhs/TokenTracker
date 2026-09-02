import React, { lazy, Suspense, useCallback, useMemo, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import { useLocale } from "./hooks/useLocale.js";
import { ThemeProvider } from "./ui/foundation/ThemeProvider.jsx";
import { ToastProvider } from "./ui/components/Toast.jsx";
import { getBackendBaseUrl } from "./lib/config";
import { isMockEnabled } from "./lib/mock-mode";
import { isScreenshotModeEnabled } from "./lib/screenshot-mode";
import { AppLayout } from "./ui/components/Sidebar.jsx";
import {
  markDashboardMainContentVisible,
  preloadDashboardPageResources,
} from "./lib/dashboard-preload.js";

const nullComponent = () => null;
const CommandPalette = lazy(() =>
  import("./ui/dashboard/components/CommandPalette.jsx")
    .then((m) => ({ default: m.CommandPalette }))
    .catch(() => ({ default: nullComponent })),
);

const DashboardPage = lazy(() =>
  import("./pages/DashboardPage.jsx").then((m) => ({ default: m.DashboardPage })),
);
const IpCheckPage = lazy(() => import("./pages/IpCheckPage.jsx"));
const ServiceStatusPage = lazy(() => import("./pages/ServiceStatusPage.jsx"));
const LandingPage = lazy(() =>
  import("./pages/LandingPage.jsx").then((m) => ({ default: m.LandingPage })),
);
const LimitsPage = lazy(() =>
  import("./pages/LimitsPage.jsx").then((m) => ({ default: m.LimitsPage })),
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage.jsx").then((m) => ({ default: m.SettingsPage })),
);
const SkillsPage = lazy(() =>
  import("./pages/SkillsPage.jsx").then((m) => ({ default: m.SkillsPage })),
);
const SessionsPage = lazy(() =>
  import("./pages/SessionsPage.jsx").then((m) => ({ default: m.SessionsPage })),
);
const WrappedPage = lazy(() => import("./pages/WrappedPage.jsx"));

const DASHBOARD_PATHS = new Set([
  "/",
  "/dashboard",
  "/limits",
  "/settings",
  "/skills",
  "/sessions",
  "/ip-check",
  "/service-status",
]);

export default function App() {
  const { resolvedLocale } = useLocale();
  const location = useLocation();
  const dashboardMainContentVisibleRef = useRef(false);
  const dashboardResourcePreloadStartedRef = useRef(false);
  const mockEnabled = isMockEnabled();
  const screenshotMode = useMemo(() => {
    if (typeof window === "undefined") return false;
    return isScreenshotModeEnabled(window.location.search);
  }, []);
  const pathname = location?.pathname || "/";
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const isLocalMode =
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1", "::1", "[::1]"].includes(window.location.hostname);
  const pageUrl = typeof window === "undefined" ? null : new URL(window.location.href);
  const sharePathname = pageUrl?.pathname.replace(/\/+$/, "") || "/";
  const shareMatch = sharePathname.match(/^\/share\/([^/?#]+)$/i);
  const publicToken = shareMatch?.[1] || pageUrl?.searchParams.get("token") || null;
  const publicMode =
    sharePathname === "/share" ||
    sharePathname === "/share.html" ||
    sharePathname.startsWith("/share/");

  const isDashboardPath = DASHBOARD_PATHS.has(normalizedPath);
  const onMainContentVisible = useCallback(() => {
    if (!isDashboardPath) return;
    if (!dashboardMainContentVisibleRef.current) {
      dashboardMainContentVisibleRef.current = true;
      markDashboardMainContentVisible();
    }
    if (!dashboardResourcePreloadStartedRef.current) {
      dashboardResourcePreloadStartedRef.current = true;
      void preloadDashboardPageResources();
    }
  }, [isDashboardPath]);

  // The hosted site is informational; the usable dashboard is intentionally
  // local-only now that account authentication and cloud data are gone.
  if (!isLocalMode && !mockEnabled && !screenshotMode && isDashboardPath && !publicMode) {
    return <Navigate to="/landing" replace />;
  }

  let PageComponent = DashboardPage;
  if (normalizedPath === "/landing") PageComponent = LandingPage;
  else if (normalizedPath === "/limits") PageComponent = LimitsPage;
  else if (normalizedPath === "/settings") PageComponent = SettingsPage;
  else if (normalizedPath === "/skills") PageComponent = SkillsPage;
  else if (normalizedPath === "/sessions") PageComponent = SessionsPage;
  else if (normalizedPath === "/ip-check") PageComponent = IpCheckPage;
  else if (normalizedPath === "/service-status") PageComponent = ServiceStatusPage;
  else if (normalizedPath === "/wrapped") PageComponent = WrappedPage;

  const showSidebar = isLocalMode && isDashboardPath;
  // /landing and /wrapped render standalone: PageComponent is already resolved
  // to them above, and neither takes the dashboard data props.
  const isStandalonePage = normalizedPath === "/landing" || normalizedPath === "/wrapped";
  let content = <PageComponent />;
  if (!isStandalonePage) {
    content = (
      <PageComponent
        key={resolvedLocale}
        baseUrl={getBackendBaseUrl()}
        publicMode={publicMode}
        publicToken={publicToken}
        onMainContentVisible={onMainContentVisible}
      />
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <Suspense fallback={null}>
            {showSidebar ? <AppLayout>{content}</AppLayout> : content}
          </Suspense>
          <Suspense fallback={null}>
            {showSidebar ? <CommandPalette /> : null}
          </Suspense>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
