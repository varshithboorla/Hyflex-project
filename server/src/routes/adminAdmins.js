import { Router } from 'express';
import { supabase } from '../supabase.js';

const router = Router();

router.use((req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(401).json({ message: 'Admin authentication required.' });
  }
  next();
});

router.get('/admins', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('admins')
      .select('id,email,created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Admins list error:', error);
    res.status(500).json({ message: 'Unable to load administrators.' });
  }
});

router.post('/admins', async (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = String(email || '').trim();
  const plainPassword = String(password || '');
  if (!normalizedEmail) return res.status(400).json({ message: 'Please enter an admin email.' });
  if (!plainPassword) return res.status(400).json({ message: 'Password is required for a new admin.' });

  try {
    const { data, error } = await supabase
      .from('admins')
      .insert({ email: normalizedEmail, password_hash: plainPassword })
      .select('id,email,created_at')
      .single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ message: 'An administrator with this email already exists.' });
      throw error;
    }
    res.status(201).json(data);
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ message: error.message || 'Failed to create administrator.' });
  }
});

router.patch('/admins/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { email, password } = req.body || {};
  const normalizedEmail = String(email || '').trim();
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid administrator id.' });
  if (!normalizedEmail) return res.status(400).json({ message: 'Please enter an admin email.' });

  try {
    const update = { email: normalizedEmail };
    if (String(password || '')) update.password_hash = String(password);

    const { data, error } = await supabase
      .from('admins')
      .update(update)
      .eq('id', id)
      .select('id,email,created_at')
      .single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ message: 'An administrator with this email already exists.' });
      throw error;
    }

    if (req.session.user.id === id) {
      req.session.user.email = normalizedEmail;
      await new Promise((resolve, reject) => req.session.save((err) => err ? reject(err) : resolve()));
    }
    res.json(data);
  } catch (error) {
    console.error('Update admin error:', error);
    res.status(500).json({ message: error.message || 'Failed to update administrator.' });
  }
});

router.delete('/admins/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid administrator id.' });
  if (req.session.user.id === id) return res.status(400).json({ message: 'You cannot delete the administrator account you are currently logged in with.' });

  try {
    const { error } = await supabase.from('admins').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Delete admin error:', error);
    res.status(500).json({ message: error.message || 'Failed to delete administrator.' });
  }
});

export default router;
