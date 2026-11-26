import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth/AuthProvider';
import { AuthPage } from './components/AuthPage';
import { AppShell } from './components/AppShell';
import { TodayPage } from './pages/TodayPage';
import { AtlasHomePage } from './pages/AtlasHomePage';
import { BlueprintPage } from './pages/BlueprintPage';
import { GoalsPage } from './pages/GoalsPage';
import { FocusWorkspace } from './components/FocusWorkspace';
import { CalendarPage } from './pages/CalendarPage';
import { ValuesPage } from './pages/ValuesPage';
import { QuranPage } from './pages/QuranPage';
import { HabitsSelfControlView, LearningLibraryView, ReviewsInsightsView } from './pages/ConsolidatedViews';
import { SettingsPage } from './pages/SettingsPage';
import { AdminPage } from './pages/AdminPage';
import { PasswordRecoveryPage } from './pages/PasswordRecoveryPage';
import { SignupThankYouPage } from './components/SignupThankYouPage';

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
    <Route element={<AppShell />}>
      <Route index element={<Navigate to="/residence" replace />} />
      {/* Canonical eight-view destinations */}
      <Route path="/residence" element={<AtlasHomePage />} />
      <Route path="/blueprint" element={<BlueprintPage />} />
      <Route path="/daily-rhythm" element={<TodayPage />} />
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
      <Route path="/admin" element={role === "admin" ? <AdminPage /> : <Navigate to="/today" replace />} />
      <Route path="*" element={<Navigate to="/today" replace />} />
    </Route>
  </Routes>;
}