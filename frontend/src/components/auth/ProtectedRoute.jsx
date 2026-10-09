import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes';

/**
 * Guards routes behind authentication + optional role check.
 * roles: ['RECRUITER'] — uppercase strings matching user.role
 */
export default function ProtectedRoute({ children, roles }) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  // Not logged in → send to login, remember where they came from
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  // Logged in but wrong role → forbidden
  if (roles && roles.length > 0 && !roles.includes(user?.role?.toUpperCase())) {
    return <Navigate to={ROUTES.FORBIDDEN} replace />;
  }

  return children;
}
