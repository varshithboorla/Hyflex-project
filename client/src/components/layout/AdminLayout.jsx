import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, BookOpen, GraduationCap, PlaySquare, Settings, Menu, X, LogOut, ChevronRight } from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'students', label: 'Students', icon: Users },
  { id: 'courses', label: 'Courses', icon: BookOpen },
  { id: 'academic', label: 'Academic Setup', icon: GraduationCap },
  { id: 'progress', label: 'Video Progress', icon: PlaySquare },
  { id: 'history', label: 'Progress History', icon: PlaySquare },
  { id: 'admins', label: 'Admins', icon: Settings },
];

export default function AdminLayout({ session, onLogout, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const activeId = location.pathname.split('/')[2] || 'dashboard';
  const active = navItems.find((item) => item.id === activeId) || navItems[0];

  const select = (id) => {
    navigate(`/admin/${id}`);
    setMobileOpen(false);
  };

  const Sidebar = ({ mobile = false }) => (
    <aside className={`${mobile ? 'fixed inset-y-0 left-0 z-50 w-[270px] shadow-2xl' : 'hidden lg:flex w-[232px] shrink-0'} admin-sidebar flex-col border-r border-slate-200 bg-white`}>
      <div className="admin-brand flex h-[76px] items-center gap-3 border-b border-slate-100 px-6">
        <div className="admin-logo grid h-10 w-10 place-items-center rounded-md text-lg font-semibold">E</div>
        <span className="text-[20px] font-semibold text-slate-900">EduLearn</span>
        {mobile && <button onClick={() => setMobileOpen(false)} className="ml-auto rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>}
      </div>
      <nav className="admin-nav flex-1 space-y-1 px-3 py-5">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => select(id)} className={`admin-nav-btn flex w-full items-center gap-3 rounded-md px-4 py-3 text-left text-[13px] font-medium transition ${activeId === id ? 'active' : ''}`}>
            <Icon size={18} strokeWidth={1.8} />
            <span>{label}</span>
            {activeId === id && <ChevronRight size={15} className="ml-auto" />}
          </button>
        ))}
      </nav>
      <div className="admin-logout-wrap border-t border-slate-100 p-3">
        <button onClick={onLogout} className="admin-logout flex w-full items-center gap-3 rounded-md px-4 py-3 text-left text-[13px] font-medium transition">
          <LogOut size={18} strokeWidth={1.8} />
          Logout
        </button>
      </div>
    </aside>
  );

  return (
    <div className="admin-app min-h-screen bg-[#edece5] text-[#1d211d]">
      <div className="flex min-h-screen">
        <Sidebar />
        {mobileOpen && <><div onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden" /><Sidebar mobile /></>}
        <main className="admin-main min-w-0 flex-1">
          <header className="admin-header flex min-h-[76px] items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"><Menu size={21} /></button>
              <div>
                <h1 className="text-xl font-bold text-slate-900 sm:text-[22px]">{active.label}</h1>
                <p className="mt-0.5 text-xs text-slate-500">Manage EduLearn</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="admin-avatar grid h-9 w-9 place-items-center rounded-full text-sm font-semibold">{(session?.email?.[0] || 'A').toUpperCase()}</div>
              <div className="hidden sm:block">
                <strong className="block text-[13px] text-slate-800">Administrator</strong>
                <small className="block max-w-[220px] truncate text-[11px] text-slate-500">{session?.email || '-'}</small>
              </div>
            </div>
          </header>
          <div className="p-5 sm:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
