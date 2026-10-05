import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/ui/PageHeader';
import { academicApi } from '../../lib/api';

const emptyYear = { label: '', start_date: '', end_date: '', is_current: false };
const emptyRegulation = { code: '', name: '' };
const emptyBatch = { admission_year: '', duration: 4, regulation_id: '' };

function Modal({ title, children, onClose, footer }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b px-5 py-4"><h3 className="text-lg font-semibold text-slate-900">{title}</h3><button onClick={onClose} className="text-2xl leading-none text-slate-400 hover:text-slate-700">×</button></div>
      <div className="p-5">{children}</div>
      <div className="flex justify-end gap-2 border-t bg-slate-50 px-5 py-4">{footer}</div>
    </div>
  </div>;
}

function Field({ label, children }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>{children}</label>;
}

function Input({ className = '', ...props }) {
  return <input {...props} className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${className}`} />;
}

function Select({ className = '', ...props }) {
  return <select {...props} className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${className}`} />;
}

const Button = ({ variant = 'primary', className = '', ...props }) => {
  const styles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    danger: 'border border-red-200 bg-white text-red-600 hover:bg-red-50',
  };
  return <button {...props} className={`rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`} />;
};

function formatDate(value) {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AcademicPage() {
  const [data, setData] = useState({ academicYears: [], regulations: [], batches: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null);
  const [yearForm, setYearForm] = useState(emptyYear);
  const [regForm, setRegForm] = useState(emptyRegulation);
  const [batchForm, setBatchForm] = useState(emptyBatch);
  const [editingBatch, setEditingBatch] = useState(null);

  const regulationsById = useMemo(() => new Map(data.regulations.map((r) => [r.id, r])), [data.regulations]);
  const currentYear = data.academicYears.find((year) => year.is_current);

  const load = async () => {
    setLoading(true);
    setError('');
    try { setData(await academicApi.getSetup()); }
    catch (e) { setError(e.message || 'Unable to load academic setup.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openYear = () => { setYearForm({ ...emptyYear, is_current: data.academicYears.length === 0 }); setModal('year'); };
  const openReg = () => { setRegForm(emptyRegulation); setModal('regulation'); };
  const openAddBatch = () => {
    setEditingBatch(null);
    setBatchForm({ admission_year: currentYear ? new Date(`${currentYear.start_date}T00:00:00`).getFullYear() : '', duration: 4, regulation_id: data.regulations[0]?.id || '' });
    setModal('batch');
  };
  const openEditBatch = (batch) => {
    setEditingBatch(batch);
    setBatchForm({ admission_year: batch.admission_year, duration: batch.graduation_year - batch.admission_year, regulation_id: batch.regulation_id });
    setModal('batch');
  };

  const save = async () => {
    setSaving(true); setError('');
    try {
      if (modal === 'year') await academicApi.createAcademicYear(yearForm);
      if (modal === 'regulation') await academicApi.createRegulation(regForm);
      if (modal === 'batch') {
        if (editingBatch) await academicApi.updateBatch(editingBatch.id, { regulation_id: Number(batchForm.regulation_id) });
        else await academicApi.createBatch({ admission_year: Number(batchForm.admission_year), duration: Number(batchForm.duration), regulation_id: Number(batchForm.regulation_id) });
      }
      setModal(null); await load();
    } catch (e) { setError(e.message || 'Unable to save.'); }
    finally { setSaving(false); }
  };

  const setCurrent = async (year) => {
    if (!window.confirm(`Make ${year.label} the current academic year?`)) return;
    try { await academicApi.setCurrentAcademicYear(year.id); await load(); } catch (e) { setError(e.message); }
  };

  const removeYear = async (year) => {
    if (!window.confirm(`Delete the academic year ${year.label}?`)) return;
    try { await academicApi.deleteAcademicYear(year.id); await load(); } catch (e) { setError(e.message); }
  };
  const removeReg = async (reg) => {
    if (!window.confirm(`Delete the regulation ${reg.code}?`)) return;
    try { await academicApi.deleteRegulation(reg.id); await load(); } catch (e) { setError(e.message); }
  };
  const removeBatch = async (batch) => {
    if (!window.confirm(`Delete the batch ${batch.label}?`)) return;
    try { await academicApi.deleteBatch(batch.id); await load(); } catch (e) { setError(e.message); }
  };

  return <section>
    {/* <PageHeader title="Academic Setup" description="Academic years, regulations and batches decide which courses each student sees." actions={<Button onClick={load} variant="secondary" disabled={loading}>↻ Refresh</Button>} /> */}

    {error && <div className="mb-5 flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span><button onClick={() => setError('')} className="font-semibold">×</button></div>}

    <div className="space-y-7">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="font-semibold text-slate-900">Academic Years</h3><p className="mt-1 text-sm text-slate-500">Exactly one year is marked as current. New students and semester moves use it.</p></div>
          <Button onClick={openYear}>+ Add Academic Year</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Academic Year</th><th className="px-5 py-3">Start</th><th className="px-5 py-3">End</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan="5" className="px-5 py-8 text-center text-slate-500">Loading...</td></tr> : data.academicYears.length === 0 ? <tr><td colSpan="5" className="px-5 py-8 text-center text-slate-500">No academic years yet. Add one and mark it as current.</td></tr> : data.academicYears.map((year) => <tr key={year.id} className="hover:bg-slate-50/70"><td className="px-5 py-3 font-semibold text-slate-900">{year.label}</td><td className="px-5 py-3">{formatDate(year.start_date)}</td><td className="px-5 py-3">{formatDate(year.end_date)}</td><td className="px-5 py-3">{year.is_current ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Current</span> : <span className="text-slate-400">-</span>}</td><td className="px-5 py-3"><div className="flex flex-wrap gap-2">{!year.is_current && <Button variant="secondary" onClick={() => setCurrent(year)}>Set as current</Button>}<Button variant="danger" onClick={() => removeYear(year)}>Delete</Button></div></td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold text-slate-900">Regulations</h3><p className="mt-1 text-sm text-slate-500">Curriculum versions such as R23 or R25.</p></div><Button onClick={openReg}>+ Add Regulation</Button></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Code</th><th className="px-5 py-3">Name</th><th className="px-5 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{data.regulations.length === 0 ? <tr><td colSpan="3" className="px-5 py-8 text-center text-slate-500">No regulations yet. Add one, for example R23.</td></tr> : data.regulations.map((reg) => <tr key={reg.id} className="hover:bg-slate-50/70"><td className="px-5 py-3 font-semibold">{reg.code}</td><td className="px-5 py-3">{reg.name || '-'}</td><td className="px-5 py-3"><Button variant="danger" onClick={() => removeReg(reg)}>Delete</Button></td></tr>)}</tbody></table></div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold text-slate-900">Batches</h3><p className="mt-1 text-sm text-slate-500">Each admission group belongs to one regulation. Students inherit it from their batch.</p></div><Button onClick={openAddBatch}>+ Add Batch</Button></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Batch</th><th className="px-5 py-3">Regulation</th><th className="px-5 py-3">Students</th><th className="px-5 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{data.batches.length === 0 ? <tr><td colSpan="4" className="px-5 py-8 text-center text-slate-500">No batches yet. Add one, for example 2026-2030.</td></tr> : data.batches.map((batch) => <tr key={batch.id} className="hover:bg-slate-50/70"><td className="px-5 py-3 font-semibold">{batch.label}</td><td className="px-5 py-3">{regulationsById.get(batch.regulation_id)?.code || '-'}</td><td className="px-5 py-3">{batch.student_count ?? 0}</td><td className="px-5 py-3"><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => openEditBatch(batch)}>Change regulation</Button><Button variant="danger" onClick={() => removeBatch(batch)}>Delete</Button></div></td></tr>)}</tbody></table></div>
      </section>
    </div>

    {modal === 'year' && <Modal title="Add Academic Year" onClose={() => setModal(null)} footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></>}><div className="space-y-4"><Field label="Label"><Input value={yearForm.label} onChange={(e) => setYearForm({ ...yearForm, label: e.target.value })} placeholder="e.g. 2026-27" autoFocus /></Field><Field label="Start date"><Input type="date" value={yearForm.start_date} onChange={(e) => setYearForm({ ...yearForm, start_date: e.target.value })} /></Field><Field label="End date"><Input type="date" value={yearForm.end_date} onChange={(e) => setYearForm({ ...yearForm, end_date: e.target.value })} /></Field><label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={yearForm.is_current} onChange={(e) => setYearForm({ ...yearForm, is_current: e.target.checked })} /> Make this the current academic year</label></div></Modal>}

    {modal === 'regulation' && <Modal title="Add Regulation" onClose={() => setModal(null)} footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></>}><div className="space-y-4"><Field label="Code"><Input value={regForm.code} onChange={(e) => setRegForm({ ...regForm, code: e.target.value })} placeholder="e.g. R25" maxLength={20} autoFocus /></Field><Field label={<span>Name <span className="text-slate-400">(optional)</span></span>}><Input value={regForm.name} onChange={(e) => setRegForm({ ...regForm, name: e.target.value })} placeholder="e.g. Regulation 2025" /></Field></div></Modal>}

    {modal === 'batch' && <Modal title={editingBatch ? `Edit Batch ${editingBatch.label}` : 'Add Batch'} onClose={() => setModal(null)} footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></>}><div className="space-y-4"><Field label="Admission year"><Input type="number" min="2000" max="2100" disabled={!!editingBatch} value={batchForm.admission_year} onChange={(e) => setBatchForm({ ...batchForm, admission_year: e.target.value })} placeholder="e.g. 2026" /></Field><Field label="Programme length (years)"><Input type="number" min="1" max="8" disabled={!!editingBatch} value={batchForm.duration} onChange={(e) => setBatchForm({ ...batchForm, duration: e.target.value })} /></Field><Field label="Regulation"><Select value={batchForm.regulation_id} onChange={(e) => setBatchForm({ ...batchForm, regulation_id: e.target.value })}><option value="">Select regulation</option>{data.regulations.map((r) => <option key={r.id} value={r.id}>{r.code}{r.name ? ` — ${r.name}` : ''}</option>)}</Select></Field>{editingBatch && <p className="text-xs text-slate-500">For an existing batch, only the regulation can be changed; admission and graduation years remain fixed.</p>}</div></Modal>}
  </section>;
}
