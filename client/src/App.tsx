import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth/AuthProvider';
import { AuthPage } from './components/AuthPage';
import { AppShell } from './components/AppShell';
import { TodayPage } from './pages/TodayPage';
import { TasksPage } from './pages/TasksPage';
import { GoalsPage } from './pages/GoalsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ReviewsPage } from './pages/ReviewsPage';
import { FocusPage } from './pages/FocusPage';
import { RitualsPage } from './pages/RitualsPage';
import { LearningPage } from './pages/LearningPage';
import { LibraryPage } from './pages/LibraryPage';
import { CalendarPage } from './pages/CalendarPage';
import { ValuesPage } from './pages/ValuesPage';
import { InsightsPage } from './pages/InsightsPage';
import { SettingsPage } from './pages/SettingsPage';
import { PasswordRecoveryPage } from './pages/PasswordRecoveryPage';

export function App() {
  const { session, loading } = useAuth();
  const queryClient = useQueryClient();
  useEffect(() => { queryClient.clear(); }, [session?.user.id, queryClient]);
  if (loading) return <div className="app-loading"><img className="brand-symbol" src="/assets/brand/amstreem-symbol.svg" alt="" /><p>Preparing your space…</p></div>;
  const hashType = new URLSearchParams(window.location.hash.slice(1)).get('type');
  const queryType = new URLSearchParams(window.location.search).get('type');
  if (hashType === 'recovery' || queryType === 'recovery') return <PasswordRecoveryPage />;
  if (!session) return <AuthPage />;
  return <Routes>
    <Route element={<AppShell />}>
      <Route index element={<Navigate to="/today" replace />} />
      <Route path="/today" element={<TodayPage />} />
      <Route path="/tasks" element={<TasksPage />} />
      <Route path="/goals" element={<GoalsPage />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/calendar" element={<CalendarPage />} />
      <Route path="/focus" element={<FocusPage />} />
      <Route path="/rituals" element={<RitualsPage />} />
      <Route path="/learning" element={<LearningPage />} />
      <Route path="/library" element={<LibraryPage />} />
      <Route path="/values" element={<ValuesPage />} />
      <Route path="/insights" element={<InsightsPage />} />
      <Route path="/reviews" element={<ReviewsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/today" replace />} />
    </Route>
  </Routes>;
}