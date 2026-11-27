import { lazy, Suspense, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth/AuthProvider';
import { AuthPage } from './components/AuthPage';
import { AppShell } from './components/AppShell';
import { AtlasV2Shell } from './components/AtlasV2Shell';
import { QuranPage } from './pages/QuranPage';
import { PasswordRecoveryPage } from './pages/PasswordRecoveryPage';
import { SignupThankYouPage } from './components/SignupThankYouPage';

const TodayPage = lazy(() => import('./pages/TodayPage').then(module => ({ default: module.TodayPage })));
const ResidenceV2Page = lazy(() => import('./pages/ResidenceV2Page').then(module => ({ default: module.ResidenceV2Page })));
const DailyRhythmV2Page = lazy(() => import('./pages/DailyRhythmV2Page').then(module => ({ default: module.DailyRhythmV2Page })));
const ExecutionV2Page = lazy(() => import('./pages/ExecutionV2Page').then(module => ({ default: module.ExecutionV2Page })));
const CalendarV2Page = lazy(() => import('./pages/CalendarV2Page').then(module => ({ default: module.CalendarV2Page })));
const BlueprintPage = lazy(() => import('./pages/BlueprintPage').then(module => ({ default: module.BlueprintPage })));
const GoalsPage = lazy(() => import('./pages/GoalsPage').then(module => ({ default: module.GoalsPage })));
const FocusWorkspace = lazy(() => import('./components/FocusWorkspace').then(module => ({ default: module.FocusWorkspace })));
const CalendarPage = lazy(() => import('./pages/CalendarPage').then(module => ({ default: module.CalendarPage })));
const ValuesPage = lazy(() => import('./pages/ValuesPage').then(module => ({ default: module.ValuesPage })));
const HabitsSelfControlView = lazy(() => import('./pages/ConsolidatedViews').then(module => ({ default: module.HabitsSelfControlView })));
const LearningLibraryView = lazy(() => import('./pages/ConsolidatedViews').then(module => ({ default: module.LearningLibraryView })));
const ReviewsInsightsView = lazy(() => import('./pages/ConsolidatedViews').then(module => ({ default: module.ReviewsInsightsView })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(module => ({ default: module.SettingsPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then(module => ({ default: module.AdminPage })));

function SuspendedPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="route-loading" role="status" aria-live="polite">Opening your workspace…</div>}>{children}</Suspense>;
}

function LegacyRedirect({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={{ pathname: to, search: location.search, hash: location.hash }} replace />;
}

export function App() {
  const { session, role, loading, signupConfirmationPending, continueAfterSignup } = useAuth();
  const queryClient = useQueryClient();
  useEffect(() => { queryClient.clear(); }, [session?.user.id, queryClient]);
  if (loading) return <div className="app-loading app-loading--skeleton"><img className="brand-symbol" src="/assets/brand/amstreem-symbol.svg" alt="" /><div className="atlas-skeleton-block"/><div className="atlas-skeleton-block atlas-skeleton-block--short"/><div className="atlas-skeleton-block atlas-skeleton-block--wide"/></div>;
  const hashType = new URLSearchParams(window.location.hash.slice(1)).get('type');
  const queryType = new URLSearchParams(window.location.search).get('type');
  if (hashType === 'recovery' || queryType === 'recovery') return <PasswordRecoveryPage />;
  if (!session) return <AuthPage />;
  if (signupConfirmationPending) return <SignupThankYouPage onContinue={continueAfterSignup} />;
  return <Routes>
    {/* The protected Qur'an reader retains its existing shell and exact implementation. */}
    <Route path="/quran" element={<AppShell />}>
      <Route index element={<QuranPage />} />
    </Route>

    {/* Every other authenticated destination now uses the clean-slate Atlas v2 shell. */}
    <Route element={<AtlasV2Shell />}>
      <Route index element={<Navigate to="/residence" replace />} />
      <Route path="/residence" element={<SuspendedPage><ResidenceV2Page /></SuspendedPage>} />
      <Route path="/blueprint" element={<SuspendedPage><BlueprintPage /></SuspendedPage>} />
      <Route path="/daily-rhythm" element={<SuspendedPage><DailyRhythmV2Page /></SuspendedPage>} />
      <Route path="/home" element={<LegacyRedirect to="/residence" />} />
      <Route path="/today" element={<LegacyRedirect to="/daily-rhythm" />} />
      <Route path="/values" element={<SuspendedPage><ValuesPage /></SuspendedPage>} />
      <Route path="/habits" element={<SuspendedPage><HabitsSelfControlView /></SuspendedPage>} />
      <Route path="/actions" element={<SuspendedPage><ExecutionV2Page /></SuspendedPage>} />
      <Route path="/execution" element={<LegacyRedirect to="/actions" />} />
      <Route path="/focus" element={<SuspendedPage><div className="atlas-v2 a-focus-room"><FocusWorkspace /></div></SuspendedPage>} />
      <Route path="/calendar" element={<SuspendedPage><CalendarV2Page /></SuspendedPage>} />
      <Route path="/goals" element={<SuspendedPage><GoalsPage /></SuspendedPage>} />
      <Route path="/learning-library" element={<SuspendedPage><LearningLibraryView /></SuspendedPage>} />
      <Route path="/growth" element={<SuspendedPage><ReviewsInsightsView /></SuspendedPage>} />
      <Route path="/reviews-insights" element={<LegacyRedirect to="/growth" />} />
      <Route path="/insights" element={<LegacyRedirect to="/growth" />} />
      <Route path="/reviews" element={<LegacyRedirect to="/growth" />} />
      <Route path="/rituals" element={<LegacyRedirect to="/habits" />} />
      <Route path="/self-control" element={<LegacyRedirect to="/habits" />} />
      <Route path="/projects" element={<LegacyRedirect to="/actions" />} />
      <Route path="/tasks" element={<LegacyRedirect to="/actions" />} />
      <Route path="/learning" element={<LegacyRedirect to="/learning-library" />} />
      <Route path="/library" element={<LegacyRedirect to="/learning-library" />} />
      <Route path="/settings" element={<SuspendedPage><SettingsPage /></SuspendedPage>} />
      <Route path="/admin" element={role === 'admin' ? <SuspendedPage><AdminPage /></SuspendedPage> : <Navigate to="/daily-rhythm" replace />} />
      <Route path="*" element={<Navigate to="/daily-rhythm" replace />} />
    </Route>
  </Routes>;
}
