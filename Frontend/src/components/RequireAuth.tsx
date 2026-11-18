import { Navigate, useLocation } from 'react-router-dom';
import { Alert, Box, Button } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loader from './Loader';
import type { ReactNode } from 'react';

/** Route guard. Without `roles`: any signed-in user. With `roles`: only those roles (else a 403 screen).
 *  The backend enforces the same rules; this only keeps the UI honest. */
type RequireAuthProps = { roles?: string[]; children: ReactNode };

export default function RequireAuth({ roles, children }: RequireAuthProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(user.role)) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning" action={<Button component={RouterLink} to="/" color="inherit" size="small">Dashboard</Button>}>
          You do not have permission to view this page.
        </Alert>
      </Box>
    );
  }
  return children;
}
