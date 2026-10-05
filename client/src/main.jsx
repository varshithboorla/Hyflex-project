import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import './index.css';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import StudentRoutes from './pages/student/StudentRoutes';
import StudentShell from './components/layout/StudentShell';
import ProtectedRoute from './components/ProtectedRoute';
import { authApi } from './lib/api';

function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    authApi.me()
      .then((result) => { if (active) setSession(result.user); })
      .catch((error) => {
        // 401 is expected when the visitor has no active session.
        if (active && error?.status !== 401) console.error('Session check failed:', error);
        if (active) setSession(null);
      })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  if (checking) return <div className="grid min-h-screen place-items-center text-sm text-slate-500">Loading...</div>;

  const handleLogin = (user) => {
    setSession(user);
    navigate(user.role === 'admin' ? '/admin/dashboard' : '/student', { replace: true });
  };

  return <Routes>
    <Route path="/login" element={session ? <Navigate to={session.role === 'admin' ? '/admin/dashboard' : '/student'} replace /> : <LoginPage onLogin={handleLogin} />} />
    <Route path="/admin/*" element={<ProtectedRoute session={session} role="admin"><AdminPage session={session} onLogout={() => setSession(null)} /></ProtectedRoute>} />
    <Route path="/student/*" element={<ProtectedRoute session={session} role="student"><StudentShell session={session} onLogout={() => setSession(null)} /></ProtectedRoute>} />
    <Route path="*" element={<Navigate to={session ? (session.role === 'admin' ? '/admin/dashboard' : '/student') : '/login'} replace />} />
  </Routes>;
}

createRoot(document.getElementById('root')).render(<StrictMode><BrowserRouter><App /></BrowserRouter></StrictMode>);
