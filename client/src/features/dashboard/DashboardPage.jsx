import { useEffect, useState } from 'react';
import {
  Users, BookOpen, PlaySquare, CheckCircle2, Clock3, Circle,
  RefreshCw, AlertTriangle, ArrowRight, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { dashboardApi } from '../../lib/api';

const n = (v) => Number(v) || 0;
const pct = (v) => `${Math.round(n(v) * 10) / 10}%`;

function StatCard({ icon: Icon, label, value, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div><span className="block text-xs font-medium text-slate-500">{label}</span><strong className="mt-2 block text-2xl font-bold text-slate-900">{value}</strong></div>
      <div className={`grid h-11 w-11 place-items-center rounded-xl ${tones[tone] || tones.blue}`}><Icon size={21} strokeWidth={1.8} /></div>
    </div>
  </div>;
}

function Panel({ title, subtitle, children, className = '' }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
    <div className="mb-4"><h2 className="text-base font-bold text-slate-900">{title}</h2>{subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}</div>
    {children}
  </div>;
}

function Donut({ overview }) {
  const completed = n(overview?.completed), progress = n(overview?.in_progress), notStarted = n(overview?.not_started);
  const total = completed + progress + notStarted;
  const a = total ? (completed / total) * 100 : 0;
  const b = total ? (progress / total) * 100 : 0;
  const background = `conic-gradient(#10b981 0 ${a}%, #f59e0b ${a}% ${a + b}%, #cbd5e1 ${a + b}% 100%)`;
  return <div className="flex items-center gap-6">
    <div className="relative grid h-36 w-36 shrink-0 place-items-center rounded-full" style={{ background }}>
      <div className="grid h-24 w-24 place-items-center rounded-full bg-white"><strong className="text-xl text-slate-900">{pct(completed)}</strong></div>
    </div>
    <div className="space-y-3 text-sm">
      <div><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />Completed <strong className="float-right ml-8">{pct(completed)}</strong></div>
      <div><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />In Progress <strong className="float-right ml-8">{pct(progress)}</strong></div>
      <div><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-slate-300" />Not Started <strong className="float-right ml-8">{pct(notStarted)}</strong></div>
    </div>
  </div>;
}

function Empty({ text = 'No data available.' }) { return <div className="py-8 text-center text-sm text-slate-400">{text}</div>; }

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try { setData(await dashboardApi.getDashboard()); }
    catch (e) { setError(e.message || 'Unable to load dashboard data.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <section><div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500"><RefreshCw className="mr-2 animate-spin" size={17}/>Loading dashboard…</div></section>;
  if (error) return <section><div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}<button onClick={load} className="ml-3 rounded-lg bg-red-600 px-3 py-2 font-semibold text-white">Retry</button></div></section>;

  const t = data?.totals || {};
  const current = data?.current || {};

  return <section className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h2 className="text-2xl font-bold text-slate-900">HyFlex Admin Dashboard</h2><p className="mt-1 text-sm text-slate-500">Academic Year: <strong className="text-slate-700">{current.academic_year?.label || '—'}</strong> <span className="mx-2">•</span> Semester: <strong className="text-slate-700">{current.semester?.name || '—'}</strong></p></div>
      <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"><RefreshCw size={16}/> Refresh</button>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <StatCard icon={Users} label="Students" value={t.students ?? 0} />
      <StatCard icon={BookOpen} label="Courses" value={t.courses ?? 0} tone="violet" />
      <StatCard icon={PlaySquare} label="Videos" value={t.videos ?? 0} tone="amber" />
      <StatCard icon={CheckCircle2} label="Completed" value={t.completed ?? 0} tone="emerald" />
      <StatCard icon={Clock3} label="In Progress" value={t.in_progress ?? 0} tone="amber" />
      <StatCard icon={Circle} label="Not Started" value={t.not_started ?? 0} tone="slate" />
    </div>

    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Student Learning Overview" subtitle="Current semester video learning status"><Donut overview={data?.learning_overview}/></Panel>
      <Panel title="Branch Performance" subtitle="Completion across assigned current-semester videos">
        {(data?.branch_performance || []).length ? <div className="space-y-4">{data.branch_performance.map((b) => <div key={b.branch.id}>
          <div className="mb-1.5 flex items-center justify-between text-xs"><span className="font-semibold text-slate-700">{b.branch.code || b.branch.name}</span><span className="font-semibold text-slate-600">{pct(b.percentage)}</span></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, n(b.percentage))}%` }}/></div>
        </div>)}</div> : <Empty/>}
      </Panel>
    </div>

    <Panel title="Semester Performance" subtitle="Current academic year">
      {(data?.semester_performance || []).length ? <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3">Semester</th><th className="p-3">Students</th><th className="p-3">Completion</th><th className="p-3">Score</th></tr></thead><tbody>{data.semester_performance.map((s) => <tr key={s.semester_number} className="border-b last:border-0"><td className="p-3 font-semibold text-slate-800">{s.name || `Semester ${s.semester_number}`}</td><td className="p-3">{s.students}</td><td className="p-3">{pct(s.completion)}</td><td className="p-3 font-semibold">{pct(s.score)}</td></tr>)}</tbody></table></div> : <Empty/>}
    </Panel>

    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Students Needing Attention" subtitle="Low completion or 5+ videos not started">
        {(data?.attention || []).length ? <div className="divide-y">{data.attention.map((s) => <div key={s.roll_number} className="flex items-center justify-between gap-3 py-3"><div><p className="font-semibold text-slate-800">{s.roll_number}</p><p className="text-xs text-slate-500">{s.name || 'Student'}{s.not_started ? ` • ${s.not_started} not started` : ''}</p></div><span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">{pct(s.completion)}</span></div>)}</div> : <Empty text="No students currently need attention."/>}
      </Panel>
      <Panel title="Recent Activity" subtitle="Latest learning and semester movement events">
        {(data?.recent_activity || []).length ? <div className="divide-y">{data.recent_activity.slice(0, 6).map((a, i) => <div key={`${a.at}-${i}`} className="flex gap-3 py-3"><div className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${a.type === 'completed' ? 'bg-emerald-50 text-emerald-600' : a.type === 'moved' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>{a.type === 'completed' ? <CheckCircle2 size={16}/> : a.type === 'moved' ? <ArrowRight size={16}/> : <PlaySquare size={16}/>}</div><div className="min-w-0"><p className="text-sm font-semibold text-slate-800">{a.type === 'completed' ? 'Video completed' : a.type === 'moved' ? 'Student moved' : 'Video started'}</p><p className="truncate text-xs text-slate-500">{a.student} • {a.video}</p><p className="mt-0.5 text-[11px] text-slate-400">{new Date(a.at).toLocaleString()}</p></div></div>)}</div> : <Empty/>}
      </Panel>
    </div>

    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Top Performers" subtitle="Highest current-semester completion"><RankList rows={data?.top_performers} up/></Panel>
      <Panel title="Needs Improvement" subtitle="Lowest current-semester completion"><RankList rows={data?.needs_improvement}/></Panel>
    </div>
  </section>;
}

function RankList({ rows = [], up }) {
  if (!rows.length) return <Empty/>;
  return <div className="divide-y">{rows.map((s) => <div key={s.roll_number} className="flex items-center justify-between py-3"><div><p className="font-semibold text-slate-800">{s.roll_number}</p><p className="text-xs text-slate-500">{s.name || 'Student'}</p></div><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{up ? <ArrowUpRight size={13}/> : <ArrowDownRight size={13}/>} {pct(s.percentage)}</span></div>)}</div>;
}
