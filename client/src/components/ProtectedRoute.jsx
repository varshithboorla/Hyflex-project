import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ session, role, children }) {
  if (!session) return <Navigate to="/login" replace />;
  if (role && session.role !== role) return <Navigate to={session.role === 'admin' ? '/admin' : '/student'} replace />;
  return children;
}
