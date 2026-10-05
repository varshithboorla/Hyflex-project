import { Router } from 'express';
import { supabase } from '../supabase.js';

const router = Router();
router.use((req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(401).json({ message: 'Admin authentication required.' });
  next();
});

const fail = (res, error, message) => {
  console.error(message, error);
  return res.status(500).json({ message: error?.message || message });
};

router.get('/progress', async (_req, res) => {
  try {
    const [progressR, studentsR, videosR, offeringsR, coursesR, assignmentsR, branchesR, batchesR, yearsR, semestersR] = await Promise.all([
      supabase.from('student_video_progress').select('id,student_id,video_id,max_watched_seconds,questions_solved,total_questions,correct_answers,completed,created_at,updated_at'),
      supabase.from('students').select('id,roll_number,email,first_name,last_name,branch_id,batch_id,semester_id,status'),
      supabase.from('videos').select('video_id,offering_id,video_title,youtube_url,display_order,created_at,updated_at').order('display_order', { ascending: true }),
      supabase.from('course_offerings').select('id,course_id,academic_year_id,semester_id,batch_id'),
      supabase.from('courses').select('course_id,course_name,course_code'),
      supabase.from('v_student_courses').select('student_id,offering_id,course_id,course_name,course_code,batch_id,academic_year_id,semester_id'),
      supabase.from('branches').select('id,name,code'),
      supabase.from('batches').select('id,label,admission_year,graduation_year'),
      supabase.from('academic_years').select('id,label,is_current,start_date,end_date'),
      supabase.from('semesters').select('id,name,semester_number')
    ]);

    const firstError = [progressR, studentsR, videosR, offeringsR, coursesR, assignmentsR, branchesR, batchesR, yearsR, semestersR].find(r => r.error);
    if (firstError) throw firstError.error;

    // Keep the newest row if a legacy duplicate exists for a student/video pair.
    const latest = new Map();
    for (const row of progressR.data || []) {
      const key = `${row.student_id}:${row.video_id}`;
      const old = latest.get(key);
      if (!old || new Date(row.updated_at || row.created_at || 0) > new Date(old.updated_at || old.created_at || 0)) latest.set(key, row);
    }

    const assignments = assignmentsR.data || [];
    const assignmentKeys = new Set(assignments.map(a => `${a.student_id}:${a.offering_id}`));
    const currentVideos = (videosR.data || []).filter(v => [...assignmentKeys].some(k => k.endsWith(`:${v.offering_id}`)));

    const offeringMap = new Map((offeringsR.data || []).map(o => [String(o.id), o]));
    const courseMap = new Map((coursesR.data || []).map(c => [String(c.course_id), c]));
    const studentMap = new Map((studentsR.data || []).map(s => [String(s.id), s]));
    const branchMap = new Map((branchesR.data || []).map(b => [String(b.id), b]));
    const batchMap = new Map((batchesR.data || []).map(b => [String(b.id), b]));
    const yearMap = new Map((yearsR.data || []).map(y => [String(y.id), y]));
    const semesterMap = new Map((semestersR.data || []).map(s => [String(s.id), s]));

    const progress = [...latest.values()]
      .filter(p => {
        const video = (videosR.data || []).find(v => Number(v.video_id) === Number(p.video_id));
        return video && assignmentKeys.has(`${p.student_id}:${video.offering_id}`);
      })
      .map(p => ({ ...p, video: (videosR.data || []).find(v => Number(v.video_id) === Number(p.video_id)) || null }));

    const videos = currentVideos.map(video => {
      const offering = offeringMap.get(String(video.offering_id));
      const course = offering ? courseMap.get(String(offering.course_id)) : null;
      const students = [...new Map(assignments.filter(a => String(a.offering_id) === String(video.offering_id)).map(a => [String(a.student_id), a])).values()];
      const pMap = new Map(progress.map(p => [`${p.student_id}:${p.video_id}`, p]));
      let completed = 0, inProgress = 0, notStarted = 0;
      for (const a of students) {
        const p = pMap.get(`${a.student_id}:${video.video_id}`);
        if (p?.completed) completed++;
        else if ((Number(p?.max_watched_seconds) || 0) > 0 || (Number(p?.questions_solved) || 0) > 0) inProgress++;
        else notStarted++;
      }
      return { ...video, offering, course, student_count: students.length, completed, in_progress: inProgress, not_started: notStarted };
    });

    const enrichedAssignments = assignments.map(a => {
      const student = studentMap.get(String(a.student_id));
      return {
        ...a,
        student: student || null,
        branch: student ? branchMap.get(String(student.branch_id)) || null : null,
        batch: batchMap.get(String(a.batch_id ?? student?.batch_id)) || null,
        academic_year: yearMap.get(String(a.academic_year_id)) || null,
        semester: semesterMap.get(String(a.semester_id)) || null
      };
    });

    res.json({
      progress,
      videos,
      assignments: enrichedAssignments,
      students: studentsR.data || [],
      courses: coursesR.data || [],
      branches: branchesR.data || [],
      batches: batchesR.data || [],
      academic_years: yearsR.data || [],
      semesters: semestersR.data || []
    });
  } catch (error) {
    fail(res, error, 'Failed to load video progress.');
  }
});



router.get('/progress/history', async (_req, res) => {
  try {
    const pageSize = 1000;
    const all = [];
    let from = 0;
    while (true) {
      const result = await supabase.from('student_progress_history')
        .select('id,student_id,enrollment_id,academic_year_id,semester_id,record_type,video_id,course_id,course_name,course_code,offering_id,video_title,display_order,max_watched_seconds,questions_solved,total_questions,correct_answers,completed,snapshot_at,branch_name,batch_label')
        .eq('record_type','video').order('id',{ascending:false}).range(from,from+pageSize-1);
      if (result.error) throw result.error;
      all.push(...(result.data||[]));
      if (!result.data || result.data.length < pageSize) break;
      from += pageSize;
    }

    const qRows=[];
    from=0;
    while (true) {
      const result=await supabase.from('student_progress_history').select('student_id,enrollment_id,video_id,is_correct').eq('record_type','question').range(from,from+pageSize-1);
      if(result.error) throw result.error;
      qRows.push(...(result.data||[]));
      if(!result.data || result.data.length<pageSize) break;
      from+=pageSize;
    }
    const qMap=new Map();
    for(const q of qRows){const key=`${q.student_id}:${q.enrollment_id}:${q.video_id}`;const x=qMap.get(key)||{question_attempts:0,question_correct:0};x.question_attempts++;if(q.is_correct)x.question_correct++;qMap.set(key,x)}

    const [studentsR,yearsR,semestersR]=await Promise.all([
      supabase.from('students').select('id,roll_number,first_name,last_name,email'),
      supabase.from('academic_years').select('id,label'),
      supabase.from('semesters').select('id,name,semester_number')
    ]);
    if(studentsR.error) throw studentsR.error; if(yearsR.error) throw yearsR.error; if(semestersR.error) throw semestersR.error;
    const sm=new Map((studentsR.data||[]).map(x=>[String(x.id),x])), ym=new Map((yearsR.data||[]).map(x=>[String(x.id),x])), semm=new Map((semestersR.data||[]).map(x=>[String(x.id),x]));
    const rows=all.map(r=>{const s=sm.get(String(r.student_id));const y=ym.get(String(r.academic_year_id));const sem=semm.get(String(r.semester_id));const q=qMap.get(`${r.student_id}:${r.enrollment_id}:${r.video_id}`)||{};return {...r,roll_number:s?.roll_number,first_name:s?.first_name,last_name:s?.last_name,email:s?.email,academic_year:y?.label,semester:sem?.name,semester_number:sem?.semester_number,question_attempts:q.question_attempts||0,question_correct:q.question_correct||0}});
    res.json({rows});
  } catch(error) { fail(res,error,'Failed to load permanent progress history.'); }
});

export default router;
