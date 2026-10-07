import { Router } from 'express';
import { supabase } from '../supabase.js';

const router = Router();

async function getOptions() {
  const [years, semesters, branches, batches] = await Promise.all([
    supabase.from('academic_years').select('id,label,is_current').order('start_date', { ascending: false }),
    supabase.from('semesters').select('id,semester_number,name').order('semester_number'),
    supabase.from('branches').select('id,name,code').order('name'),
    supabase.from('batches').select('id,label').order('label')
  ]);
  const failed = [years, semesters, branches, batches].find((r) => r.error && !String(r.error.message || '').toLowerCase().includes('batches'));
  if (failed) throw failed.error;
  return {
    academicYears: years.data || [],
    semesters: semesters.data || [],
    branches: branches.data || [],
    batches: batches.error ? [] : (batches.data || [])
  };
}

async function currentEnrollments(ids = null) {
  let q = supabase.from('student_enrollments').select('id,student_id,academic_year_id,semester_id,is_current,status').eq('is_current', true);
  if (ids?.length) q = q.in('student_id', ids);
  const result = await q;
  if (result.error) throw result.error;
  return result.data || [];
}

router.get('/students', async (req, res) => {
  try {
    const { search = '', academic_year_id, semester_id, branch_id, batch_id } = req.query;
    let query = supabase.from('students').select('id,roll_number,email,first_name,last_name,branch_id,batch_id,created_at,status').order('created_at', { ascending: false });
    if (branch_id) query = query.eq('branch_id', branch_id);
    if (batch_id) query = query.eq('batch_id', batch_id);
    if (search.trim()) {
      const value = search.trim().replace(/[%(),]/g, ' ');
      query = query.or(`roll_number.ilike.%${value}%,first_name.ilike.%${value}%,last_name.ilike.%${value}%,email.ilike.%${value}%`);
    }
    const [{ data: students, error }, enrollments, options] = await Promise.all([query, currentEnrollments(), getOptions()]);
    if (error) throw error;

    const enrollmentIds = new Set((students || []).map((s) => s.id));
    const current = enrollments.filter((e) => enrollmentIds.has(e.student_id));
    const yearMap = new Map(options.academicYears.map((x) => [x.id, x.label]));
    const semesterMap = new Map(options.semesters.map((x) => [x.id, x.name]));
    const branchMap = new Map(options.branches.map((x) => [x.id, x.name]));
    const batchMap = new Map(options.batches.map((x) => [x.id, x.label]));
    const currentMap = new Map(current.map((e) => [e.student_id, e]));

    let rows = (students || []).map((s) => {
      const e = currentMap.get(s.id);
      return { ...s, academic_year_id: e?.academic_year_id || null, semester_id: e?.semester_id || null, enrollment_status: e?.status || null, academic_year_label: yearMap.get(e?.academic_year_id) || null, semester_name: semesterMap.get(e?.semester_id) || null, branch_label: branchMap.get(s.branch_id) || null, batch_label: batchMap.get(s.batch_id) || null };
    });
    if (academic_year_id) rows = rows.filter((s) => String(s.academic_year_id) === String(academic_year_id));
    if (semester_id) rows = rows.filter((s) => String(s.semester_id) === String(semester_id));

    res.json({ students: rows, options });
  } catch (error) {
    console.error('Students list error:', error);
    res.status(500).json({ message: 'Unable to load students.' });
  }
});

router.post('/students', async (req, res) => {
  const { roll_number, email, password, first_name, last_name = '', branch_id, academic_year_id, semester_id, batch_id } = req.body || {};
  if (!roll_number || !email || !password || !first_name || !branch_id || !academic_year_id || !semester_id || !batch_id) return res.status(400).json({ message: 'Roll number, email, password, name, branch, batch, academic year and semester are required.' });
  try {
    const existing = await supabase.from('students').select('id').or(`roll_number.eq.${roll_number},email.eq.${email}`).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return res.status(409).json({ message: 'A student with this roll number or email already exists.' });

    const studentPayload = { roll_number, email, password_hash: password, first_name, last_name, branch_id: Number(branch_id), batch_id: Number(batch_id), semester_id: Number(semester_id) };
    const created = await supabase.from('students').insert(studentPayload).select('id,roll_number,email,first_name,last_name,branch_id,batch_id,status').single();
    if (created.error) throw created.error;

    const enrollment = await supabase.from('student_enrollments').insert({ student_id: created.data.id, academic_year_id: Number(academic_year_id), semester_id: Number(semester_id), is_current: true, status: 'active' }).select().single();
    if (enrollment.error) {
      await supabase.from('students').delete().eq('id', created.data.id);
      throw enrollment.error;
    }
    res.status(201).json({ student: created.data, enrollment: enrollment.data });
  } catch (error) {
    console.error('Create student error:', error);
    res.status(500).json({ message: error.message || 'Unable to add student.' });
  }
});

router.patch('/students/:id', async (req, res) => {
  const studentId = Number(req.params.id);
  const { roll_number, email, password, first_name, last_name = '', branch_id, academic_year_id, semester_id, batch_id } = req.body || {};

  if (!Number.isInteger(studentId) || !roll_number || !email || !first_name || !branch_id || !academic_year_id || !semester_id || !batch_id) {
    return res.status(400).json({ message: 'Roll number, email, name, branch, batch, academic year and semester are required.' });
  }

  try {
    const existingRoll = await supabase.from('students').select('id').eq('roll_number', roll_number).neq('id', studentId).maybeSingle();
    if (existingRoll.error) throw existingRoll.error;
    if (existingRoll.data) return res.status(409).json({ message: 'Another student already uses this roll number.' });

    const existingEmail = await supabase.from('students').select('id').eq('email', email).neq('id', studentId).maybeSingle();
    if (existingEmail.error) throw existingEmail.error;
    if (existingEmail.data) return res.status(409).json({ message: 'Another student already uses this email.' });

    const studentPayload = {
      roll_number,
      email,
      first_name,
      last_name,
      branch_id: Number(branch_id),
      batch_id: Number(batch_id),
      semester_id: Number(semester_id),
      updated_at: new Date().toISOString()
    };
    if (password) studentPayload.password_hash = password;

    const updated = await supabase.from('students').update(studentPayload).eq('id', studentId)
      .select('id,roll_number,email,first_name,last_name,branch_id,batch_id,semester_id,status').single();
    if (updated.error) throw updated.error;

    const currentResult = await supabase.from('student_enrollments')
      .select('id,academic_year_id,semester_id,is_current,status')
      .eq('student_id', studentId).eq('is_current', true).limit(1).maybeSingle();
    if (currentResult.error) throw currentResult.error;

    const targetYear = Number(academic_year_id);
    const targetSemester = Number(semester_id);
    const current = currentResult.data;

    if (!current) {
      const created = await supabase.from('student_enrollments').insert({
        student_id: studentId, academic_year_id: targetYear, semester_id: targetSemester, is_current: true, status: 'active'
      }).select().single();
      if (created.error) throw created.error;
    } else if (Number(current.academic_year_id) !== targetYear || Number(current.semester_id) !== targetSemester) {
      const targetResult = await supabase.from('student_enrollments')
        .select('id').eq('student_id', studentId).eq('academic_year_id', targetYear).eq('semester_id', targetSemester)
        .limit(1).maybeSingle();
      if (targetResult.error) throw targetResult.error;

      const closed = await supabase.from('student_enrollments').update({ is_current: false, updated_at: new Date().toISOString() }).eq('id', current.id);
      if (closed.error) throw closed.error;

      if (targetResult.data) {
        const reopened = await supabase.from('student_enrollments').update({ is_current: true, status: 'active', updated_at: new Date().toISOString() }).eq('id', targetResult.data.id);
        if (reopened.error) throw reopened.error;
      } else {
        const created = await supabase.from('student_enrollments').insert({
          student_id: studentId, academic_year_id: targetYear, semester_id: targetSemester, is_current: true, status: 'active'
        });
        if (created.error) throw created.error;
      }
    }

    res.json({ message: 'Student updated successfully.', student: updated.data });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ message: error.message || 'Unable to update student.' });
  }
});

router.delete('/students', async (req, res) => {
  const { student_ids } = req.body || {};
  if (!Array.isArray(student_ids) || student_ids.length === 0) {
    return res.status(400).json({ message: 'Select at least one student to delete.' });
  }

  try {
    const ids = [...new Set(student_ids.map(Number).filter(Number.isInteger))];
    if (!ids.length) return res.status(400).json({ message: 'No valid students selected.' });

    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id,roll_number')
      .in('id', ids);
    if (studentsError) throw studentsError;
    if ((students || []).length !== ids.length) {
      return res.status(404).json({ message: 'One or more selected students were not found.' });
    }

    // Remove dependent student data first because these tables reference students.id.
    const dependentDeletes = [
      ['student_progress_history', 'student_id'],
      ['student_question_attempts', 'student_id'],
      ['student_video_progress', 'student_id'],
      ['student_promotions', 'student_id'],
      ['student_enrollments', 'student_id']
    ];

    for (const [table, column] of dependentDeletes) {
      const result = await supabase.from(table).delete().in(column, ids);
      if (result.error) throw result.error;
    }

    const deleted = await supabase.from('students').delete().in('id', ids).select('id');
    if (deleted.error) throw deleted.error;

    res.json({
      message: `${ids.length} student${ids.length === 1 ? '' : 's'} deleted successfully.`,
      deleted: deleted.data?.length || ids.length
    });
  } catch (error) {
    console.error('Delete students error:', error);
    res.status(500).json({ message: error.message || 'Unable to delete student(s).' });
  }
});

router.post('/students/move', async (req, res) => {
  const { student_ids, academic_year_id, semester_id } = req.body || {};
  if (!Array.isArray(student_ids) || student_ids.length === 0 || !academic_year_id || !semester_id) {
    return res.status(400).json({ message: 'Select students, academic year and semester.' });
  }

  try {
    const ids = [...new Set(student_ids.map(Number).filter(Number.isInteger))];
    if (!ids.length) return res.status(400).json({ message: 'No valid students selected.' });

    const targetYear = Number(academic_year_id);
    const targetSemester = Number(semester_id);
    const adminId = req.session?.user?.role === 'admin' ? Number(req.session.user.id) : null;

    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id,semester_id,branch_id,batch_id')
      .in('id', ids);
    if (studentsError) throw studentsError;
    if ((students || []).length !== ids.length) return res.status(404).json({ message: 'One or more selected students were not found.' });

    // Cache metadata used by permanent progress history snapshots.
    const [branchesR, batchesR] = await Promise.all([
      supabase.from('branches').select('id,name'),
      supabase.from('batches').select('id,label')
    ]);
    if (branchesR.error) throw branchesR.error;
    if (batchesR.error) throw batchesR.error;
    const branchMap = new Map((branchesR.data || []).map(x => [Number(x.id), x]));
    const batchMap = new Map((batchesR.data || []).map(x => [Number(x.id), x]));

    // Snapshot the current semester BEFORE changing the enrollment.
    // The snapshot always keeps the OLD enrollment/year/semester so it remains
    // permanently tied to the semester the student is leaving.
    const archiveCurrentProgress = async (student, enrollment) => {
      if (!enrollment) return { videoCount: 0, questionCount: 0 };

      const [progressR, attemptsR] = await Promise.all([
        supabase.from('student_video_progress')
          .select('id,student_id,video_id,max_watched_seconds,questions_solved,total_questions,correct_answers,completed,created_at,updated_at')
          .eq('student_id', student.id),
        supabase.from('student_question_attempts')
          .select('id,student_id,question_id,video_id,selected_option_id,is_correct,attempted_at')
          .eq('student_id', student.id)
      ]);
      if (progressR.error) throw progressR.error;
      if (attemptsR.error) throw attemptsR.error;

      const progress = progressR.data || [];
      const attempts = attemptsR.data || [];
      if (!progress.length && !attempts.length) return { videoCount: 0, questionCount: 0 };

      const videoIds = [...new Set([
        ...progress.map(x => Number(x.video_id)).filter(Number.isInteger),
        ...attempts.map(x => Number(x.video_id)).filter(Number.isInteger)
      ])];

      let videos = [];
      let offerings = [];
      let courses = [];
      if (videoIds.length) {
        const videosR = await supabase.from('videos')
          .select('video_id,offering_id,video_title,display_order')
          .in('video_id', videoIds);
        if (videosR.error) throw videosR.error;
        videos = videosR.data || [];

        const offeringIds = [...new Set(videos.map(v => Number(v.offering_id)).filter(Number.isInteger))];
        if (offeringIds.length) {
          const offeringsR = await supabase.from('course_offerings')
            .select('id,course_id,academic_year_id,semester_id,batch_id')
            .in('id', offeringIds);
          if (offeringsR.error) throw offeringsR.error;
          offerings = offeringsR.data || [];

          const courseIds = [...new Set(offerings.map(o => Number(o.course_id)).filter(Number.isInteger))];
          if (courseIds.length) {
            const coursesR = await supabase.from('courses')
              .select('course_id,course_name,course_code')
              .in('course_id', courseIds);
            if (coursesR.error) throw coursesR.error;
            courses = coursesR.data || [];
          }
        }
      }

      const videoMap = new Map(videos.map(v => [Number(v.video_id), v]));
      const offeringMap = new Map(offerings.map(o => [Number(o.id), o]));
      const courseMap = new Map(courses.map(c => [Number(c.course_id), c]));
      const branch = branchMap.get(Number(student.branch_id));
      const batch = batchMap.get(Number(student.batch_id));

      const historyVideos = progress.map(p => {
        const video = videoMap.get(Number(p.video_id));
        const offering = video ? offeringMap.get(Number(video.offering_id)) : null;
        const course = offering ? courseMap.get(Number(offering.course_id)) : null;
        return {
          student_id: student.id,
          enrollment_id: enrollment.id,
          academic_year_id: Number(enrollment.academic_year_id),
          semester_id: Number(enrollment.semester_id),
          record_type: 'video',
          source_id: p.id,
          video_id: Number(p.video_id),
          course_id: course?.course_id ?? offering?.course_id ?? null,
          course_name: course?.course_name ?? null,
          course_code: course?.course_code ?? null,
          offering_id: video?.offering_id ?? null,
          video_title: video?.video_title ?? null,
          display_order: video?.display_order ?? null,
          branch_id: Number(student.branch_id),
          branch_name: branch?.name ?? null,
          batch_id: Number(student.batch_id),
          batch_label: batch?.label ?? null,
          max_watched_seconds: Number(p.max_watched_seconds) || 0,
          questions_solved: Number(p.questions_solved) || 0,
          total_questions: Number(p.total_questions) || 0,
          correct_answers: Number(p.correct_answers) || 0,
          completed: !!p.completed,
          snapshot_at: new Date().toISOString()
        };
      });

      const historyQuestions = attempts.map(a => {
        const video = videoMap.get(Number(a.video_id));
        const offering = video ? offeringMap.get(Number(video.offering_id)) : null;
        const course = offering ? courseMap.get(Number(offering.course_id)) : null;
        return {
          student_id: student.id,
          enrollment_id: enrollment.id,
          academic_year_id: Number(enrollment.academic_year_id),
          semester_id: Number(enrollment.semester_id),
          record_type: 'question',
          source_id: a.id,
          video_id: Number(a.video_id),
          question_id: Number(a.question_id),
          selected_option_id: a.selected_option_id == null ? null : Number(a.selected_option_id),
          is_correct: !!a.is_correct,
          attempted_at: a.attempted_at || null,
          course_id: course?.course_id ?? offering?.course_id ?? null,
          course_name: course?.course_name ?? null,
          course_code: course?.course_code ?? null,
          offering_id: video?.offering_id ?? null,
          video_title: video?.video_title ?? null,
          display_order: video?.display_order ?? null,
          branch_id: Number(student.branch_id),
          branch_name: branch?.name ?? null,
          batch_id: Number(student.batch_id),
          batch_label: batch?.label ?? null,
          snapshot_at: new Date().toISOString()
        };
      });

      // Make the operation idempotent if a previous move partially succeeded.
      const videoSourceIds = historyVideos.map(x => Number(x.source_id)).filter(Number.isInteger);
      const questionSourceIds = historyQuestions.map(x => Number(x.source_id)).filter(Number.isInteger);
      if (videoSourceIds.length) {
        const del = await supabase.from('student_progress_history')
          .delete().eq('student_id', student.id).eq('record_type', 'video').in('source_id', videoSourceIds);
        if (del.error) throw del.error;
      }
      if (questionSourceIds.length) {
        const del = await supabase.from('student_progress_history')
          .delete().eq('student_id', student.id).eq('record_type', 'question').in('source_id', questionSourceIds);
        if (del.error) throw del.error;
      }

      if (historyVideos.length) {
        const inserted = await supabase.from('student_progress_history').insert(historyVideos);
        if (inserted.error) throw inserted.error;
      }
      if (historyQuestions.length) {
        const inserted = await supabase.from('student_progress_history').insert(historyQuestions);
        if (inserted.error) throw inserted.error;
      }

      // Current progress belongs to the old semester and must not leak into the new one.
      const deleteAttempts = await supabase.from('student_question_attempts').delete().eq('student_id', student.id);
      if (deleteAttempts.error) throw deleteAttempts.error;
      const deleteProgress = await supabase.from('student_video_progress').delete().eq('student_id', student.id);
      if (deleteProgress.error) throw deleteProgress.error;

      return { videoCount: historyVideos.length, questionCount: historyQuestions.length };
    };

    let archivedVideoCount = 0;
    let archivedQuestionCount = 0;

    for (const student of students) {
      const currentResult = await supabase
        .from('student_enrollments')
        .select('id,academic_year_id,semester_id,is_current,status')
        .eq('student_id', student.id)
        .eq('is_current', true)
        .limit(1)
        .maybeSingle();
      if (currentResult.error) throw currentResult.error;

      const from = currentResult.data;
      if (from && Number(from.academic_year_id) === targetYear && Number(from.semester_id) === targetSemester) {
        await supabase.from('students').update({ semester_id: targetSemester, updated_at: new Date().toISOString() }).eq('id', student.id);
        continue;
      }

      // IMPORTANT: archive old semester progress before closing the old enrollment.
      if (from) {
        const archived = await archiveCurrentProgress(student, from);
        archivedVideoCount += archived.videoCount;
        archivedQuestionCount += archived.questionCount;
      }

      const targetResult = await supabase
        .from('student_enrollments')
        .select('id,status,is_current')
        .eq('student_id', student.id)
        .eq('academic_year_id', targetYear)
        .eq('semester_id', targetSemester)
        .limit(1)
        .maybeSingle();
      if (targetResult.error) throw targetResult.error;

      if (from) {
        const closed = await supabase.from('student_enrollments').update({ is_current: false, updated_at: new Date().toISOString() }).eq('id', from.id);
        if (closed.error) throw closed.error;
      }

      let targetEnrollmentId;
      let created = false;
      if (targetResult.data) {
        const reopened = await supabase.from('student_enrollments').update({ is_current: true, status: 'active', updated_at: new Date().toISOString() }).eq('id', targetResult.data.id).select('id').single();
        if (reopened.error) throw reopened.error;
        targetEnrollmentId = reopened.data.id;
      } else {
        const inserted = await supabase.from('student_enrollments').insert({ student_id: student.id, academic_year_id: targetYear, semester_id: targetSemester, is_current: true, status: 'active' }).select('id').single();
        if (inserted.error) throw inserted.error;
        targetEnrollmentId = inserted.data.id;
        created = true;
      }

      const updatedStudent = await supabase.from('students').update({ semester_id: targetSemester, updated_at: new Date().toISOString() }).eq('id', student.id);
      if (updatedStudent.error) throw updatedStudent.error;

      if (from) {
        const movementType = targetSemester > Number(from.semester_id) ? 'promote' : targetSemester < Number(from.semester_id) ? 'demote' : 'correct';
        const promotion = await supabase.from('student_promotions').insert({
          student_id: student.id,
          from_semester_id: Number(from.semester_id),
          to_semester_id: targetSemester,
          academic_year_id: targetYear,
          moved_by: adminId,
          movement_type: movementType,
          from_enrollment_id: from.id,
          to_enrollment_id: targetEnrollmentId,
          to_enrollment_created: created
        });
        if (promotion.error) throw promotion.error;
      }
    }

    res.json({
      message: `${ids.length} student${ids.length === 1 ? '' : 's'} moved successfully.`,
      moved: ids.length,
      archived_video_records: archivedVideoCount,
      archived_question_records: archivedQuestionCount
    });
  } catch (error) {
    console.error('Move students error:', error);
    res.status(500).json({ message: error.message || 'Unable to move students.' });
  }
});
export default router;
