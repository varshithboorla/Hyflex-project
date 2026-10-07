import { Router } from 'express';
import { supabase } from '../supabase.js';

const router = Router();

router.use((req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(401).json({ message: 'Admin authentication required.' });
  next();
});

const pct = (value) => Math.round((Number(value) || 0) * 10) / 10;
const statusOf = (p) => p?.completed ? 'completed' : ((Number(p?.max_watched_seconds) || 0) > 0 || (Number(p?.questions_solved) || 0) > 0) ? 'in_progress' : 'not_started';

router.get('/dashboard', async (_req, res) => {
  try {
    const [yearsR, semestersR, enrollmentsR, studentsR, offeringsR, videosR, assignmentsR, progressR, branchesR, batchesR, promotionsR] = await Promise.all([
      supabase.from('academic_years').select('id,label,is_current,start_date,end_date').order('start_date', { ascending: false }),
      supabase.from('semesters').select('id,name,semester_number').order('semester_number'),
      supabase.from('student_enrollments').select('id,student_id,academic_year_id,semester_id,is_current,status'),
      supabase.from('students').select('id,roll_number,first_name,last_name,email,branch_id,batch_id,semester_id,status'),
      supabase.from('course_offerings').select('id,course_id,academic_year_id,semester_id,batch_id'),
      supabase.from('videos').select('video_id,offering_id,video_title,display_order,duration_seconds,created_at,updated_at').order('display_order'),
      supabase.from('v_student_courses').select('student_id,offering_id,course_id,course_name,course_code,batch_id,academic_year_id,semester_id'),
      supabase.from('student_video_progress').select('student_id,video_id,max_watched_seconds,questions_solved,total_questions,correct_answers,completed,created_at,updated_at'),
      supabase.from('branches').select('id,name,code').order('name'),
      supabase.from('batches').select('id,label'),
      supabase.from('student_promotions').select('id,student_id,from_semester_id,to_semester_id,academic_year_id,movement_type,created_at').order('created_at', { ascending: false }).limit(10)
    ]);

    const results = [yearsR, semestersR, enrollmentsR, studentsR, offeringsR, videosR, assignmentsR, progressR, branchesR, batchesR, promotionsR];
    const failed = results.find((r) => r.error);
    if (failed) throw failed.error;

    const years = yearsR.data || [];
    const semesters = semestersR.data || [];
    const enrollments = enrollmentsR.data || [];
    const students = studentsR.data || [];
    const offerings = offeringsR.data || [];
    const videos = videosR.data || [];
    const assignments = assignmentsR.data || [];
    const branches = branchesR.data || [];
    const batches = batchesR.data || [];

    const currentYear = years.find((y) => y.is_current) || years[0] || null;
    const currentEnrollments = enrollments.filter((e) => e.is_current && e.status !== 'inactive');
    const semesterCounts = new Map();
    currentEnrollments.forEach((e) => semesterCounts.set(String(e.semester_id), (semesterCounts.get(String(e.semester_id)) || 0) + 1));
    const currentSemesterId = [...semesterCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const currentSemester = semesters.find((s) => String(s.id) === String(currentSemesterId)) || null;
    const yearId = currentYear?.id ?? null;
    const semesterId = currentSemester?.id ?? null;

    const currentStudentIds = new Set(currentEnrollments
      .filter((e) => String(e.academic_year_id) === String(yearId) && String(e.semester_id) === String(semesterId))
      .map((e) => String(e.student_id)));
    const currentStudents = students.filter((s) => currentStudentIds.has(String(s.id)));

    const currentOfferings = offerings.filter((o) => String(o.academic_year_id) === String(yearId) && String(o.semester_id) === String(semesterId));
    const currentOfferingIds = new Set(currentOfferings.map((o) => String(o.id)));
    const currentVideos = videos.filter((v) => currentOfferingIds.has(String(v.offering_id)));
    const currentVideoIds = new Set(currentVideos.map((v) => String(v.video_id)));
    const currentAssignments = assignments.filter((a) => currentStudentIds.has(String(a.student_id)) && currentOfferingIds.has(String(a.offering_id)));

    const latestProgress = new Map();
    for (const p of progressR.data || []) {
      const key = `${p.student_id}:${p.video_id}`;
      const old = latestProgress.get(key);
      if (!old || new Date(p.updated_at || p.created_at || 0) > new Date(old.updated_at || old.created_at || 0)) latestProgress.set(key, p);
    }

    // v_student_courses is the authoritative student-to-offering assignment source. A video belongs to an offering.
    const pairsByOffering = new Map();
    for (const a of currentAssignments) {
      const key = String(a.offering_id);
      if (!pairsByOffering.has(key)) pairsByOffering.set(key, new Set());
      pairsByOffering.get(key).add(String(a.student_id));
    }

    let completed = 0, inProgress = 0, notStarted = 0;
    const studentStats = new Map(currentStudents.map((s) => [String(s.id), { student: s, total: 0, completed: 0, inProgress: 0, notStarted: 0, scoreTotal: 0, scoreCount: 0, lastActivity: null }]));

    for (const video of currentVideos) {
      const studentIds = pairsByOffering.get(String(video.offering_id)) || new Set();
      for (const studentId of studentIds) {
        const row = studentStats.get(String(studentId));
        if (!row) continue;
        const p = latestProgress.get(`${studentId}:${video.video_id}`);
        const status = statusOf(p);
        row.total += 1;
        if (status === 'completed') { completed += 1; row.completed += 1; }
        else if (status === 'in_progress') { inProgress += 1; row.inProgress += 1; }
        else { notStarted += 1; row.notStarted += 1; }
        if (p?.completed && Number(p.total_questions) > 0) {
          row.scoreTotal += Math.min(100, (Number(p.correct_answers || 0) / Number(p.total_questions)) * 100);
          row.scoreCount += 1;
        }
        if (p?.updated_at && (!row.lastActivity || new Date(p.updated_at) > new Date(row.lastActivity))) row.lastActivity = p.updated_at;
      }
    }

    const studentStatRows = [...studentStats.values()].map((r) => ({
      ...r,
      completion: r.total ? pct((r.completed / r.total) * 100) : 0,
      score: r.scoreCount ? pct(r.scoreTotal / r.scoreCount) : 0
    }));

    const branchMap = new Map(branches.map((b) => [String(b.id), b]));
    const branchStats = new Map();
    for (const row of studentStatRows) {
      const key = String(row.student.branch_id);
      if (!branchStats.has(key)) branchStats.set(key, { branch: branchMap.get(key) || { id: key, name: 'Unknown', code: '' }, students: 0, completed: 0, total: 0 });
      const b = branchStats.get(key);
      b.students += 1;
      b.completed += row.completed;
      b.total += row.total;
    }
    const branchPerformance = [...branchStats.values()].map((b) => ({
      ...b,
      percentage: b.total ? pct((b.completed / b.total) * 100) : 0
    })).sort((a, b) => b.percentage - a.percentage);

    // Semester performance uses the students' current enrollment for the current academic year.
    // If historical semester enrollments are available, they are also represented by their enrollment counts.
    const semesterPerformance = semesters.map((semester) => {
      const semesterStudentIds = new Set(enrollments.filter((e) => e.is_current && String(e.academic_year_id) === String(yearId) && String(e.semester_id) === String(semester.id)).map((e) => String(e.student_id)));
      const rows = studentStatRows.filter((r) => semesterStudentIds.has(String(r.student.id)));
      const total = rows.reduce((n, r) => n + r.total, 0);
      const done = rows.reduce((n, r) => n + r.completed, 0);
      const scores = rows.filter((r) => r.scoreCount > 0);
      return {
        semester_number: semester.semester_number,
        name: semester.name,
        students: rows.length,
        completion: total ? pct((done / total) * 100) : 0,
        score: scores.length ? pct(scores.reduce((n, r) => n + r.score, 0) / scores.length) : 0
      };
    }).filter((s) => s.students > 0 || s.semester_number <= Number(currentSemester?.semester_number || 0));

    const attention = [...studentStatRows]
      .filter((r) => (r.total > 0 && r.completion < 50) || r.notStarted >= 5)
      .sort((a, b) => a.completion - b.completion)
      .slice(0, 8)
      .map((r) => ({ roll_number: r.student.roll_number, name: [r.student.first_name, r.student.last_name].filter(Boolean).join(' '), completion: r.completion, not_started: r.notStarted }));

    const topPerformers = [...studentStatRows].filter((r) => r.total > 0).sort((a, b) => b.completion - a.completion).slice(0, 5).map((r) => ({ roll_number: r.student.roll_number, name: [r.student.first_name, r.student.last_name].filter(Boolean).join(' '), percentage: r.completion }));
    const needsImprovement = [...studentStatRows].filter((r) => r.total > 0).sort((a, b) => a.completion - b.completion).slice(0, 5).map((r) => ({ roll_number: r.student.roll_number, name: [r.student.first_name, r.student.last_name].filter(Boolean).join(' '), percentage: r.completion }));

    const studentMap = new Map(students.map((s) => [String(s.id), s]));
    const recent = [];
    for (const p of progressR.data || []) {
      if (!currentStudentIds.has(String(p.student_id)) || !currentVideoIds.has(String(p.video_id)) || !p.updated_at) continue;
      recent.push({ type: p.completed ? 'completed' : 'started', student: studentMap.get(String(p.student_id))?.roll_number || 'Student', video: currentVideos.find((v) => String(v.video_id) === String(p.video_id))?.video_title || 'Video', at: p.updated_at });
    }
    const semesterMap = new Map(semesters.map((s) => [String(s.id), s.name]));
    for (const p of promotionsR.data || []) {
      const student = studentMap.get(String(p.student_id));
      recent.push({ type: 'moved', student: student?.roll_number || 'Student', video: `${semesterMap.get(String(p.from_semester_id)) || 'Semester'} → ${semesterMap.get(String(p.to_semester_id)) || 'Semester'}`, at: p.created_at });
    }
    recent.sort((a, b) => new Date(b.at) - new Date(a.at));

    const overallTotal = completed + inProgress + notStarted;
    res.json({
      current: {
        academic_year: currentYear ? { id: currentYear.id, label: currentYear.label } : null,
        semester: currentSemester ? { id: currentSemester.id, name: currentSemester.name, semester_number: currentSemester.semester_number } : null
      },
      totals: {
        students: currentStudents.length,
        courses: new Set(currentOfferings.map((o) => String(o.course_id))).size,
        videos: currentVideos.length,
        completed,
        in_progress: inProgress,
        not_started: notStarted,
        completion: overallTotal ? pct((completed / overallTotal) * 100) : 0
      },
      learning_overview: {
        completed: overallTotal ? pct((completed / overallTotal) * 100) : 0,
        in_progress: overallTotal ? pct((inProgress / overallTotal) * 100) : 0,
        not_started: overallTotal ? pct((notStarted / overallTotal) * 100) : 0
      },
      branch_performance: branchPerformance,
      semester_performance: semesterPerformance,
      attention,
      recent_activity: recent.slice(0, 10),
      top_performers: topPerformers,
      needs_improvement: needsImprovement
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Unable to load dashboard data.' });
  }
});

export default router;
