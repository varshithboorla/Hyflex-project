import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, RefreshCw, Users, X, ArrowRight, CheckSquare, Square, AlertCircle, Pencil, Trash2 } from 'lucide-react';
import { adminApi } from '../../lib/api';

const emptyForm = { roll_number: '', email: '', password: '', first_name: '', last_name: '', branch_id: '', academic_year_id: '', semester_id: '', batch_id: '' };

function Modal({ title, onClose, children, wide = false }) {
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-xl'}`}>
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={19} /></button>
      </div>
      {children}
    </div>
  </div>;
}

function Field({ label, children }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>{children}</label>;
}

const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export default function StudentsSection() {
  const [students, setStudents] = useState([]);
  const [options, setOptions] = useState({ academicYears: [], semesters: [], branches: [], batches: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ academic_year_id: '', semester_id: '', branch_id: '', batch_id: '' });
  const [selected, setSelected] = useState(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showMove, setShowMove] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [moveForm, setMoveForm] = useState({ academic_year_id: '', semester_id: '' });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const data = await adminApi.getStudents({ ...filters, search });
      setStudents(data.students || []);
      setOptions(data.options || { academicYears: [], semesters: [], branches: [], batches: [] });
      setSelected(new Set());
    } catch (e) { setError(e.message || 'Unable to load students.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filters.academic_year_id, filters.semester_id, filters.branch_id, filters.batch_id]);

  useEffect(() => {
    const timer = setTimeout(() => load(), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const visibleIds = useMemo(() => students.map((s) => s.id), [students]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) visibleIds.forEach((id) => next.delete(id));
    else visibleIds.forEach((id) => next.add(id));
    setSelected(next);
  };
  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const openEdit = (student) => {
    setError('');
    setEditingId(student.id);
    setForm({
      roll_number: student.roll_number || '',
      email: student.email || '',
      password: '',
      first_name: student.first_name || '',
      last_name: student.last_name || '',
      branch_id: student.branch_id ? String(student.branch_id) : '',
      academic_year_id: student.academic_year_id ? String(student.academic_year_id) : '',
      semester_id: student.semester_id ? String(student.semester_id) : '',
      batch_id: student.batch_id ? String(student.batch_id) : ''
    });
    setShowEdit(true);
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true); setError('');
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      const result = await adminApi.updateStudent(editingId, payload);
      setShowEdit(false);
      setEditingId(null);
      setForm(emptyForm);
      setNotice(result.message || 'Student updated successfully.');
      await load();
    } catch (e) {
      setError(e.message || 'Unable to update student.');
    } finally {
      setSaving(false);
    }
  };

  const formFields = (isEdit = false) => (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Roll Number *"><input required className={inputClass} value={form.roll_number} onChange={(e) => setForm({...form, roll_number:e.target.value.trim().toUpperCase()})}/></Field>
      <Field label="Email *"><input required type="email" className={inputClass} value={form.email} onChange={(e) => setForm({...form, email:e.target.value})}/></Field>
      <Field label="First Name *"><input required className={inputClass} value={form.first_name} onChange={(e) => setForm({...form, first_name:e.target.value})}/></Field>
      <Field label="Last Name"><input className={inputClass} value={form.last_name} onChange={(e) => setForm({...form, last_name:e.target.value})}/></Field>
      <Field label={isEdit ? 'New Password (leave blank to keep current)' : 'Password *'}><input required={!isEdit} type="password" className={inputClass} value={form.password} onChange={(e) => setForm({...form, password:e.target.value})}/></Field>
      <Field label="Branch *"><select required className={inputClass} value={form.branch_id} onChange={(e)=>setForm({...form, branch_id:e.target.value})}><option value="">Select branch</option>{option(options.branches, 'id', 'name')}</select></Field>
      <Field label="Academic Year *"><select required className={inputClass} value={form.academic_year_id} onChange={(e)=>setForm({...form, academic_year_id:e.target.value})}><option value="">Select academic year</option>{option(options.academicYears)}</select></Field>
      <Field label="Semester *"><select required className={inputClass} value={form.semester_id} onChange={(e)=>setForm({...form, semester_id:e.target.value})}><option value="">Select semester</option>{option(options.semesters,'id','name')}</select></Field>
      <Field label="Batch *"><select required className={inputClass} value={form.batch_id} onChange={(e)=>setForm({...form, batch_id:e.target.value})}><option value="">Select batch</option>{option(options.batches)}</select></Field>
    </div>
  );

  const submitStudent = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await adminApi.createStudent(form);
      setShowAdd(false); setForm(emptyForm); setNotice('Student added successfully.'); await load();
    } catch (e) { setError(e.message || 'Unable to add student.'); }
    finally { setSaving(false); }
  };

  const submitMove = async (e) => {
    e.preventDefault();
    if (!selected.size) return;
    setSaving(true); setError('');
    try {
      const result = await adminApi.moveStudents({ student_ids: [...selected], ...moveForm });
      setShowMove(false); setSelected(new Set()); setNotice(result.message || 'Students moved successfully.'); await load();
    } catch (e) { setError(e.message || 'Unable to move students.'); }
    finally { setSaving(false); }
  };

  const deleteStudents = async (ids) => {
    const count = ids.length;
    const message = count === 1
      ? 'Delete this student permanently? This will also remove their enrollments, movement records, video progress, question attempts and progress history. This cannot be undone.'
      : `Delete ${count} selected students permanently? This will also remove their enrollments, movement records, video progress, question attempts and progress history. This cannot be undone.`;
    if (!window.confirm(message)) return;

    setDeleting(true); setError(''); setNotice('');
    try {
      const result = await adminApi.deleteStudents(ids);
      setSelected(new Set());
      setNotice(result.message || `${count} student${count === 1 ? '' : 's'} deleted successfully.`);
      await load();
    } catch (e) {
      setError(e.message || 'Unable to delete student(s).');
    } finally {
      setDeleting(false);
    }
  };

  const option = (items, valueKey = 'id', labelKey = 'label') => items.map((item) => <option key={item[valueKey]} value={item[valueKey]}>{item[labelKey]}</option>);

  return <section>
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div></div>
      <div className="flex gap-2">
        <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RefreshCw size={16} /> Refresh</button>
        <button onClick={() => { setError(''); setShowAdd(true); }} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"><Plus size={17} /> Add Student</button>
      </div>
    </div>

    {notice && <div className="mb-4 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><span>{notice}</span><button onClick={() => setNotice('')}><X size={16}/></button></div>}
    {error && <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle size={17}/>{error}</div>}

    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-4">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1"><Search size={17} className="absolute left-3 top-3 text-slate-400"/><input className={`${inputClass} pl-9`} placeholder="Search roll number, name or email..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <select className={inputClass + ' lg:w-44'} value={filters.academic_year_id} onChange={(e) => setFilters({ ...filters, academic_year_id: e.target.value })}><option value="">All Academic Years</option>{option(options.academicYears)}</select>
          <select className={inputClass + ' lg:w-40'} value={filters.semester_id} onChange={(e) => setFilters({ ...filters, semester_id: e.target.value })}><option value="">All Semesters</option>{option(options.semesters, 'id', 'name')}</select>
          <select className={inputClass + ' lg:w-40'} value={filters.branch_id} onChange={(e) => setFilters({ ...filters, branch_id: e.target.value })}><option value="">All Branches</option>{option(options.branches, 'id', 'name')}</select>
          {options.batches.length > 0 && <select className={inputClass + ' lg:w-40'} value={filters.batch_id} onChange={(e) => setFilters({ ...filters, batch_id: e.target.value })}><option value="">All Batches</option>{option(options.batches)}</select>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>{students.length} student{students.length === 1 ? '' : 's'} shown</span>
          {selected.size > 0 && <div className="flex flex-wrap gap-2"><button disabled={deleting} onClick={() => deleteStudents([...selected])} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3.5 py-2 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"><Trash2 size={15}/> {deleting ? 'Deleting...' : `Delete ${selected.size} selected`}</button><button onClick={() => { setMoveForm({ academic_year_id: '', semester_id: '' }); setShowMove(true); }} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 font-semibold text-white hover:bg-slate-800"><ArrowRight size={15}/> Move {selected.size} selected</button></div>}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr>
            <th className="w-12 px-4 py-3"><button onClick={toggleAll}>{allSelected ? <CheckSquare size={17}/> : <Square size={17}/>}</button></th>
            <th className="px-4 py-3">Student</th><th className="px-4 py-3">Roll Number</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3">Academic Year</th><th className="px-4 py-3">Semester</th><th className="px-4 py-3">Batch</th><th className="px-4 py-3">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? <tr><td colSpan="8" className="px-4 py-12 text-center text-sm text-slate-500">Loading students...</td></tr> : students.length === 0 ? <tr><td colSpan="8" className="px-4 py-12 text-center"><Users className="mx-auto text-slate-300" size={30}/><p className="mt-2 text-sm font-semibold text-slate-600">No students found</p><p className="mt-1 text-xs text-slate-400">Try changing the filters or search.</p></td></tr> : students.map((student) => <tr key={student.id} className="hover:bg-slate-50">
              <td className="px-4 py-3"><button onClick={() => toggle(student.id)}>{selected.has(student.id) ? <CheckSquare size={17} className="text-blue-600"/> : <Square size={17} className="text-slate-300"/>}</button></td>
              <td className="px-4 py-3"><div className="font-semibold text-slate-800">{student.first_name} {student.last_name || ''}</div><div className="text-xs text-slate-400">{student.email}</div></td>
              <td className="px-4 py-3 text-sm font-medium text-slate-700">{student.roll_number}</td>
              <td className="px-4 py-3 text-sm text-slate-600">{student.branch_label || '-'}</td>
              <td className="px-4 py-3 text-sm text-slate-600">{student.academic_year_label || '-'}</td>
              <td className="px-4 py-3 text-sm text-slate-600">{student.semester_name || '-'}</td>
              <td className="px-4 py-3 text-sm text-slate-600">{student.batch_label || student.batch_id || '-'}</td>
              <td className="px-4 py-3"><div className="flex items-center gap-1.5">
                <button disabled={deleting || saving} onClick={() => openEdit(student)} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-[#2c6156] hover:bg-[#e0ebe6] disabled:opacity-50"><Pencil size={14}/> Edit</button>
                <button disabled={deleting || saving} onClick={() => deleteStudents([student.id])} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 size={14}/> Delete</button>
              </div></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>

    {showAdd && <Modal title="Add Student" onClose={() => !saving && setShowAdd(false)}>
      <form onSubmit={submitStudent} className="space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Roll Number *"><input required className={inputClass} value={form.roll_number} onChange={(e) => setForm({...form, roll_number:e.target.value.trim().toUpperCase()})}/></Field><Field label="Email *"><input required type="email" className={inputClass} value={form.email} onChange={(e) => setForm({...form,email:e.target.value})}/></Field><Field label="First Name *"><input required className={inputClass} value={form.first_name} onChange={(e) => setForm({...form,first_name:e.target.value})}/></Field><Field label="Last Name"><input className={inputClass} value={form.last_name} onChange={(e) => setForm({...form,last_name:e.target.value})}/></Field><Field label="Password *"><input required type="password" className={inputClass} value={form.password} onChange={(e) => setForm({...form,password:e.target.value})}/></Field><Field label="Branch *"><select required className={inputClass} value={form.branch_id} onChange={(e)=>setForm({...form,branch_id:e.target.value})}><option value="">Select branch</option>{option(options.branches, 'id', 'name')}</select></Field><Field label="Academic Year *"><select required className={inputClass} value={form.academic_year_id} onChange={(e)=>setForm({...form,academic_year_id:e.target.value})}><option value="">Select academic year</option>{option(options.academicYears)}</select></Field><Field label="Semester *"><select required className={inputClass} value={form.semester_id} onChange={(e)=>setForm({...form,semester_id:e.target.value})}><option value="">Select semester</option>{option(options.semesters,'id','name')}</select></Field><Field label="Batch *"><select required className={inputClass} value={form.batch_id} onChange={(e)=>setForm({...form,batch_id:e.target.value})}><option value="">Select batch</option>{option(options.batches)}</select></Field></div>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={()=>setShowAdd(false)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">Cancel</button><button disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving...' : 'Add Student'}</button></div>
      </form>
    </Modal>}

    {showEdit && <Modal title="Edit Student" onClose={() => !saving && setShowEdit(false)}>
      <form onSubmit={submitEdit} className="space-y-4 p-6">
        {formFields(true)}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={()=>setShowEdit(false)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">Cancel</button>
          <button disabled={saving} className="rounded-lg bg-[#2c6156] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#245247] disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </form>
    </Modal>}

    {showMove && <Modal title={`Move ${selected.size} Student${selected.size === 1 ? '' : 's'}`} onClose={() => !saving && setShowMove(false)}>
      <form onSubmit={submitMove} className="p-6">
        <div className="mb-5 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">The student record is kept unchanged. The current enrollment is closed and the target semester enrollment becomes current. If the student previously had the target enrollment, it is reactivated instead of creating a duplicate.</div>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Academic Year *"><select required className={inputClass} value={moveForm.academic_year_id} onChange={(e)=>setMoveForm({...moveForm,academic_year_id:e.target.value})}><option value="">Select academic year</option>{option(options.academicYears)}</select></Field><Field label="Semester *"><select required className={inputClass} value={moveForm.semester_id} onChange={(e)=>setMoveForm({...moveForm,semester_id:e.target.value})}><option value="">Select semester</option>{option(options.semesters,'id','name')}</select></Field></div>
        <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={()=>setShowMove(false)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">Cancel</button><button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><ArrowRight size={16}/>{saving ? 'Moving...' : 'Move Students'}</button></div>
      </form>
    </Modal>}
  </section>;
}
