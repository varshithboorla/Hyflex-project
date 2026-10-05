import { Router } from 'express';
import { supabase } from '../supabase.js';

const router = Router();

router.use((req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(401).json({ message: 'Admin authentication required.' });
  }
  next();
});

function sendError(res, error, fallback) {
  console.error(fallback, error);
  const code = error?.code;
  if (code === '23505') return res.status(409).json({ message: 'This record already exists.', code });
  if (code === '23503') return res.status(409).json({ message: 'This record is still in use by another record.', code });
  return res.status(500).json({ message: error?.message || fallback, code });
}

async function loadYears() {
  const { data, error } = await supabase
    .from('academic_years')
    .select('id,label,start_date,end_date,is_current')
    .order('start_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function loadRegulations() {
  const { data, error } = await supabase
    .from('regulations')
    .select('id,code,name')
    .order('code');
  if (error) throw error;
  return data || [];
}

async function loadBatches() {
  const { data, error } = await supabase
    .from('batches')
    .select('id,label,admission_year,graduation_year,regulation_id')
    .order('admission_year', { ascending: false });
  if (error) throw error;

  const rows = data || [];
  if (!rows.length) return [];

  const { data: students, error: studentError } = await supabase
    .from('students')
    .select('id,batch_id')
    .in('batch_id', rows.map((b) => b.id));
  if (studentError) throw studentError;

  const counts = (students || []).reduce((acc, student) => {
    acc[student.batch_id] = (acc[student.batch_id] || 0) + 1;
    return acc;
  }, {});

  return rows.map((batch) => ({ ...batch, student_count: counts[batch.id] || 0 }));
}

router.get('/academic', async (_req, res) => {
  try {
    const [academicYears, regulations, batches] = await Promise.all([
      loadYears(),
      loadRegulations(),
      loadBatches()
    ]);
    res.json({ academicYears, regulations, batches });
  } catch (error) {
    sendError(res, error, 'Unable to load academic setup.');
  }
});

router.post('/academic/years', async (req, res) => {
  const label = String(req.body?.label || '').trim();
  const startDate = String(req.body?.start_date || '').trim();
  const endDate = String(req.body?.end_date || '').trim();
  const makeCurrent = Boolean(req.body?.is_current);

  if (!label || !startDate || !endDate) return res.status(400).json({ message: 'Please fill the label, start date and end date.' });
  if (endDate <= startDate) return res.status(400).json({ message: 'The end date must be after the start date.' });

  try {
    const { data, error } = await supabase
      .from('academic_years')
      .insert({ label, start_date: startDate, end_date: endDate, is_current: false })
      .select('id,label,start_date,end_date,is_current')
      .single();
    if (error) throw error;

    if (makeCurrent) {
      const { error: clearError } = await supabase.from('academic_years').update({ is_current: false }).eq('is_current', true);
      if (clearError) throw clearError;
      const { error: currentError } = await supabase.from('academic_years').update({ is_current: true }).eq('id', data.id);
      if (currentError) throw currentError;
    }

    res.status(201).json({ years: await loadYears() });
  } catch (error) {
    sendError(res, error, 'Failed to save academic year.');
  }
});

router.post('/academic/years/:id/current', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ message: 'Invalid academic year.' });
  try {
    const { data: year, error: findError } = await supabase.from('academic_years').select('id,label').eq('id', id).maybeSingle();
    if (findError) throw findError;
    if (!year) return res.status(404).json({ message: 'Academic year not found.' });

    const { error: clearError } = await supabase.from('academic_years').update({ is_current: false }).eq('is_current', true);
    if (clearError) throw clearError;
    const { error } = await supabase.from('academic_years').update({ is_current: true }).eq('id', id);
    if (error) throw error;
    res.json({ years: await loadYears() });
  } catch (error) {
    sendError(res, error, 'Failed to change the current academic year.');
  }
});

router.delete('/academic/years/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ message: 'Invalid academic year.' });
  try {
    const { data: year, error: findError } = await supabase.from('academic_years').select('id,label,is_current').eq('id', id).maybeSingle();
    if (findError) throw findError;
    if (!year) return res.status(404).json({ message: 'Academic year not found.' });
    if (year.is_current) return res.status(400).json({ message: 'Set another academic year as current before deleting this year.' });

    const { error } = await supabase.from('academic_years').delete().eq('id', id);
    if (error) throw error;
    res.json({ years: await loadYears() });
  } catch (error) {
    sendError(res, error, 'Failed to delete academic year.');
  }
});

router.post('/academic/regulations', async (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  const name = String(req.body?.name || '').trim() || null;
  if (!code) return res.status(400).json({ message: 'Please enter the regulation code.' });
  try {
    const { error } = await supabase.from('regulations').insert({ code, name });
    if (error) throw error;
    res.status(201).json({ regulations: await loadRegulations() });
  } catch (error) {
    sendError(res, error, 'Failed to save regulation.');
  }
});

router.delete('/academic/regulations/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ message: 'Invalid regulation.' });
  try {
    const { error } = await supabase.from('regulations').delete().eq('id', id);
    if (error) throw error;
    res.json({ regulations: await loadRegulations() });
  } catch (error) {
    sendError(res, error, 'Failed to delete regulation.');
  }
});

router.post('/academic/batches', async (req, res) => {
  const admissionYear = Number(req.body?.admission_year);
  const duration = Number(req.body?.duration);
  const regulationId = Number(req.body?.regulation_id);
  if (!Number.isInteger(regulationId) || regulationId <= 0) return res.status(400).json({ message: 'Please add a regulation first, then pick it here.' });
  if (!Number.isInteger(admissionYear) || !Number.isInteger(duration) || admissionYear < 2000 || admissionYear > 2100 || duration < 1 || duration > 8) {
    return res.status(400).json({ message: 'Please enter a valid admission year and programme length.' });
  }
  try {
    const graduationYear = admissionYear + duration;
    const { error } = await supabase.from('batches').insert({
      label: `${admissionYear}-${graduationYear}`,
      admission_year: admissionYear,
      graduation_year: graduationYear,
      regulation_id: regulationId
    });
    if (error) throw error;
    res.status(201).json({ batches: await loadBatches() });
  } catch (error) {
    sendError(res, error, 'Failed to save batch.');
  }
});

router.patch('/academic/batches/:id/regulation', async (req, res) => {
  const id = Number(req.params.id);
  const regulationId = Number(req.body?.regulation_id);
  if (!Number.isInteger(id) || !Number.isInteger(regulationId) || regulationId <= 0) return res.status(400).json({ message: 'Invalid batch or regulation.' });
  try {
    const { error } = await supabase.from('batches').update({ regulation_id: regulationId }).eq('id', id);
    if (error) throw error;
    res.json({ batches: await loadBatches() });
  } catch (error) {
    sendError(res, error, 'Failed to change batch regulation.');
  }
});

router.delete('/academic/batches/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ message: 'Invalid batch.' });
  try {
    const { count, error: countError } = await supabase.from('students').select('id', { count: 'exact', head: true }).eq('batch_id', id);
    if (countError) throw countError;
    if ((count || 0) > 0) return res.status(409).json({ message: `This batch still has ${count} student(s). Move or delete them first.` });

    const { error } = await supabase.from('batches').delete().eq('id', id);
    if (error) throw error;
    res.json({ batches: await loadBatches() });
  } catch (error) {
    sendError(res, error, 'Failed to delete batch.');
  }
});

export default router;
