import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import { AuthPage } from './components/AuthPage';
import { AppShell } from './components/AppShell';
import { TodayPage } from './pages/TodayPage';
import { TasksPage } from './pages/TasksPage';
import { GoalsPage } from './pages/GoalsPage';

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
      <Route path="*" element={<Navigate to="/today" replace />} />
    </Route>
  </Routes>;
}