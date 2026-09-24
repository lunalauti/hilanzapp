import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingScreen } from '../components/ui/LoadingMessage';
import { useAuth } from './AuthProvider';

export function RequireAuth() {
  const { signedIn, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingScreen />;
  if (!signedIn) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
