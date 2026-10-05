import { Router } from 'express';
import { supabase } from '../supabase.js';

const router = Router();

router.use((req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(401).json({ message: 'Admin authentication required.' });
  next();
});

router.get('/dashboard', async (_req, res) => {
  try {
    const [students, branches, semesters] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }),
      supabase.from('branches').select('id', { count: 'exact', head: true }),
      supabase.from('semesters').select('id', { count: 'exact', head: true })
    ]);
    const failed = [students, branches, semesters].find((r) => r.error);
    if (failed) throw failed.error;
    res.json({ students: students.count || 0, branches: branches.count || 0, semesters: semesters.count || 0 });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Unable to load dashboard data.' });
  }
});

export default router;
