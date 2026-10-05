import { useNavigate } from 'react-router-dom';
import { authApi } from '../lib/api';
import AdminLayout from '../components/layout/AdminLayout';
import AdminRoutes from './admin/AdminRoutes';

export default function AdminPage({ session, onLogout }) {
  const navigate = useNavigate();
  const logout = async () => { try { await authApi.logout(); } finally { onLogout(); navigate('/login', { replace: true }); } };
  return <AdminLayout session={session} onLogout={logout}><AdminRoutes /></AdminLayout>;
}
