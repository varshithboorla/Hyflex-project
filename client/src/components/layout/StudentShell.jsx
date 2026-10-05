import { useState } from 'react';
import { BookOpen, Grid2X2, LogOut, Menu, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../../lib/api';
import StudentRoutes from '../../pages/student/StudentRoutes';

export default function StudentShell({ session, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const logout = async () => {
    try { await authApi.logout(); } finally { onLogout(); navigate('/login', { replace: true }); }
  };

  const nav = (path, label, Icon) => {
    const active = location.pathname === path || location.pathname.startsWith(`${path}/`);
    return (
      <button
        type="button"
        onClick={() => { navigate(path); setSidebarOpen(false); }}
        className={`student-nav-btn ${active ? 'active' : ''}`}
      >
        <span className="student-nav-icon"><Icon size={17} /></span>
        {label}
      </button>
    );
  };

  const firstName = session?.first_name || 'Student';
  const fullName = [session?.first_name, session?.last_name].filter(Boolean).join(' ') || 'Student';
  const initial = String(firstName).charAt(0).toUpperCase();

  return (
    <div className="student-app">
      <aside className={`student-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="student-brand">
          <div className="student-logo">E</div>
          <span>EduLearn</span>
        </div>
        <nav className="student-nav">
          {nav('/student', 'Dashboard', Grid2X2)}
          {nav('/student/courses', 'Courses', BookOpen)}
        </nav>
        <button type="button" className="student-logout" onClick={logout}>
          <LogOut size={16} /> Logout
        </button>
      </aside>

      {sidebarOpen && <button type="button" aria-label="Close navigation" className="student-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
      <button
        type="button"
        aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
        className="student-mobile-toggle"
        onClick={() => setSidebarOpen(v => !v)}
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <main className="student-main">
        <header className="student-topbar">
          <div>
            <h1>{location.pathname.startsWith('/student/video/') ? 'Video Lesson' : location.pathname.startsWith('/student/courses') ? 'My Courses' : 'Student Dashboard'}</h1>
            <p>Your courses and learning progress</p>
          </div>
          <div className="student-user-profile">
            <div className="student-avatar">{initial}</div>
            <div><strong>{fullName}</strong><small>{session?.roll_number || '-'}</small></div>
          </div>
        </header>
        <div className="student-page-content">
          <StudentRoutes />
        </div>
      </main>
    </div>
  );
}
