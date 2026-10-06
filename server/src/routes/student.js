import { Router } from 'express';
import { supabase } from '../supabase.js';

const router = Router();
router.use((req,res,next)=>{
  if (!req.session.user || req.session.user.role !== 'student') return res.status(401).json({message:'Student authentication required.'});
  next();
});

async function currentStudent(req) {
  const id = Number(req.session.user.id);
  const student = await supabase.from('students')
    .select('id,roll_number,email,first_name,last_name,batch_id,branch_id,semester_id,status')
    .eq('id', id).maybeSingle();
  if (student.error) throw student.error;
  if (!student.data || (student.data.status && student.data.status !== 'active')) return null;
  const enrollment = await supabase.from('student_enrollments')
    .select('id,academic_year_id,semester_id,is_current,status')
    .eq('student_id', id).eq('is_current',true).eq('status','active')
    .order('created_at',{ascending:false}).limit(1).maybeSingle();
  if (enrollment.error) throw enrollment.error;
  return {...student.data, enrollment: enrollment.data || null};
}

router.get('/profile', async (req,res)=>{
  try {
    const student = await currentStudent(req);
    if (!student) return res.status(404).json({message:'Student account or current enrollment not found.'});
    const [branch, batch, semester, year] = await Promise.all([
      supabase.from('branches').select('id,name,code').eq('id',student.branch_id).maybeSingle(),
      supabase.from('batches').select('id,label,admission_year,graduation_year,regulation_id').eq('id',student.batch_id).maybeSingle(),
      student.enrollment?.semester_id ? supabase.from('semesters').select('id,name,semester_number').eq('id',student.enrollment.semester_id).maybeSingle() : Promise.resolve({data:null,error:null}),
      student.enrollment?.academic_year_id ? supabase.from('academic_years').select('id,label,start_date,end_date,is_current').eq('id',student.enrollment.academic_year_id).maybeSingle() : Promise.resolve({data:null,error:null})
    ]);
    const failed=[branch,batch,semester,year].find(x=>x.error); if(failed) throw failed.error;
    let regulation=null;
    if(batch.data?.regulation_id){
      const r=await supabase.from('regulations').select('id,code,name').eq('id',batch.data.regulation_id).maybeSingle();
      if(r.error) throw r.error; regulation=r.data;
    }
    res.json({student,enrollment:student.enrollment,branch:branch.data,batch:batch.data,semester:semester.data,academicYear:year.data,regulation});
  } catch(e){ console.error(e); res.status(500).json({message:'Unable to load student profile.'});}
});

router.get('/courses', async (req,res)=>{
  try {
    const student=await currentStudent(req);
    if(!student?.enrollment) return res.json({courses:[], enrollment:null});
    const e=student.enrollment;

    // Build the student's courses directly from course_offerings.
    // IMPORTANT: a video belongs to an offering, not merely to the generic course.
    // Using the exact offering here prevents a video uploaded to Course A from
    // appearing under Course B just because both offerings share the same course_id.
    const [offeringsR, branchLinksR, coursesR] = await Promise.all([
      supabase.from('course_offerings')
        .select('id,course_id,academic_year_id,semester_id,batch_id,folder_id,is_published')
        .eq('academic_year_id',e.academic_year_id)
        .eq('semester_id',e.semester_id)
        .eq('batch_id',student.batch_id)
        .eq('is_published',true)
        .order('id',{ascending:true}),
      supabase.from('course_offering_branches').select('offering_id,branch_id'),
      supabase.from('courses').select('course_id,course_name,course_code')
    ]);
    if(offeringsR.error) throw offeringsR.error;
    if(branchLinksR.error) throw branchLinksR.error;
    if(coursesR.error) throw coursesR.error;

    const courseMap=new Map((coursesR.data||[]).map(c=>[Number(c.course_id),c]));
    const allowedOfferingIds=new Set(
      (branchLinksR.data||[])
        .filter(x=>Number(x.branch_id)===Number(student.branch_id))
        .map(x=>Number(x.offering_id))
    );

    const unique=(offeringsR.data||[])
      .filter(o=>allowedOfferingIds.has(Number(o.id)))
      .map(o=>({
        ...o,
        offering_id:o.id,
        course_id:o.course_id,
        ...(courseMap.get(Number(o.course_id))||{})
      }));

    // Add student-visible video totals/status counts to each exact offering.
    // A video is counted only when videos.offering_id equals this offering id.
    const offeringIds=unique.map(c=>Number(c.id));
    const today=new Date().toISOString().slice(0,10);
    let videoRows=[];
    if(offeringIds.length){
      const vr=await supabase.from('videos')
        .select('video_id,offering_id,start_date,end_date')
        .in('offering_id',offeringIds);
      if(vr.error) throw vr.error;
      videoRows=(vr.data||[]).filter(v=>
        (!v.start_date||today>=String(v.start_date).slice(0,10)) &&
        (!v.end_date||today<=String(v.end_date).slice(0,10))
      );
    }

    const videoIds=videoRows.map(v=>v.video_id);
    let progressRows=[];
    if(videoIds.length){
      const pr=await supabase.from('student_video_progress')
        .select('video_id,max_watched_seconds,questions_solved,total_questions,correct_answers,completed')
        .eq('student_id',student.id).in('video_id',videoIds);
      if(pr.error) throw pr.error;
      progressRows=pr.data||[];
    }
    const progressByVideo=new Map(progressRows.map(p=>[Number(p.video_id),p]));
    const statsByOffering=new Map();
    for(const v of videoRows){
      const key=Number(v.offering_id);
      const stats=statsByOffering.get(key)||{video_count:0,completed_count:0,in_progress_count:0,not_started_count:0};
      stats.video_count+=1;
      const p=progressByVideo.get(Number(v.video_id));
      if(p?.completed) stats.completed_count+=1;
      else if(p && (Number(p.max_watched_seconds||0)>0 || Number(p.questions_solved||0)>0)) stats.in_progress_count+=1;
      else stats.not_started_count+=1;
      statsByOffering.set(key,stats);
    }

    const courses=unique.map(c=>({
      ...c,
      ...(statsByOffering.get(Number(c.id))||{video_count:0,completed_count:0,in_progress_count:0,not_started_count:0})
    }));
    res.json({courses,enrollment:e});
  } catch(e){ console.error(e); res.status(500).json({message:e.message||'Unable to load courses.'});}
});

async function hasCourseAccess(student, offeringId) {
  if(!student?.enrollment) return false;
  const id=Number(offeringId);
  if(!Number.isFinite(id)) return false;

  // Access is checked against the exact course offering + current enrollment.
  // The branch link is also required, so one offering cannot expose another
  // offering's videos to a student merely because they share course_id.
  const offering=await supabase.from('course_offerings')
    .select('id,academic_year_id,semester_id,batch_id,is_published')
    .eq('id',id)
    .eq('academic_year_id',student.enrollment.academic_year_id)
    .eq('semester_id',student.enrollment.semester_id)
    .eq('batch_id',student.batch_id)
    .eq('is_published',true)
    .maybeSingle();
  if(offering.error) throw offering.error;
  if(!offering.data) return false;

  const branch=await supabase.from('course_offering_branches')
    .select('offering_id')
    .eq('offering_id',id)
    .eq('branch_id',student.branch_id)
    .maybeSingle();
  if(branch.error) throw branch.error;
  return !!branch.data;
}

router.get('/courses/:offeringId/videos', async(req,res)=>{
  try{
    const student=await currentStudent(req);
    if(!student) return res.status(404).json({message:'Student not found.'});
    const offeringId=Number(req.params.offeringId);
    if(!await hasCourseAccess(student,offeringId)) return res.status(403).json({message:'You do not have access to this course.'});
    const r=await supabase.from('videos').select('video_id,video_title,youtube_url,description,block_forward_seek,pause_at_questions,display_order,start_date,end_date,playback_speed,offering_id,created_at')
      .eq('offering_id',offeringId).order('display_order',{ascending:true});
    if(r.error) throw r.error;
    const today=new Date().toISOString().slice(0,10);
    const videos=(r.data||[]).filter(v=>(!v.start_date||today>=String(v.start_date).slice(0,10))&&(!v.end_date||today<=String(v.end_date).slice(0,10)));
    const ids=videos.map(v=>v.video_id);
    let progress=[];
    if(ids.length){
      const p=await supabase.from('student_video_progress').select('video_id,max_watched_seconds,questions_solved,total_questions,correct_answers,completed')
        .eq('student_id',student.id).in('video_id',ids);
      if(p.error) throw p.error; progress=p.data||[];
    }
    res.json({videos,progress});
  }catch(e){console.error(e);res.status(500).json({message:e.message||'Unable to load videos.'});}
});

router.get('/videos/:videoId',async(req,res)=>{
  try{
    const student=await currentStudent(req); const videoId=Number(req.params.videoId);
    if(!student) return res.status(404).json({message:'Student not found.'});
    const v=await supabase.from('videos').select('video_id,video_title,youtube_url,description,block_forward_seek,pause_at_questions,display_order,start_date,end_date,playback_speed,offering_id,created_at').eq('video_id',videoId).maybeSingle();
    if(v.error) throw v.error; if(!v.data) return res.status(404).json({message:'Video not found.'});
    if(!await hasCourseAccess(student,v.data.offering_id)) return res.status(403).json({message:'You do not have access to this video.'});
    const [q,s,p,a]=await Promise.all([
      supabase.from('video_questions').select('question_id,video_id,timestamp_seconds,question_text,explanation,question_options(option_id,option_text,option_order,is_correct)').eq('video_id',videoId).order('timestamp_seconds',{ascending:true}),
      supabase.from('video_skips').select('skip_id,start_time_seconds,end_time_seconds').eq('video_id',videoId).order('start_time_seconds',{ascending:true}),
      supabase.from('student_video_progress').select('student_id,video_id,max_watched_seconds,questions_solved,total_questions,correct_answers,completed').eq('student_id',student.id).eq('video_id',videoId).maybeSingle(),
      supabase.from('student_question_attempts').select('question_id,selected_option_id,is_correct,attempted_at').eq('student_id',student.id).eq('video_id',videoId)
    ]);
    const failed=[q,s,p,a].find(x=>x.error); if(failed) throw failed.error;
    res.json({video:v.data,questions:q.data||[],skips:s.data||[],progress:p.data||null,attempts:a.data||[]});
  }catch(e){console.error(e);res.status(500).json({message:e.message||'Unable to load video.'});}
});

router.get('/videos/:videoId/progress',async(req,res)=>{
  try{
    const student=await currentStudent(req); const videoId=Number(req.params.videoId);
    const r=await supabase.from('student_video_progress').select('*').eq('student_id',student.id).eq('video_id',videoId).maybeSingle();
    if(r.error) throw r.error; res.json({progress:r.data||null});
  }catch(e){res.status(500).json({message:'Unable to load progress.'});}
});

router.put('/videos/:videoId/progress',async(req,res)=>{
  try{
    const student=await currentStudent(req); const videoId=Number(req.params.videoId);
    const v=await supabase.from('videos').select('video_id,offering_id').eq('video_id',videoId).maybeSingle();
    if(v.error) throw v.error; if(!v.data||!await hasCourseAccess(student,v.data.offering_id)) return res.status(403).json({message:'Access denied.'});
    const payload=req.body||{};
    const total=Math.max(0,Number(payload.total_questions||0));
    const solved=Math.max(0,Math.min(total,Number(payload.questions_solved||0)));
    const correct=Math.max(0,Math.min(solved,Number(payload.correct_answers||0)));
    const row={student_id:student.id,video_id:videoId,max_watched_seconds:Math.max(0,Math.floor(Number(payload.max_watched_seconds||0))),questions_solved:solved,total_questions:total,correct_answers:correct,completed:!!payload.completed,updated_at:new Date().toISOString()};
    const r=await supabase.from('student_video_progress').upsert(row,{onConflict:'student_id,video_id'}).select().single();
    if(r.error) throw r.error; res.json({progress:r.data});
  }catch(e){console.error(e);res.status(500).json({message:e.message||'Unable to save progress.'});}
});

router.post('/videos/:videoId/attempts',async(req,res)=>{
  try{
    const student=await currentStudent(req); const videoId=Number(req.params.videoId);
    const {question_id,selected_option_id,is_correct}=req.body||{};
    if(!question_id||!selected_option_id) return res.status(400).json({message:'Question and option are required.'});
    const v=await supabase.from('videos').select('offering_id').eq('video_id',videoId).maybeSingle();
    if(v.error) throw v.error; if(!v.data||!await hasCourseAccess(student,v.data.offering_id)) return res.status(403).json({message:'Access denied.'});
    const r=await supabase.from('student_question_attempts').upsert({student_id:student.id,question_id:Number(question_id),video_id:videoId,selected_option_id:Number(selected_option_id),is_correct:!!is_correct,attempted_at:new Date().toISOString()},{onConflict:'student_id,question_id'}).select().single();
    if(r.error) throw r.error; res.json({attempt:r.data});
  }catch(e){console.error(e);res.status(500).json({message:e.message||'Unable to save answer.'});}
});
export default router;
