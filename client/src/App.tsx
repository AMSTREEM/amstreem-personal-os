import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import { AuthPage } from './components/AuthPage';
import { AppShell } from './components/AppShell';
import { TodayPage } from './pages/TodayPage';
import { TasksPage } from './pages/TasksPage';
import { GoalsPage } from './pages/GoalsPage';
import { FocusPage } from './pages/FocusPage';
import { RitualsPage } from './pages/RitualsPage';
import { LearningPage } from './pages/LearningPage';
import { LibraryPage } from './pages/LibraryPage';
import { CalendarPage } from './pages/CalendarPage';
import { ValuesPage } from './pages/ValuesPage';
import { InsightsPage } from './pages/InsightsPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  const { session, loading } = useAuth();
  if (loading) return <div className="app-loading"><span className="brand-symbol">a</span><p>Preparing your space…</p></div>;
  if (!session) return <AuthPage />;
  return <Routes>
    <Route element={<AppShell />}>
      <Route index element={<Navigate to="/today" replace />} />
      <Route path="/today" element={<TodayPage />} />
      <Route path="/tasks" element={<TasksPage />} />
      <Route path="/goals" element={<GoalsPage />} />
      <Route path="/calendar" element={<CalendarPage />} />
      <Route path="/focus" element={<FocusPage />} />
      <Route path="/rituals" element={<RitualsPage />} />
      <Route path="/learning" element={<LearningPage />} />
      <Route path="/library" element={<LibraryPage />} />
      <Route path="/values" element={<ValuesPage />} />
      <Route path="/insights" element={<InsightsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/today" replace />} />
    </Route>
  </Routes>;
}