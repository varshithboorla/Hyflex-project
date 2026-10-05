import { Router } from 'express';
import { supabase } from '../supabase.js';

const router = Router();

router.use((req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(401).json({ message: 'Admin authentication required.' });
  }
  next();
});

async function resultOrThrow(result) {
  if (result.error) throw result.error;
  return result.data;
}

router.get('/courses/meta', async (_req, res) => {
  try {
    const [branches, semesters, academicYears, regulations, batches, folders] = await Promise.all([
      supabase.from('branches').select('id,name,code').order('name'),
      supabase.from('semesters').select('id,semester_number,name').order('semester_number'),
      supabase.from('academic_years').select('id,label,is_current,start_date,end_date').order('start_date', { ascending: false }),
      supabase.from('regulations').select('id,code,name').order('code'),
      supabase.from('batches').select('id,label,admission_year,graduation_year,regulation_id').order('admission_year', { ascending: false }),
      supabase.from('folders').select('id,name,description,academic_year_id,semester_type').order('id')
    ]);
    [branches, semesters, academicYears, regulations, batches, folders].forEach(r => { if (r.error) throw r.error; });
    res.json({ branches: branches.data || [], semesters: semesters.data || [], academicYears: academicYears.data || [], regulations: regulations.data || [], batches: batches.data || [], folders: folders.data || [] });
  } catch (error) {
    console.error('Course metadata error:', error);
    res.status(500).json({ message: error.message || 'Unable to load course metadata.' });
  }
});

router.post('/courses/folders/sync', async (_req, res) => {
  try {
    const { error } = await supabase.rpc('ensure_all_year_folders');
    if (error) throw error;
    const { data, error: reloadError } = await supabase.from('folders').select('id,name,description,academic_year_id,semester_type').order('id');
    if (reloadError) throw reloadError;
    res.json({ folders: data || [] });
  } catch (error) {
    console.error('Folder sync error:', error);
    res.status(500).json({ message: error.message || 'Could not sync folders.' });
  }
});

router.patch('/courses/folders/:id', async (req, res) => {
  try {
    const description = String(req.body?.description || '').trim() || null;
    const { data, error } = await supabase.from('folders').update({ description }).eq('id', Number(req.params.id)).select('id,name,description,academic_year_id,semester_type').single();
    if (error) throw error;
    res.json({ folder: data });
  } catch (error) {
    console.error('Folder update error:', error);
    res.status(500).json({ message: error.message || 'Could not update folder note.' });
  }
});

router.get('/courses/offerings', async (_req, res) => {
  try {
    const { data, error } = await supabase.from('course_offerings').select(`
      id, course_id, academic_year_id, regulation_id, semester_id, folder_id, batch_id, is_published, created_at,
      courses ( course_name, course_code ),
      course_offering_branches ( branch_id )
    `).order('id', { ascending: false });
    if (error) throw error;
    res.json({ offerings: data || [] });
  } catch (error) {
    console.error('Offerings load error:', error);
    res.status(500).json({ message: error.message || 'Failed to load courses.' });
  }
});

router.post('/courses/offerings', async (req, res) => {
  const body = req.body || {};
  const folderId = Number(body.folder_id);
  const semesterId = Number(body.semester_id);
  const batchIds = Array.isArray(body.batch_ids) ? body.batch_ids.map(Number).filter(Number.isFinite) : [];
  const branchIds = Array.isArray(body.branch_ids) ? body.branch_ids.map(Number).filter(Number.isFinite) : [];
  const courseName = String(body.course_name || '').trim();
  const isPublished = body.is_published !== false;

  if (!folderId || !semesterId || !courseName || batchIds.length === 0 || branchIds.length === 0) {
    return res.status(400).json({ message: 'Course name, folder, semester, at least one batch, and at least one branch are required.' });
  }

  try {
    const { data: folder, error: folderError } = await supabase.from('folders').select('id,academic_year_id,semester_type').eq('id', folderId).single();
    if (folderError) throw folderError;

    const { data: semesters, error: semError } = await supabase.from('semesters').select('id,semester_number').in('id', [semesterId]);
    if (semError) throw semError;
    const selectedSemester = semesters?.[0];
    if (!selectedSemester) return res.status(400).json({ message: 'Selected semester does not exist.' });
    const isOdd = selectedSemester.semester_number % 2 === 1;
    if ((folder.semester_type === 'odd') !== isOdd) return res.status(400).json({ message: 'The selected semester does not belong to this folder.' });

    const { data: batches, error: batchError } = await supabase.from('batches').select('id,label,admission_year,graduation_year,regulation_id').in('id', batchIds);
    if (batchError) throw batchError;
    if ((batches || []).length !== batchIds.length) return res.status(400).json({ message: 'One or more selected batches do not exist.' });

    for (const batch of batches) {
      const startYear = Number(String((await supabase.from('academic_years').select('start_date').eq('id', folder.academic_year_id).single()).data?.start_date || '').slice(0, 4));
      const expectedSemester = (startYear - Number(batch.admission_year)) * 2 + (isOdd ? 1 : 2);
      const lastSemester = (Number(batch.graduation_year) - Number(batch.admission_year)) * 2;
      if (expectedSemester < 1 || expectedSemester > lastSemester || expectedSemester !== selectedSemester.semester_number) {
        return res.status(400).json({ message: `Batch ${batch.label} does not belong to the selected semester.` });
      }
    }

    let { data: existingCourse, error: courseFindError } = await supabase.from('courses').select('course_id').ilike('course_name', courseName.replace(/[%_]/g, '\\$&')).order('course_id').limit(1);
    if (courseFindError) throw courseFindError;
    let courseId;
    let created = false;
    if (existingCourse?.length) {
      courseId = existingCourse[0].course_id;
    } else {
      const inserted = await supabase.from('courses').insert({ course_name: courseName }).select('course_id').single();
      if (inserted.error) throw inserted.error;
      courseId = inserted.data.course_id;
      created = true;
    }

    const done = [];
    const failed = [];
    for (const batch of batches) {
      const offering = await supabase.from('course_offerings').insert({
        course_id: courseId,
        folder_id: folder.id,
        academic_year_id: folder.academic_year_id,
        batch_id: batch.id,
        regulation_id: batch.regulation_id,
        semester_id: semesterId,
        is_published: isPublished
      }).select('id').single();
      if (offering.error) {
        failed.push(`${batch.label}: ${offering.error.message}`);
        continue;
      }
      const links = await supabase.from('course_offering_branches').insert(branchIds.map(branch_id => ({ offering_id: offering.data.id, branch_id })));
      if (links.error) {
        await supabase.from('course_offerings').delete().eq('id', offering.data.id);
        failed.push(`${batch.label}: ${links.error.message}`);
        continue;
      }
      done.push(batch.label);
    }

    if (done.length === 0 && created) await supabase.from('courses').delete().eq('course_id', courseId);
    res.status(done.length ? 201 : 400).json({ message: done.length ? `Course created for ${done.join(', ')}.${failed.length ? ` Skipped — ${failed.join(' | ')}` : ''}` : failed.join(' | '), failed });
  } catch (error) {
    console.error('Course create error:', error);
    res.status(500).json({ message: error.message || 'Failed to create course.' });
  }
});

router.patch('/courses/offerings/:id', async (req, res) => {
  const offeringId = Number(req.params.id);
  const body = req.body || {};
  const courseName = String(body.course_name || '').trim();
  const batchId = Number(body.batch_id);
  const semesterId = Number(body.semester_id);
  const branchIds = Array.isArray(body.branch_ids) ? body.branch_ids.map(Number).filter(Number.isFinite) : [];
  if (!offeringId || !courseName || !batchId || !semesterId || branchIds.length === 0) return res.status(400).json({ message: 'Course name, batch, semester, and at least one branch are required.' });
  try {
    const current = await supabase.from('course_offerings').select('id,course_id,folder_id,academic_year_id').eq('id', offeringId).single();
    if (current.error) throw current.error;
    const folder = await supabase.from('folders').select('id,academic_year_id,semester_type').eq('id', current.data.folder_id).single();
    if (folder.error) throw folder.error;
    const batch = await supabase.from('batches').select('id,label,admission_year,graduation_year,regulation_id').eq('id', batchId).single();
    if (batch.error) throw batch.error;
    const ay = await supabase.from('academic_years').select('start_date').eq('id', folder.data.academic_year_id).single();
    if (ay.error) throw ay.error;
    const sem = await supabase.from('semesters').select('id,semester_number').eq('id', semesterId).single();
    if (sem.error) throw sem.error;
    const expected = (Number(String(ay.data.start_date).slice(0,4)) - Number(batch.data.admission_year)) * 2 + (folder.data.semester_type === 'odd' ? 1 : 2);
    if (expected !== sem.data.semester_number) return res.status(400).json({ message: `Batch ${batch.data.label} does not belong to the selected semester.` });

    const courseFind = await supabase.from('courses').select('course_id').ilike('course_name', courseName.replace(/[%_]/g, '\\$&')).order('course_id').limit(1);
    if (courseFind.error) throw courseFind.error;
    let courseId = courseFind.data?.[0]?.course_id;
    let created = false;
    if (!courseId) {
      const inserted = await supabase.from('courses').insert({ course_name: courseName }).select('course_id').single();
      if (inserted.error) throw inserted.error;
      courseId = inserted.data.course_id;
      created = true;
    }
    const updated = await supabase.from('course_offerings').update({ course_id: courseId, batch_id: batchId, regulation_id: batch.data.regulation_id, semester_id: semesterId, is_published: body.is_published !== false }).eq('id', offeringId);
    if (updated.error) { if (created) await supabase.from('courses').delete().eq('course_id', courseId); throw updated.error; }
    const clear = await supabase.from('course_offering_branches').delete().eq('offering_id', offeringId);
    if (clear.error) throw clear.error;
    const links = await supabase.from('course_offering_branches').insert(branchIds.map(branch_id => ({ offering_id: offeringId, branch_id })));
    if (links.error) throw links.error;
    if (current.data.course_id !== courseId) {
      const count = await supabase.from('course_offerings').select('id', { count: 'exact', head: true }).eq('course_id', current.data.course_id);
      if (!count.error && (count.count || 0) === 0) await supabase.from('courses').delete().eq('course_id', current.data.course_id);
    }
    res.json({ message: 'Course updated successfully.' });
  } catch (error) {
    console.error('Course update error:', error);
    res.status(500).json({ message: error.message || 'Failed to update course.' });
  }
});

router.delete('/courses/offerings/:id', async (req, res) => {
  const offeringId = Number(req.params.id);
  try {
    const current = await supabase.from('course_offerings').select('id,course_id').eq('id', offeringId).single();
    if (current.error) throw current.error;
    const videos = await supabase.from('videos').select('video_id').eq('offering_id', offeringId);
    if (videos.error) throw videos.error;
    const videoIds = (videos.data || []).map(v => v.video_id);
    if (videoIds.length) {
      const questions = await supabase.from('video_questions').select('question_id').in('video_id', videoIds);
      if (questions.error) throw questions.error;
      const questionIds = (questions.data || []).map(q => q.question_id);
      const deleteIn = async (table, column, values) => { if (!values.length) return; const r = await supabase.from(table).delete().in(column, values); if (r.error) throw r.error; };
      await deleteIn('student_question_attempts', 'video_id', videoIds);
      await deleteIn('question_options', 'question_id', questionIds);
      await deleteIn('video_questions', 'video_id', videoIds);
      await deleteIn('video_skips', 'video_id', videoIds);
      await deleteIn('student_video_progress', 'video_id', videoIds);
      await deleteIn('videos', 'video_id', videoIds);
    }
    let r = await supabase.from('course_offering_branches').delete().eq('offering_id', offeringId); if (r.error) throw r.error;
    r = await supabase.from('course_offerings').delete().eq('id', offeringId); if (r.error) throw r.error;
    const remaining = await supabase.from('course_offerings').select('id', { count: 'exact', head: true }).eq('course_id', current.data.course_id);
    if (!remaining.error && (remaining.count || 0) === 0) await supabase.from('courses').delete().eq('course_id', current.data.course_id);
    res.json({ message: 'Course deleted successfully.' });
  } catch (error) {
    console.error('Course delete error:', error);
    res.status(500).json({ message: error.message || 'Failed to delete course.' });
  }
});

export default router;
