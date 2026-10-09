import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getRoleBase } from '../../constants/routes';

/** Prevents authenticated users from accessing public-only routes. */
export default function GuestRoute({ children }) {
  const { user, isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to={getRoleBase(user?.role)} replace />;
  }

  return children;
}
