import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth/AuthProvider';
import { AuthPage } from './components/AuthPage';
import { SignupThankYouPage } from './components/SignupThankYouPage';

const AppShell = lazy(() => import('./components/AppShell').then(module => ({ default: module.AppShell })));
const TodayPage = lazy(() => import('./pages/TodayPage').then(module => ({ default: module.TodayPage })));
const GoalsPage = lazy(() => import('./pages/GoalsPage').then(module => ({ default: module.GoalsPage })));
const FocusWorkspace = lazy(() => import('./components/FocusWorkspace').then(module => ({ default: module.FocusWorkspace })));
const CalendarPage = lazy(() => import('./pages/CalendarPage').then(module => ({ default: module.CalendarPage })));
const ValuesPage = lazy(() => import('./pages/ValuesPage').then(module => ({ default: module.ValuesPage })));
const QuranPage = lazy(() => import('./pages/QuranPage').then(module => ({ default: module.QuranPage })));
const HabitsSelfControlView = lazy(() => import('./pages/ConsolidatedViews').then(module => ({ default: module.HabitsSelfControlView })));
const LearningLibraryView = lazy(() => import('./pages/ConsolidatedViews').then(module => ({ default: module.LearningLibraryView })));
const ReviewsInsightsView = lazy(() => import('./pages/ConsolidatedViews').then(module => ({ default: module.ReviewsInsightsView })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(module => ({ default: module.SettingsPage })));
const HistoryPage = lazy(() => import('./pages/HistoryPage').then(module => ({ default: module.HistoryPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then(module => ({ default: module.AdminPage })));
const PasswordRecoveryPage = lazy(() => import('./pages/PasswordRecoveryPage').then(module => ({ default: module.PasswordRecoveryPage })));

function RouteLoading() {
  return <div className="app-loading app-loading--skeleton" role="status" aria-label="Loading Atlas module">
    <img className="brand-symbol" src="/assets/brand/amstreem-symbol.svg" alt="" />
    <div className="atlas-skeleton-block"/>
    <div className="atlas-skeleton-block atlas-skeleton-block--short"/>
    <div className="atlas-skeleton-block atlas-skeleton-block--wide"/>
  </div>;
}

function LegacyRedirect({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={{ pathname: to, search: location.search, hash: location.hash }} replace />;
}

export function App() {
  const { session, role, loading, signupConfirmationPending, continueAfterSignup } = useAuth();
  const queryClient = useQueryClient();
  useEffect(() => { queryClient.clear(); }, [session?.user.id, queryClient]);
  if (loading) return <RouteLoading />;
  const hashType = new URLSearchParams(window.location.hash.slice(1)).get('type');
  const queryType = new URLSearchParams(window.location.search).get('type');
  if (hashType === 'recovery' || queryType === 'recovery') return <Suspense fallback={<RouteLoading />}><PasswordRecoveryPage /></Suspense>;
  if (!session) return <AuthPage />;
  if (signupConfirmationPending) return <SignupThankYouPage onContinue={continueAfterSignup} />;
  return <Suspense fallback={<RouteLoading />}>
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/residence" replace />} />
        {/* Canonical module destinations */}
        <Route path="/residence" element={<TodayPage />} />
        <Route path="/home" element={<LegacyRedirect to="/residence" />} />
        <Route path="/today" element={<LegacyRedirect to="/residence" />} />
        <Route path="/values" element={<ValuesPage />} />
        <Route path="/quran" element={<QuranPage />} />
        <Route path="/habits" element={<HabitsSelfControlView />} />
        <Route path="/actions" element={<FocusWorkspace />} />
        <Route path="/execution" element={<LegacyRedirect to="/actions" />} />
        <Route path="/focus" element={<FocusWorkspace />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/goals" element={<GoalsPage />} />
        <Route path="/learning-library" element={<LearningLibraryView />} />
        <Route path="/growth" element={<ReviewsInsightsView />} />
        <Route path="/reviews-insights" element={<LegacyRedirect to="/growth" />} />
        {/* Legacy bookmarks and deep links remain valid and preserve query/hash context. */}
        <Route path="/insights" element={<LegacyRedirect to="/growth" />} />
        <Route path="/reviews" element={<LegacyRedirect to="/growth" />} />
        <Route path="/rituals" element={<LegacyRedirect to="/habits" />} />
        <Route path="/self-control" element={<LegacyRedirect to="/habits" />} />
        <Route path="/projects" element={<LegacyRedirect to="/goals" />} />
        <Route path="/tasks" element={<LegacyRedirect to="/actions" />} />
        <Route path="/learning" element={<LegacyRedirect to="/goals" />} />
        <Route path="/library" element={<LegacyRedirect to="/learning-library" />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/admin" element={role === "admin" ? <AdminPage /> : <Navigate to="/today" replace />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Route>
    </Routes>
  </Suspense>;
}
