import { useEffect, useState } from 'react';
import { Users, Building2, BookOpen, RefreshCw } from 'lucide-react';
import { adminApi } from '../../lib/api';

function StatCard({ icon: Icon, label, value }) {
  return <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-[0_3px_14px_rgba(15,23,42,0.03)]">
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600"><Icon size={21} strokeWidth={1.8} /></div>
    <div><span className="block text-[12px] font-medium text-slate-500">{label}</span><strong className="mt-1 block text-2xl font-bold text-slate-900">{value}</strong></div>
  </div>;
}

export default function DashboardSection() {
  const [data, setData] = useState({ students: 0, branches: 0, semesters: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try { setData(await adminApi.dashboard()); }
    catch (e) { setError(e.message || 'Unable to load dashboard data.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return <section>
    {/* <div className="mb-6 flex items-end justify-between gap-4">
      <div></div>
      <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button>
    </div> */}
    {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <div className="grid gap-4 md:grid-cols-3">
      <StatCard icon={Users} label="Total Students" value={loading ? '—' : data.students} />
      <StatCard icon={Building2} label="Branches" value={loading ? '—' : data.branches} />
      <StatCard icon={BookOpen} label="Semesters" value={loading ? '—' : data.semesters} />
    </div>
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-[0_3px_14px_rgba(15,23,42,0.03)]">
      <h2 className="text-lg font-bold text-slate-900">Welcome to the Admin Panel</h2>
      <p className="mt-2 text-sm text-slate-500">Manage students and academic information from one place.</p>
    </div>
  </section>;
}
