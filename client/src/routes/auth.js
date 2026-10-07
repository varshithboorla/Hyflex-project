import { Router } from 'express';
import { supabase } from '../supabase.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) return res.status(400).json({ message: 'Please enter your email/roll number and password.' });

  try {
    const admin = await supabase.from('admins').select('id,email,created_at').eq('email', identifier).eq('password_hash', password).maybeSingle();
    if (admin.error) throw admin.error;
    if (admin.data) {
      req.session.user = { id: admin.data.id, email: admin.data.email, role: 'admin' };
      return req.session.save((sessionError) => {
        if (sessionError) {
          console.error('Session save error:', sessionError);
          return res.status(500).json({ message: 'Login session could not be saved.' });
        }
        return res.json({ user: req.session.user });
      });
    }

    const student = await supabase.from('students').select('id,roll_number,email,first_name,last_name,batch_id,branch_id,semester_id,created_at,status').eq('roll_number', identifier).eq('password_hash', password).maybeSingle();
    if (student.error) throw student.error;
    if (student.data && (!student.data.status || student.data.status === 'active')) {
      req.session.user = { ...student.data, role: 'student' };
      return req.session.save((sessionError) => {
        if (sessionError) {
          console.error('Session save error:', sessionError);
          return res.status(500).json({ message: 'Login session could not be saved.' });
        }
        return res.json({ user: req.session.user });
      });
    }

    return res.status(401).json({ message: 'Invalid email/roll number or password.' });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Login failed.' });
  }
});

router.get('/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: 'Not authenticated.' });
  res.json({ user: req.session.user });
});

router.post('/logout', (req, res) => {
  req.session.destroy((error) => {
    if (error) return res.status(500).json({ message: 'Logout failed.' });
    res.clearCookie('hyflex.sid');
    res.json({ success: true });
  });
});

export default router;
