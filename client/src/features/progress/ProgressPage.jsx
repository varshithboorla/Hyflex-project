import { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Search, X, Users, RefreshCw, Printer, Filter } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { progressApi } from '../../lib/api';

const statusOf = p => p?.completed ? 'completed' : ((Number(p?.max_watched_seconds) || 0) > 0 || (Number(p?.questions_solved) || 0) > 0) ? 'in_progress' : 'not_started';
const statusLabel = s => s === 'completed' ? 'Completed' : s === 'in_progress' ? 'In Progress' : 'Not Started';
const score = n => Math.round(Number(n) || 0);
const pct = n => `${Math.round((Number(n) || 0) * 10) / 10}%`;
const time = n => { const s=Math.max(0,Number(n)||0); const h=Math.floor(s/3600); const m=Math.floor((s%3600)/60); const sec=Math.floor(s%60); return h ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`; };
const safe = v => String(v ?? '').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'') || 'Report';
const esc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function computeMetrics(studentId, topics, progressMap) {
  let scoreSum=0, watchSum=0, completedCount=0;
  const scores=topics.map(topic=>{
    const p=progressMap.get(`${studentId}:${topic.video_id}`);
    const total=Number(p?.total_questions)||0;
    const correct=Number(p?.correct_answers)||0;
    const topicScore=p?.completed && total>0 ? Math.min(100,(correct/total)*100) : 0;
    const watched=Number(p?.max_watched_seconds)||0;
    const duration=Number(topic.duration_seconds)||0;
    const watchedPct=duration>0 ? Math.min(100,(watched/duration)*100) : (p?.completed?100:0);
    scoreSum+=topicScore; watchSum+=watchedPct; if(p?.completed) completedCount++;
    return { topic,p,topicScore,watchedPct };
  });
  const current=scores[scores.length-1] || {p:null,topicScore:0,watchedPct:0};
  const count=topics.length||1;
  return { current, topicScore:current.topicScore, watchedPct:current.watchedPct, cumulativeScore:scoreSum/count, cumulativeWatchedPct:watchSum/count, topicsCompleted:completedCount, topicsNotCompleted:topics.length-completedCount, topicCount:topics.length };
}

function downloadBlob(content, type, filename) {
  const url=URL.createObjectURL(new Blob([content],{type})); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

export default function ProgressPage(){
  const [data,setData]=useState(null), [loading,setLoading]=useState(true), [error,setError]=useState('');
  const [search,setSearch]=useState(''), [course,setCourse]=useState('');
  const [selected,setSelected]=useState(null), [studentSearch,setStudentSearch]=useState('');
  const [branch,setBranch]=useState(''), [batch,setBatch]=useState(''), [year,setYear]=useState(''), [semester,setSemester]=useState(''), [status,setStatus]=useState('');

  const load=async()=>{setLoading(true);setError('');try{setData(await progressApi.getProgress())}catch(e){setError(e.message||'Unable to load progress.')}finally{setLoading(false)}};
  useEffect(()=>{load()},[]);

  const progressMap=useMemo(()=>new Map((data?.progress||[]).map(p=>[`${p.student_id}:${p.video_id}`,p])),[data]);
  const rows=useMemo(()=>{
    if(!data)return [];
    return data.videos.filter(v=>{const hay=[v.video_title,v.course?.course_name,v.course?.course_code].filter(Boolean).join(' ').toLowerCase();return(!search||hay.includes(search.toLowerCase()))&&(!course||String(v.course?.course_id||'')===course)})
      .sort((a,b)=>(Number(a.display_order)||0)-(Number(b.display_order)||0)).map(v=>v);
  },[data,search,course]);

  const detail=useMemo(()=>{
    if(!selected||!data)return null;
    const topics=data.videos.filter(v=>String(v.offering_id)===String(selected.offering_id)).sort((a,b)=>(Number(a.display_order)||0)-(Number(b.display_order)||0));
    const idx=topics.findIndex(v=>Number(v.video_id)===Number(selected.video_id)); const upto=idx>=0?topics.slice(0,idx+1):[selected];
    const assignments=[...new Map(data.assignments.filter(a=>String(a.offering_id)===String(selected.offering_id)).map(a=>[String(a.student_id),a])).values()];
    const out=assignments.map(a=>{
      const m=computeMetrics(a.student_id,upto,progressMap); const p=m.current.p;
      return {...a,...m,status:statusOf(p)};
    });
    return {topics,rows:out};
  },[selected,data,progressMap]);

  const filteredStudents=useMemo(()=>{
    if(!detail)return [];
    return detail.rows.filter(r=>{const s=r.student||{};const hay=[s.roll_number,s.first_name,s.last_name,s.email].filter(Boolean).join(' ').toLowerCase();
      return(!studentSearch||hay.includes(studentSearch.toLowerCase()))&&(!branch||String(r.branch?.id||s.branch_id||'')===branch)&&(!batch||String(r.batch?.id||r.batch_id||s.batch_id||'')===batch)&&(!year||String(r.academic_year?.id||r.academic_year_id||'')===year)&&(!semester||String(r.semester?.id||r.semester_id||'')===semester)&&(!status||r.status===status);
    });
  },[detail,studentSearch,branch,batch,year,semester,status]);

  const clearStudentFilters=()=>{setStudentSearch('');setBranch('');setBatch('');setYear('');setSemester('');setStatus('')};

  const exportRows=filteredStudents.map((r,i)=>({
    'S.No':i+1,'Roll No':r.student?.roll_number||'','Student':[r.student?.first_name,r.student?.last_name].filter(Boolean).join(' '),'Email':r.student?.email||'',
    'Section':r.student?.section||'','Max Watched':time(r.current?.p?.max_watched_seconds),'Topic Watched %':score(r.watchedPct),'Cumulative Watched %':score(r.cumulativeWatchedPct),
    'Topic Score':score(r.topicScore),'Cumulative Score (out of 100)':score(r.cumulativeScore),'Topics Completed':r.topicsCompleted,'Topics Not Completed':r.topicsNotCompleted,'Status':statusLabel(r.status),'Last Updated':r.current?.p?.updated_at?new Date(r.current.p.updated_at).toLocaleString():''
  }));

  const exportCsv=()=>{if(!exportRows.length)return;const headers=Object.keys(exportRows[0]);const csv=[headers,...exportRows.map(r=>headers.map(h=>r[h]??''))].map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');downloadBlob('\ufeff'+csv,'text/csv;charset=utf-8;',`EduLearn_${safe(selected?.video_title)}_Student_Progress.csv`)};
  const exportExcel=()=>{if(!exportRows.length)return;const headers=Object.keys(exportRows[0]);const html=`<html><head><meta charset="UTF-8"></head><body><table border="1"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${exportRows.map(r=>`<tr>${headers.map(h=>`<td>${esc(r[h])}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;downloadBlob(html,'application/vnd.ms-excel',`EduLearn_${safe(selected?.video_title)}_Student_Progress.xls`)};
  const printReport=()=>{
    if(!filteredStudents.length || !selected || !detail || !data) return;

    const offering=selected.offering || {};
    const academicYear=(data.academic_years||[]).find(x=>String(x.id)===String(offering.academic_year_id));
    const semester=(data.semesters||[]).find(x=>String(x.id)===String(offering.semester_id));
    const topics=detail.topics || [];
    const topicIndex=Math.max(0, topics.findIndex(x=>Number(x.video_id)===Number(selected.video_id)));
    const topicNumber=topicIndex+1;
    const courseName=selected.course?.course_name || 'Course';
    const semesterName=semester?.name || `Semester ${semester?.semester_number || ''}`.trim();
    const academicYearLabel=academicYear?.label || 'Academic Year';
    const dateLabel=new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'});
    const totalStudents=filteredStudents.length;
    const completedStudents=filteredStudents.filter(r=>r.status==='completed').length;
    const notCompletedStudents=totalStudents-completedStudents;
    const completionRate=totalStudents ? Math.round((completedStudents/totalStudents)*100) : 0;

    const groups=new Map();
    filteredStudents.forEach(r=>{
      const name=r.branch?.name || r.branch?.code || 'Department Not Assigned';
      if(!groups.has(name)) groups.set(name,[]);
      groups.get(name).push(r);
    });
    const orderedGroups=[...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0]));

    const summaryRows=orderedGroups.map(([name,rows],i)=>{
      const done=rows.filter(r=>r.status==='completed').length;
      return `<tr><td>${i+1}</td><td class="left">${esc(name)}</td><td>${rows.length}</td><td class="green">${done}</td><td class="red">${rows.length-done}</td></tr>`;
    }).join('');
    const totalSummary=`<tr class="total"><td colspan="2">TOTAL</td><td>${totalStudents}</td><td>${completedStudents}</td><td>${notCompletedStudents}</td></tr>`;

    const branchSections=orderedGroups.map(([name,rows])=>{
      const done=rows.filter(r=>r.status==='completed').length;
      const studentRows=rows.map((r,i)=>`<tr>
        <td>${i+1}</td>
        <td>${esc(r.student?.roll_number||'—')}</td>
        <td class="left">${esc([r.student?.first_name,r.student?.last_name].filter(Boolean).join(' ')||'—')}</td>
        <td>${pct(r.watchedPct)}</td>
        <td>${pct(r.cumulativeWatchedPct)}</td>
        <td>${score(r.topicScore)}</td>
        <td>${score(r.cumulativeScore)}</td>
        <td>${r.topicsCompleted}</td>
        <td>${r.topicsNotCompleted}</td>
        <td class="${r.status==='completed'?'green':r.status==='in_progress'?'amber':'red'}">${esc(statusLabel(r.status))}</td>
      </tr>`).join('');
      return `<section class="branch-section">
        <div class="branch-title"><span>${esc(name)}</span><span>${rows.length} student${rows.length===1?'':'s'} • ${done} completed • ${rows.length-done} not completed</span></div>
        <table class="student-table"><thead><tr>
          <th>S.No</th><th>Roll<br>Number</th><th>Student</th><th>Topic<br>Watched %</th><th>Cumulative<br>Watched %</th><th>Topic ${topicNumber}<br>Score</th><th>Cumulative Score<br>(out of 100)</th><th>Topics<br>Completed</th><th>Topics Not<br>Completed</th><th>Status</th>
        </tr></thead><tbody>${studentRows}</tbody></table>
      </section>`;
    }).join('');

    const reportTitle=`${courseName} - Topic ${topicNumber} Student Progress`;
    const w=window.open('','_blank','width=1100,height=850');
    if(!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="UTF-8"><title>${esc(reportTitle)}</title>
      <style>
        @page{size:A4 portrait;margin:9mm 8mm 10mm 8mm}
        *{box-sizing:border-box}
        body{margin:0;background:#fff;color:#17365d;font-family:Arial,Helvetica,sans-serif;font-size:8px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .page{width:100%;min-height:100vh;position:relative;padding-bottom:14mm}
        .header-logo{display:block;width:78%;max-width:460px;height:auto;margin:0 auto 4px}
        .header-line{height:3px;background:#2d4f82;margin:0 0 5px}
        .title{text-align:center;font-size:13px;font-weight:800;margin:0;color:#294b7d}
        .subtitle{text-align:center;font-size:10px;font-weight:700;margin:2px 0;color:#294b7d}
        .meta{text-align:center;font-size:7.5px;font-weight:700;margin:2px 0 9px;color:#294b7d}
        .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:9px}
        .card{height:42px;border:1px solid #a8bfd7;border-top:4px solid #294b7d;text-align:center;padding:5px 2px 2px;background:#fff}
        .card:nth-child(2){border-top-color:#168455}.card:nth-child(3){border-top-color:#c92e36}.card:nth-child(4){border-top-color:#294b7d}
        .card .n{font-size:15px;font-weight:800;color:#183c6b;line-height:15px}.card .l{font-size:6.5px;font-weight:800;color:#66758a;letter-spacing:.4px;margin-top:3px}
        .section-title{font-size:9px;font-weight:800;color:#244879;border-left:5px solid #294b7d;padding-left:6px;margin:8px 0 4px}
        table{width:100%;border-collapse:collapse;table-layout:fixed}
        th{background:#294f86;color:#fff;border:1px solid #a9bdd2;font-size:6.7px;font-weight:800;padding:4px 2px;text-align:center;line-height:1.05}
        td{border:1px solid #a9bdd2;color:#17365d;font-size:7px;padding:4px 2px;text-align:center;line-height:1.05;vertical-align:middle}
        .left{text-align:left}.green{color:#008451;font-weight:800}.red{color:#c72e38;font-weight:800}.amber{color:#b56b00;font-weight:800}
        .total td{background:#294f86;color:#fff;font-weight:800}
        .branch-section{break-inside:avoid;margin-bottom:8px}
        .branch-title{display:flex;justify-content:space-between;align-items:center;background:#eaf1f8;border-left:4px solid #294f86;color:#294f86;font-weight:800;font-size:7.5px;padding:4px 5px;margin-bottom:3px}
        .student-table th:nth-child(1){width:5%}.student-table th:nth-child(2){width:10%}.student-table th:nth-child(3){width:17%}.student-table th:nth-child(4){width:9%}.student-table th:nth-child(5){width:10%}.student-table th:nth-child(6){width:9%}.student-table th:nth-child(7){width:12%}.student-table th:nth-child(8){width:8%}.student-table th:nth-child(9){width:9%}.student-table th:nth-child(10){width:11%}
        .footer{position:fixed;left:0;right:0;bottom:2mm;display:flex;justify-content:space-between;color:#6b7280;font-size:6.5px;font-weight:700}
        .dean{text-align:right;font-weight:800;font-size:7px;color:#3f4650;margin-top:5px}
        @media print{.no-print{display:none}.page{min-height:auto}}
      </style></head><body><div class="page">
        <img class="header-logo" src="${new URL('/iare-logo.jpeg',window.location.origin).href}" onerror="this.style.display='none'"/>
        <div class="header-line"></div>
        <div class="title">HyFlex Learning | ${esc(courseName)} | ${esc(semesterName)} | AY ${esc(academicYearLabel)}</div>
        <div class="subtitle">Topic ${topicNumber}: ${esc(selected.video_title)}</div>
        <div class="meta">Cumulative Scores: T 1 to T ${topicNumber} &nbsp;|&nbsp; Date: ${esc(dateLabel)}</div>
        <div class="cards">
          <div class="card"><div class="n">${totalStudents}</div><div class="l">TOTAL STUDENTS</div></div>
          <div class="card"><div class="n">${completedStudents}</div><div class="l">COMPLETED</div></div>
          <div class="card"><div class="n">${notCompletedStudents}</div><div class="l">NOT COMPLETED</div></div>
          <div class="card"><div class="n">${completionRate}%</div><div class="l">COMPLETION RATE</div></div>
        </div>
        <div class="section-title">1. Department-wise Summary</div>
        <table><thead><tr><th style="width:9%">S.No</th><th style="width:41%">Department</th><th style="width:17%">Total<br>Students</th><th style="width:17%">Completed<br>Students</th><th style="width:16%">Not Completed<br>Students</th></tr></thead><tbody>${summaryRows}${totalSummary}</tbody></table>
        <div class="section-title">2. Branch-wise Student Progress</div>
        ${branchSections || '<div style="padding:12px;text-align:center;color:#64748b">No student progress found.</div>'}
        <div class="dean">DEAN- TIPS</div>
      </div><div class="footer"><span>HyFlex Learning</span><span>Page 1 of 1</span></div>
      <script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`);
    w.document.close();
  };


  if(loading)return <section>
  <PageHeader title="Video Progress" description="View completion status for each video and inspect the complete student list."/>
  <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">Loading video progress…</div></section>;
  if(error)return <section><PageHeader title="Video Progress" description="View completion status for each video and inspect the complete student list."/><div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">{error}<button onClick={load} className="ml-3 rounded-lg bg-red-600 px-3 py-2 text-white">Retry</button></div></section>;
  const total=rows.length, completed=rows.reduce((n,r)=>n+r.completed,0), inProgress=rows.reduce((n,r)=>n+r.in_progress,0), notStarted=rows.reduce((n,r)=>n+r.not_started,0);

  return <section className="space-y-5">
    {/* <PageHeader title="Video Progress" description="View completion status for each video and inspect the complete student list."/> */}
    <div className="flex flex-wrap justify-end gap-2"><button onClick={load} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 font-semibold text-slate-700 shadow-sm"><RefreshCw size={16}/> Refresh</button></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[['Total Videos',total,'text-blue-700'],['Completed',completed,'text-emerald-700'],['In Progress',inProgress,'text-amber-700'],['Not Started',notStarted,'text-slate-600']].map(([l,n,c])=><div key={l} className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{l}</p><p className={`mt-2 text-3xl font-bold ${c}`}>{n}</p></div>)}</div>
    <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="grid gap-3 lg:grid-cols-[1fr_280px_auto]"><div className="relative"><Search size={17} className="absolute left-3 top-3 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search video or course..." className="w-full rounded-xl border py-2.5 pl-10 pr-3 outline-none focus:border-blue-500"/></div><select value={course} onChange={e=>setCourse(e.target.value)} className="rounded-xl border px-3 py-2.5"><option value="">All Courses</option>{(data?.courses||[]).sort((a,b)=>String(a.course_name).localeCompare(String(b.course_name))).map(c=><option key={c.course_id} value={c.course_id}>{c.course_name}{c.course_code?` (${c.course_code})`:''}</option>)}</select><button onClick={()=>{setSearch('');setCourse('')}} className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 font-semibold text-slate-700"><Filter size={16}/> Clear Filters</button></div><div className="mt-3 text-sm text-slate-500">Showing {rows.length} video{rows.length===1?'':'s'}</div></div>
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[950px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-4">#</th><th className="p-4">Course</th><th className="p-4">Video</th><th className="p-4">Completed</th><th className="p-4">In Progress</th><th className="p-4">Not Started</th><th className="p-4">Total Students</th><th className="p-4">Students</th></tr></thead><tbody>{rows.length?rows.map((r,i)=><tr key={r.video_id} className="border-t"><td className="p-4">{i+1}</td><td className="p-4"><div className="font-semibold">{r.course?.course_name||'—'}</div><div className="text-xs text-slate-400">{r.course?.course_code||''}</div></td><td className="p-4 font-semibold">{r.video_title}</td><td className="p-4"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{r.completed}</span></td><td className="p-4"><span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">{r.in_progress}</span></td><td className="p-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{r.not_started}</span></td><td className="p-4 font-semibold">{r.student_count}</td><td className="p-4"><button onClick={()=>{setSelected(r);clearStudentFilters()}} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white"><Users size={15}/> View Students</button></td></tr>):<tr><td colSpan="8" className="p-10 text-center text-slate-500">No videos found.</td></tr>}</tbody></table></div></div>

    {selected&&detail&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><div className="flex max-h-[94vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b p-5"><div><h2 className="text-xl font-bold text-slate-900">{selected.video_title}</h2><p className="text-sm text-slate-500">{selected.course?.course_name||'Course'} {selected.course?.course_code?`• ${selected.course.course_code}`:''}</p><p className="mt-1 text-xs text-slate-400">Topic score is 0 until the video is completed. Cumulative score is calculated from Topic 1 through this topic.</p></div><button onClick={()=>setSelected(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X/></button></div><div className="grid gap-3 border-b p-4 md:grid-cols-3 lg:grid-cols-7"><div className="relative lg:col-span-2"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={studentSearch} onChange={e=>setStudentSearch(e.target.value)} placeholder="Roll number, name or email..." className="w-full rounded-xl border py-2.5 pl-9 pr-3"/></div><select value={branch} onChange={e=>setBranch(e.target.value)} className="rounded-xl border px-3 py-2.5"><option value="">All Branches</option>{(data.branches||[]).map(x=><option key={x.id} value={x.id}>{x.name||x.code}</option>)}</select><select value={batch} onChange={e=>setBatch(e.target.value)} className="rounded-xl border px-3 py-2.5"><option value="">All Batches</option>{(data.batches||[]).map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select><select value={year} onChange={e=>setYear(e.target.value)} className="rounded-xl border px-3 py-2.5"><option value="">All Academic Years</option>{(data.academic_years||[]).map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select><select value={semester} onChange={e=>setSemester(e.target.value)} className="rounded-xl border px-3 py-2.5"><option value="">All Semesters</option>{(data.semesters||[]).sort((a,b)=>a.semester_number-b.semester_number).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><select value={status} onChange={e=>setStatus(e.target.value)} className="rounded-xl border px-3 py-2.5"><option value="">All Status</option><option value="completed">Completed</option><option value="in_progress">In Progress</option><option value="not_started">Not Started</option></select><button onClick={clearStudentFilters} className="inline-flex items-center justify-center gap-1 rounded-xl border px-3 py-2.5 font-semibold"><Filter size={15}/> Clear</button></div><div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 p-3"><span className="text-sm text-slate-600">Showing {filteredStudents.length} student{filteredStudents.length===1?'':'s'}</span><div className="flex gap-2"><button onClick={exportCsv} disabled={!filteredStudents.length} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold"><Download size={15}/> CSV</button><button onClick={exportExcel} disabled={!filteredStudents.length} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"><FileSpreadsheet size={15}/> Excel</button><button onClick={printReport} disabled={!filteredStudents.length} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold"><Printer size={15}/> Print Report</button></div></div><div className="flex-1 overflow-auto"><table className="w-full min-w-[1450px] text-sm"><thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3">#</th><th className="p-3">Roll No</th><th className="p-3">Student</th><th className="p-3">Email</th><th className="p-3">Max Watched / Total</th><th className="p-3">Topic Watched %</th><th className="p-3">Cumulative Watched %</th><th className="p-3">Topic Score</th><th className="p-3">Cumulative Score</th><th className="p-3">Topics Completed</th><th className="p-3">Topics Not Completed</th><th className="p-3">Status</th><th className="p-3">Last Updated</th></tr></thead><tbody>{filteredStudents.length?filteredStudents.map((r,i)=><tr key={r.student_id} className="border-t"><td className="p-3">{i+1}</td><td className="p-3 font-semibold">{r.student?.roll_number||'—'}</td><td className="p-3">{[r.student?.first_name,r.student?.last_name].filter(Boolean).join(' ')||'—'}</td><td className="p-3">{r.student?.email||'—'}</td><td className="p-3">{time(r.current?.p?.max_watched_seconds)} / {Number(r.current?.topic?.duration_seconds)?time(r.current.topic.duration_seconds):'—'}</td><td className="p-3">{pct(r.watchedPct)}</td><td className="p-3">{pct(r.cumulativeWatchedPct)}</td><td className="p-3 font-bold">{score(r.topicScore)}</td><td className="p-3 font-bold">{score(r.cumulativeScore)}</td><td className="p-3">{r.topicsCompleted}</td><td className="p-3">{r.topicsNotCompleted}</td><td className="p-3"><span className={`rounded-full px-2.5 py-1 ${r.status==='completed'?'bg-emerald-50 text-emerald-700':r.status==='in_progress'?'bg-amber-50 text-amber-700':'bg-slate-100 text-slate-600'}`}>{statusLabel(r.status)}</span></td><td className="p-3">{r.current?.p?.updated_at?new Date(r.current.p.updated_at).toLocaleString():'—'}</td></tr>):<tr><td colSpan="13" className="p-10 text-center text-slate-500">No students match the selected filters.</td></tr>}</tbody></table></div></div></div>}


  </section>;
}
