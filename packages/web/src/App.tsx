import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LandingPage } from './site/LandingPage.tsx';
import { AppLayout } from './app/AppLayout.tsx';
import { FactoryProvider } from './app/FactoryContext.tsx';
import { LoadingState } from './components/Primitives.tsx';

// Split per route. The marketing page is the common entry point and should not
// have to download the dashboard, the charts and the data tables to render.
const OverviewPage = lazy(() => import('./pages/OverviewPage.tsx').then((m) => ({ default: m.OverviewPage })));
const PlanPage = lazy(() => import('./pages/PlanPage.tsx').then((m) => ({ default: m.PlanPage })));
const SetupPage = lazy(() => import('./pages/SetupPage.tsx').then((m) => ({ default: m.SetupPage })));
const MachinesPage = lazy(() => import('./pages/MachinesPage.tsx').then((m) => ({ default: m.MachinesPage })));
const KnowledgePage = lazy(() => import('./pages/KnowledgePage.tsx').then((m) => ({ default: m.KnowledgePage })));
const ReportPage = lazy(() => import('./pages/ReportPage.tsx').then((m) => ({ default: m.ReportPage })));
const ImportPage = lazy(() => import('./pages/ImportPage.tsx').then((m) => ({ default: m.ImportPage })));
const ModelPage = lazy(() => import('./pages/ModelPage.tsx').then((m) => ({ default: m.ModelPage })));

/**
 * Two surfaces behind one router: the marketing site at `/`, and the product
 * at `/app`. Factory selection lives above the app routes so switching factory
 * refreshes every page at once.
 */
export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route
        path="/app"
        element={
          <FactoryProvider>
            <AppLayout />
          </FactoryProvider>
        }
      >
        <Route index element={<Navigate to="/app/overview" replace />} />
        <Route path="overview" element={<Suspense fallback={<LoadingState />}><OverviewPage /></Suspense>} />
        <Route path="plan" element={<Suspense fallback={<LoadingState />}><PlanPage /></Suspense>} />
        <Route path="setup" element={<Suspense fallback={<LoadingState />}><SetupPage /></Suspense>} />
        <Route path="import" element={<Suspense fallback={<LoadingState />}><ImportPage /></Suspense>} />
        <Route path="model" element={<Suspense fallback={<LoadingState />}><ModelPage /></Suspense>} />
        <Route path="machines" element={<Suspense fallback={<LoadingState />}><MachinesPage /></Suspense>} />
        <Route path="knowledge" element={<Suspense fallback={<LoadingState />}><KnowledgePage /></Suspense>} />
        <Route path="report" element={<Suspense fallback={<LoadingState />}><ReportPage /></Suspense>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
