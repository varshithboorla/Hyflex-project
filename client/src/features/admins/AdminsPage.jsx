import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { adminsApi, authApi } from '../../lib/api';

export default function AdminsPage() {
  const [admins, setAdmins] = useState([]);
  const [session, setSession] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try { setAdmins(await adminsApi.getAdmins()); }
    catch (e) { setError(e.message || 'Failed to load administrators.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); authApi.me().then(r => setSession(r.user)).catch(() => {}); }, []);

  const filtered = useMemo(() => admins.filter(a => String(a.email || '').toLowerCase().includes(search.trim().toLowerCase())), [admins, search]);
  const openAdd = () => { setModal({ id: null }); setEmail(''); setPassword(''); setMessage(''); };
  const openEdit = (a) => { setModal({ id: a.id }); setEmail(a.email || ''); setPassword(''); setMessage(''); };
  const close = () => { if (!saving) setModal(null); };

  const save = async () => {
    setMessage('');
    if (!email.trim()) return setMessage('Please enter an admin email.');
    if (!modal.id && !password) return setMessage('Password is required for a new admin.');
    setSaving(true);
    try {
      if (modal.id) await adminsApi.updateAdmin(modal.id, { email: email.trim(), password });
      else await adminsApi.createAdmin({ email: email.trim(), password });
      setModal(null); await load();
      if (modal.id && session?.id === modal.id) await authApi.me().then(r => setSession(r.user));
    } catch (e) { setMessage(e.message || 'Failed to save administrator.'); }
    finally { setSaving(false); }
  };

  const remove = async (a) => {
    if (session?.id === a.id) return alert('You cannot delete the administrator account you are currently logged in with.');
    if (!window.confirm(`Are you sure you want to delete admin "${a.email}"?`)) return;
    try { await adminsApi.deleteAdmin(a.id); await load(); }
    catch (e) { alert(e.message || 'Failed to delete administrator.'); }
  };

  return <section>
    {/* <PageHeader title="Administrators" description="Manage administrators and their access." /> */}
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Administrators</p><p className="mt-1 text-2xl font-extrabold text-slate-900">{admins.length}</p></div>
      <div className="flex gap-2"><button onClick={load} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 font-semibold text-slate-700"><RefreshCw size={16}/> Refresh</button><button onClick={openAdd} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white"><Plus size={17}/> Add Admin</button></div>
    </div>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b p-4"><div className="relative max-w-md"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search administrators by email..." className="w-full rounded-xl border py-2.5 pl-9 pr-3 outline-none focus:border-blue-400"/></div></div>
      {loading ? <div className="p-12 text-center text-slate-500">Loading administrators...</div> : error ? <div className="p-12 text-center text-red-600">{error}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-4">ID</th><th className="p-4">Email</th><th className="p-4">Created</th><th className="p-4">Actions</th></tr></thead><tbody>{filtered.map(a=>{const mine=session?.id===a.id; return <tr key={a.id} className="border-t border-slate-100"><td className="p-4 font-semibold">{a.id}</td><td className="p-4">{a.email} {mine&&<span className="ml-2 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">YOU</span>}</td><td className="p-4 text-slate-500">{a.created_at?new Date(a.created_at).toLocaleString():'—'}</td><td className="p-4"><div className="flex gap-2"><button onClick={()=>openEdit(a)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 font-semibold"><Pencil size={14}/> Edit</button>{!mine&&<button onClick={()=>remove(a)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-600"><Trash2 size={14}/> Delete</button>}</div></td></tr>})}{!filtered.length&&<tr><td colSpan="4" className="p-12 text-center text-slate-500">No admins found.</td></tr>}</tbody></table></div>}
    </div>
    {modal&&<div className="fixed inset-0 z-[70] grid place-items-center bg-slate-900/50 p-4"><div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b p-5"><div><h2 className="text-xl font-bold">{modal.id?'Edit Administrator':'Add Administrator'}</h2><p className="mt-1 text-sm text-slate-500">Create or update administrator credentials.</p></div><button onClick={close} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X/></button></div><div className="space-y-4 p-5"><label className="block"><span className="mb-1 block text-sm font-semibold">Email *</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@iare.ac.in" className="w-full rounded-xl border px-3 py-2.5"/></label><label className="block"><span className="mb-1 block text-sm font-semibold">Password {!modal.id&&'*'}</span><input type="text" value={password} onChange={e=>setPassword(e.target.value)} placeholder={modal.id?'Leave empty to keep existing password':'Enter password'} className="w-full rounded-xl border px-3 py-2.5"/><span className="mt-1 block text-xs text-slate-500">{modal.id?'Leave password empty if you do not want to change it.':'Password is required when creating a new administrator.'}</span></label>{message&&<p className="text-sm text-red-600">{message}</p>}</div><div className="flex justify-end gap-2 border-t p-4"><button onClick={close} disabled={saving} className="rounded-xl border px-4 py-2 font-semibold">Cancel</button><button onClick={save} disabled={saving} className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white">{saving?'Saving...':'Save Admin'}</button></div></div></div>}
  </section>;
}
