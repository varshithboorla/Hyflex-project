import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Check, Edit3, Folder, FolderSync, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { adminApi } from '../../lib/api';

const odd = (n) => Number(n) % 2 === 1;
const esc = (s) => s ?? '';

function termSemesters(semesters, type) {
  return semesters.filter(s => odd(s.semester_number) === (type === 'odd')).map(s => s.semester_number);
}
function semesterNumberFor(batch, folder, academicYears) {
  const year = academicYears.find(y => y.id === folder.academic_year_id);
  if (!year) return null;
  const start = Number(String(year.start_date).slice(0, 4));
  const n = (start - Number(batch.admission_year)) * 2 + (folder.semester_type === 'odd' ? 1 : 2);
  const last = (Number(batch.graduation_year) - Number(batch.admission_year)) * 2;
  return n >= 1 && n <= last ? n : null;
}
function isRunningNow(folder, academicYears) {
  const year = academicYears.find(y => y.id === folder.academic_year_id);
  if (!year?.is_current || !year.start_date) return false;
  const startMonth = new Date(`${year.start_date}T00:00:00`).getMonth() + 1;
  const month = new Date().getMonth() + 1;
  return (folder.semester_type === 'odd') === (month >= startMonth);
}

export default function CoursesPage() {
  const [searchParams] = useSearchParams();
  const [meta, setMeta] = useState({ branches: [], semesters: [], academicYears: [], regulations: [], batches: [], folders: [] });
  const [offerings, setOfferings] = useState([]);
  const [folderId, setFolderId] = useState(() => { const raw = searchParams.get('folder_id'); return raw ? Number(raw) : null; });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [folderModal, setFolderModal] = useState(null);
  const [courseModal, setCourseModal] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [m, o] = await Promise.all([adminApi.courseMeta(), adminApi.courseOfferings()]);
      setMeta(m); setOfferings(o.offerings || []);
    } catch (e) { setMessage({ type: 'error', text: e.message }); }
    finally { setLoading(false); }
  };
  useEffect(() => { const raw = searchParams.get('folder_id'); if (raw) setFolderId(Number(raw)); }, [searchParams]);

  useEffect(() => { load(); }, []);

  const foldersByYear = useMemo(() => meta.academicYears.map(year => ({ year, items: meta.folders.filter(f => f.academic_year_id === year.id).sort((a,b) => a.semester_type === 'odd' ? -1 : 1) })).filter(g => g.items.length), [meta]);
  const currentFolder = meta.folders.find(f => f.id === folderId);
  const folderOfferings = offerings.filter(o => o.folder_id === folderId);
  const folderBatches = currentFolder ? meta.batches.filter(b => semesterNumberFor(b, currentFolder, meta.academicYears) != null) : [];
  const visibleOfferings = folderOfferings.filter(o => {
    const name = o.courses?.course_name || '';
    const branches = o.course_offering_branches || [];
    return (!search || name.toLowerCase().includes(search.toLowerCase())) &&
      (!branchFilter || branches.some(b => String(b.branch_id) === String(branchFilter))) &&
      (!semesterFilter || String(o.semester_id) === String(semesterFilter)) &&
      (!batchFilter || String(o.batch_id) === String(batchFilter));
  });

  const openFolder = (id) => { setFolderId(id); setSearch(''); setBranchFilter(''); setSemesterFilter(''); setBatchFilter(''); };
  const sync = async () => { try { const r = await adminApi.syncCourseFolders(); setMeta(m => ({ ...m, folders: r.folders || [] })); setMessage({type:'success',text:'Folders synced successfully.'}); } catch(e){setMessage({type:'error',text:e.message});} };
  const notify = (type, text) => { setMessage({type,text}); setTimeout(()=>setMessage(null), 3500); };

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center text-slate-500"><Loader2 className="mr-2 animate-spin"/>Loading courses...</div>;

  return <section className="space-y-6">
    {message && <div className={`rounded-xl border px-4 py-3 text-sm ${message.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{message.text}</div>}
    {!currentFolder ? <>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        {/* <div><h2 className="text-2xl font-bold text-slate-900">Courses</h2><p className="mt-1 text-sm text-slate-500">Academic years contain automatic Odd and Even semester folders.</p></div> */}
        {/* <button onClick={sync} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-700"><FolderSync size={17}/> Sync folders</button> */}
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {foldersByYear.map(({year,items}) => <div key={year.id} className="contents">
          <div className="col-span-full -mb-2 mt-2 flex items-center gap-2 text-sm font-bold text-slate-800">{year.label}{year.is_current && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">current year</span>}</div>
          {items.map(folder => <div key={folder.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md">
            <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-600"><Folder size={21}/></div><div><h3 className="font-bold text-slate-900">{folder.semester_type === 'odd' ? 'Odd Semesters' : 'Even Semesters'}</h3><p className="text-xs text-slate-500">Sem {termSemesters(meta.semesters, folder.semester_type).join(', ')}</p></div></div>
            <p className="text-sm text-slate-500">{offerings.filter(o=>o.folder_id===folder.id).length} course offering(s) {isRunningNow(folder,meta.academicYears) && <span className="ml-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">running now</span>}</p>
            {folder.description && <p className="line-clamp-3 text-xs leading-5 text-slate-500">{folder.description}</p>}
            <div className="mt-auto flex gap-2"><button onClick={()=>openFolder(folder.id)} className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">Open</button><button onClick={()=>setFolderModal(folder)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"><Pencil size={15}/></button></div>
          </div>)}
        </div>)}
      </div>
    </> : <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><button onClick={()=>setFolderId(null)} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700"><ArrowLeft size={16}/> Back to folders</button><h2 className="text-2xl font-bold text-slate-900">{currentFolder.semester_type === 'odd' ? 'Odd Semesters' : 'Even Semesters'}</h2><p className="mt-1 text-sm text-slate-500">Only semesters {termSemesters(meta.semesters,currentFolder.semester_type).join(', ')} can be added here.{currentFolder.description ? ` ${currentFolder.description}` : ''}</p></div>
        <button onClick={()=>setCourseModal({mode:'add'})} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={17}/> Add Course</button>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="grid gap-3 md:grid-cols-[1fr_180px_180px_180px_auto]"><div className="relative"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search courses..." className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-400"/></div><select value={branchFilter} onChange={e=>setBranchFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 text-sm"><option value="">All Departments</option>{meta.branches.map(b=><option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}</select><select value={semesterFilter} onChange={e=>setSemesterFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 text-sm"><option value="">All Semesters</option>{meta.semesters.filter(s=>odd(s.semester_number)===(currentFolder.semester_type==='odd')).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><select value={batchFilter} onChange={e=>setBatchFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 text-sm"><option value="">All Batches</option>{folderBatches.map(b=><option key={b.id} value={b.id}>{b.label} (Sem {semesterNumberFor(b,currentFolder,meta.academicYears)})</option>)}</select><button onClick={()=>{setSearch('');setBranchFilter('');setSemesterFilter('');setBatchFilter('')}} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Clear</button></div></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleOfferings.map(o=>{ const batch=meta.batches.find(b=>b.id===o.batch_id); const branchIds=(o.course_offering_branches||[]).map(x=>x.branch_id); const all=meta.branches.length>0 && meta.branches.every(b=>branchIds.includes(b.id)); const sem=meta.semesters.find(s=>s.id===o.semester_id); return <div key={o.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-slate-900">{o.courses?.course_name || '(unnamed course)'}</h3><p className="mt-1 text-xs text-slate-500">{batch?.label || '-'} · {sem?.name || '-'}</p></div><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${o.is_published ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{o.is_published ? 'Published' : 'Draft'}</span></div><div className="mt-4 flex flex-wrap gap-1.5">{all ? <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">All Branches</span> : branchIds.map(id=>{const b=meta.branches.find(x=>x.id===id);return b?<span key={id} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600">{b.code || b.name}</span>:null})}</div><div className="mt-5 flex gap-2"><button onClick={()=>window.location.href=`/admin/videos?offering_id=${o.id}`} className="flex-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100">Videos</button><button onClick={()=>setCourseModal({mode:'edit',offering:o})} className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50"><Edit3 size={15}/></button><button onClick={async()=>{if(!confirm(`Delete "${o.courses?.course_name}"?\n\nAll videos, questions and student progress for this offering will also be deleted.`))return;try{await adminApi.deleteCourse(o.id);await load();notify('success','Course deleted successfully.')}catch(e){notify('error',e.message)}}} className="rounded-lg border border-red-200 px-3 py-2 text-red-600 hover:bg-red-50"><Trash2 size={15}/></button></div></div>})}
        {!visibleOfferings.length && <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center text-sm text-slate-500">No courses match the selected filters.</div>}
      </div>
    </>}
    {folderModal && <FolderModal folder={folderModal} onClose={()=>setFolderModal(null)} onSave={async(description)=>{try{await adminApi.updateCourseFolder(folderModal.id,{description});await load();setFolderModal(null);notify('success','Folder note updated.')}catch(e){notify('error',e.message)}}}/>} 
    {courseModal && <CourseModal data={courseModal} currentFolder={currentFolder} meta={meta} academicYears={meta.academicYears} offerings={offerings} onClose={()=>setCourseModal(null)} onSaved={async(text)=>{await load();setCourseModal(null);notify('success',text)}} onError={e=>notify('error',e.message)}/>} 
  </section>;
}

function FolderModal({folder,onClose,onSave}){const [v,setV]=useState(folder.description||'');const [busy,setBusy]=useState(false);return <Modal title="Folder note" onClose={onClose}><input disabled value={folder.name} className="mb-4 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"/><textarea value={v} onChange={e=>setV(e.target.value)} rows={5} placeholder="Short description of this folder..." className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"/><div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={busy} onClick={async()=>{setBusy(true);await onSave(v);setBusy(false)}} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">{busy?'Saving...':'Save Note'}</button></div></Modal>}

function CourseModal({data,currentFolder,meta,academicYears,onClose,onSaved,onError}){
 const editing=data.mode==='edit'; const o=data.offering;
 const [name,setName]=useState(o?.courses?.course_name||''); const [semesterId,setSemesterId]=useState(String(o?.semester_id||'')); const [batchIds,setBatchIds]=useState(o?[o.batch_id]:[]); const [branchIds,setBranchIds]=useState((o?.course_offering_branches||[]).map(x=>x.branch_id)); const [allBranches,setAllBranches]=useState(false); const [published,setPublished]=useState(o?.is_published!==false); const [busy,setBusy]=useState(false); const sems=meta.semesters.filter(s=>odd(s.semester_number)===(currentFolder.semester_type==='odd')); const eligible=meta.batches.filter(b=>semesterNumberFor(b,currentFolder,academicYears)!=null && (!semesterId || semesterNumberFor(b,currentFolder,academicYears)===Number(sems.find(s=>String(s.id)===semesterId)?.semester_number)));
 useEffect(()=>{if(editing&&branchIds.length===meta.branches.length)setAllBranches(true)},[]);
 const toggleBranch=id=>setBranchIds(x=>x.includes(id)?x.filter(v=>v!==id):[...x,id]);
 const save=async()=>{if(!name.trim())return onError(new Error('Please enter the course name.'));if(!semesterId)return onError(new Error('Please select a semester.'));if(batchIds.length===0)return onError(new Error('Please select at least one batch.'));const ids=allBranches?meta.branches.map(b=>b.id):branchIds;if(!ids.length)return onError(new Error('Please select at least one branch, or check All Branches.'));setBusy(true);try{if(editing){await adminApi.updateCourse(o.id,{course_name:name.trim(),semester_id:Number(semesterId),batch_id:Number(batchIds[0]),branch_ids:ids,is_published:published});await onSaved('Course updated successfully.')}else{const r=await adminApi.createCourse({course_name:name.trim(),folder_id:currentFolder.id,semester_id:Number(semesterId),batch_ids:batchIds,branch_ids:ids,is_published:published});await onSaved(r.message)} }catch(e){onError(e)}finally{setBusy(false)}};
 return <Modal title={editing?'Edit Course':'Add Course'} onClose={onClose}><div className="space-y-5"><div><label className="mb-1.5 block text-xs font-semibold text-slate-600">Folder</label><div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700">{currentFolder.semester_type==='odd'?'Odd Semesters':'Even Semesters'}</div></div><div><label className="mb-1.5 block text-xs font-semibold text-slate-600">Course Name</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="Enter course name" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"/></div><div><label className="mb-1.5 block text-xs font-semibold text-slate-600">Branches / Departments</label><label className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={allBranches} onChange={e=>setAllBranches(e.target.checked)} /> Give this course to <strong>All Branches</strong></label><div className={`grid max-h-40 gap-2 overflow-y-auto rounded-lg border border-slate-200 p-3 sm:grid-cols-2 ${allBranches?'opacity-50':''}`}>{meta.branches.map(b=><label key={b.id} className="flex items-center gap-2 text-sm"><input disabled={allBranches} type="checkbox" checked={branchIds.includes(b.id)} onChange={()=>toggleBranch(b.id)}/>{b.name} ({b.code})</label>)}</div></div><div><label className="mb-1.5 block text-xs font-semibold text-slate-600">Semester</label><select value={semesterId} onChange={e=>{setSemesterId(e.target.value);if(!editing)setBatchIds([])}} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"><option value="">Select Semester</option>{sems.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div><div><label className="mb-1.5 block text-xs font-semibold text-slate-600">Batch</label><div className="grid max-h-44 gap-2 overflow-y-auto rounded-lg border border-slate-200 p-3 sm:grid-cols-2">{eligible.map(b=><label key={b.id} className="flex items-center gap-2 text-sm"><input disabled={editing} type={editing?'radio':'checkbox'} name="courseBatch" checked={batchIds.includes(b.id)} onChange={()=>setBatchIds(editing?[b.id]:batchIds.includes(b.id)?batchIds.filter(x=>x!==b.id):[...batchIds,b.id])}/>{b.label} <span className="text-xs text-slate-400">Sem {semesterNumberFor(b,currentFolder,academicYears)}</span></label>)}{!eligible.length&&<p className="text-xs text-slate-500">No batch studies in this semester for this folder.</p>}</div></div><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={published} onChange={e=>setPublished(e.target.checked)}/> Publish course</label></div><div className="mt-6 flex justify-end gap-2"><button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={busy} onClick={save} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">{busy?'Saving...':'Save Course'}</button></div></Modal>
}
function Modal({title,onClose,children}){return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h3 className="text-lg font-bold text-slate-900">{title}</h3><button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button></div><div className="p-5">{children}</div></div></div>}
