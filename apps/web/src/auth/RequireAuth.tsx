import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function RequireAuth() {
  const { signedIn, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="p-5 text-center hz-eyebrow">Cargando…</div>;
  if (!signedIn) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
