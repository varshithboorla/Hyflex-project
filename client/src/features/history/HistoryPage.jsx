import { useEffect, useMemo, useState } from 'react';
import { Download, Printer, RefreshCw, Search, X, History as HistoryIcon } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { historyApi } from '../../lib/api';

const formatTime = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s).padStart(2, '0')}s`;
};

const statusFor = (row) => {
  if (row.completed) return 'Completed';
  if ((Number(row.max_watched_seconds) || 0) > 0 || (Number(row.questions_solved) || 0) > 0) return 'In Progress';
  return 'Not Started';
};

const escapeCsv = (value) => {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
};

export default function HistoryPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [year, setYear] = useState('');
  const [semester, setSemester] = useState('');
  const [branch, setBranch] = useState('');
  const [batch, setBatch] = useState('');
  const [status, setStatus] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);

  const loadHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await historyApi.getHistory();
      setRows(Array.isArray(result.rows) ? result.rows : []);
    } catch (err) {
      setRows([]);
      setError(err.message || 'Failed to load permanent progress history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadHistory(); }, []);

  const options = useMemo(() => ({
    years: [...new Map(rows.map(r => [String(r.academic_year_id), { id: r.academic_year_id, label: r.academic_year || '—' }]).filter(([id]) => id !== 'undefined')).values()]
      .sort((a, b) => String(b.label).localeCompare(String(a.label))),
    semesters: [...new Map(rows.map(r => [String(r.semester_id), { id: r.semester_id, label: r.semester || '—', number: r.semester_number || 0 }]).filter(([id]) => id !== 'undefined')).values()]
      .sort((a, b) => Number(a.number) - Number(b.number)),
    branches: [...new Set(rows.map(r => r.branch_name).filter(Boolean))].sort(),
    batches: [...new Set(rows.map(r => r.batch_label).filter(Boolean))].sort(),
  }), [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (q) {
      const haystack = [r.roll_number, r.first_name, r.last_name, r.email, r.course_name, r.video_title]
        .filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (year && String(r.academic_year_id) !== String(year)) return false;
    if (semester && String(r.semester_id) !== String(semester)) return false;
    if (branch && r.branch_name !== branch) return false;
    if (batch && r.batch_label !== batch) return false;
    if (status && statusFor(r) !== status) return false;
    return true;
  }), [rows, search, year, semester, branch, batch, status]);

  const students = useMemo(() => new Map(
    filtered.map((r) => [String(r.student_id), `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.roll_number || 'Student'])
  ), [filtered]);

  const clearFilters = () => {
    setSearch(''); setYear(''); setSemester(''); setBranch(''); setBatch(''); setStatus('');
  };

  const exportCsv = () => {
    const header = ['S.No', 'Roll Number', 'Student', 'Course', 'Video', 'Academic Year', 'Semester', 'Branch', 'Batch', 'Watched', 'Video Questions', 'Question Attempts', 'Status', 'Snapshot'];
    const data = filtered.map((r, i) => [
      i + 1,
      r.roll_number || '',
      `${r.first_name || ''} ${r.last_name || ''}`.trim(),
      r.course_name || '',
      r.video_title || '',
      r.academic_year || '',
      r.semester || '',
      r.branch_name || '',
      r.batch_label || '',
      formatTime(r.max_watched_seconds),
      `${Number(r.questions_solved) || 0} / ${Number(r.total_questions) || 0}`,
      `${Number(r.question_attempts) || 0} / ${Number(r.question_correct) || 0}`,
      statusFor(r),
      r.snapshot_at ? new Date(r.snapshot_at).toLocaleString() : '',
    ]);
    const csv = [header, ...data].map(row => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hyflex-progress-history.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const print = () => window.print();

  return (
    <section className="space-y-5">
      {/* <PageHeader
        title="Permanent Progress History"
        description="Historical video and question records preserved when students move forward between semesters."
      /> */}

      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <div className="flex items-start gap-3">
          <HistoryIcon size={20} className="mt-0.5 shrink-0" />
          <div>
            <strong>Permanent records</strong>
            <p className="mt-1">Previous-semester video progress and question attempts are never restored into a new semester.</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="relative xl:col-span-2">
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search roll number, student, course or video" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500" />
          </div>
          <select value={year} onChange={e => setYear(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
            <option value="">All Academic Years</option>
            {options.years.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
          <select value={semester} onChange={e => setSemester(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
            <option value="">All Semesters</option>
            {options.semesters.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
          <select value={branch} onChange={e => setBranch(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
            <option value="">All Branches</option>
            {options.branches.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
          <select value={batch} onChange={e => setBatch(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
            <option value="">All Batches</option>
            {options.batches.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
            <option value="">All Status</option>
            <option value="Completed">Completed</option>
            <option value="In Progress">In Progress</option>
            <option value="Not Started">Not Started</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div className="text-sm text-slate-500">Showing <strong className="text-slate-800">{filtered.length}</strong> historical video records from <strong className="text-slate-800">{students.size}</strong> students</div>
          <div className="flex flex-wrap gap-2">
            <button onClick={clearFilters} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Clear Filters</button>
            <button onClick={loadHistory} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"><RefreshCw size={15} /> Refresh</button>
            <button onClick={exportCsv} disabled={!filtered.length} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Download size={15} /> Export</button>
            <button onClick={print} disabled={!filtered.length} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"><Printer size={15} /> Print</button>
          </div>
        </div>

        {loading ? <div className="p-12 text-center text-sm text-slate-500">Loading permanent history...</div> : error ? <div className="p-12 text-center text-sm text-red-600">{error}</div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1500px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="p-3">#</th><th className="p-3">Roll Number</th><th className="p-3">Student</th><th className="p-3">Course</th><th className="p-3">Video</th><th className="p-3">Academic Year</th><th className="p-3">Semester</th><th className="p-3">Branch</th><th className="p-3">Batch</th><th className="p-3">Watched</th><th className="p-3">Video Questions</th><th className="p-3">Question Attempts</th><th className="p-3">Status</th><th className="p-3">Snapshot</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const student = `${r.first_name || ''} ${r.last_name || ''}`.trim() || '—';
                  return <tr key={`${r.id}-${r.student_id}-${r.video_id}`} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="p-3 text-slate-500">{i + 1}</td>
                    <td className="p-3 font-semibold text-slate-800">{r.roll_number || '—'}</td>
                    <td className="p-3"><button onClick={() => setSelectedStudent(r)} className="font-semibold text-blue-700 hover:underline">{student}</button></td>
                    <td className="p-3">{r.course_name || '—'}</td>
                    <td className="max-w-[240px] p-3">{r.video_title || '—'}</td>
                    <td className="p-3">{r.academic_year || '—'}</td>
                    <td className="p-3">{r.semester || '—'}</td>
                    <td className="p-3">{r.branch_name || '—'}</td>
                    <td className="p-3">{r.batch_label || '—'}</td>
                    <td className="p-3 font-medium">{formatTime(r.max_watched_seconds)}</td>
                    <td className="p-3">{Number(r.questions_solved) || 0} / {Number(r.total_questions) || 0}</td>
                    <td className="p-3">{Number(r.question_attempts) || 0} / {Number(r.question_correct) || 0}</td>
                    <td className="p-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusFor(r) === 'Completed' ? 'bg-emerald-50 text-emerald-700' : statusFor(r) === 'In Progress' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{statusFor(r)}</span></td>
                    <td className="p-3 whitespace-nowrap text-xs text-slate-500">{r.snapshot_at ? new Date(r.snapshot_at).toLocaleString() : '—'}</td>
                  </tr>;
                })}
                {!filtered.length && <tr><td colSpan="14" className="p-12 text-center text-slate-500">No permanent progress history found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedStudent && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4" onClick={() => setSelectedStudent(null)}>
        <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-4 border-b pb-4">
            <div><h2 className="text-lg font-bold text-slate-900">Historical Student Record</h2><p className="mt-1 text-sm text-slate-500">{selectedStudent.roll_number || '—'} · {selectedStudent.first_name || ''} {selectedStudent.last_name || ''}</p></div>
            <button onClick={() => setSelectedStudent(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
          </div>
          <div className="grid gap-3 py-5 sm:grid-cols-2">
            <div><span className="text-xs text-slate-500">Academic Year</span><p className="font-semibold">{selectedStudent.academic_year || '—'}</p></div>
            <div><span className="text-xs text-slate-500">Semester</span><p className="font-semibold">{selectedStudent.semester || '—'}</p></div>
            <div><span className="text-xs text-slate-500">Branch</span><p className="font-semibold">{selectedStudent.branch_name || '—'}</p></div>
            <div><span className="text-xs text-slate-500">Batch</span><p className="font-semibold">{selectedStudent.batch_label || '—'}</p></div>
            <div><span className="text-xs text-slate-500">Course</span><p className="font-semibold">{selectedStudent.course_name || '—'}</p></div>
            <div><span className="text-xs text-slate-500">Video</span><p className="font-semibold">{selectedStudent.video_title || '—'}</p></div>
            <div><span className="text-xs text-slate-500">Maximum Watched</span><p className="font-semibold">{formatTime(selectedStudent.max_watched_seconds)}</p></div>
            <div><span className="text-xs text-slate-500">Video Questions</span><p className="font-semibold">{Number(selectedStudent.questions_solved) || 0} / {Number(selectedStudent.total_questions) || 0}</p></div>
            <div><span className="text-xs text-slate-500">Question Attempts</span><p className="font-semibold">{Number(selectedStudent.question_attempts) || 0} / {Number(selectedStudent.question_correct) || 0}</p></div>
            <div><span className="text-xs text-slate-500">Status</span><p className="font-semibold">{statusFor(selectedStudent)}</p></div>
          </div>
          <div className="border-t pt-4 text-right"><button onClick={() => setSelectedStudent(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold">Close</button></div>
        </div>
      </div>}
    </section>
  );
}
