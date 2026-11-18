import { useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errors';
import { isEmail, required } from '../utils/validators';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState<{ email: string; password: string }>({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  const from = location.state?.from?.pathname || '/';
  if (user) return <Navigate to={from} replace />;

  const set = (field: 'email' | 'password') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!Object.keys(current).length) return current;
      const message = field === 'email'
        ? required(value, 'Email') || isEmail(value)
        : required(value, 'Password');
      return { ...current, [field]: message };
    });
    setApiError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting.current) return;
    const v = {
      email: required(form.email, 'Email') || isEmail(form.email),
      password: required(form.password, 'Password'),
    };
    setErrors(v);
    if (Object.values(v).some(Boolean)) return;
    submitting.current = true;
    setBusy(true); setApiError('');
    try {
      await login(form.email.trim(), form.password);
      navigate(from, { replace: true });
    } catch (err) {
      setApiError(getErrorMessage(err));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Card sx={{ width: '100%', maxWidth: 420 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" gutterBottom>Sales &amp; Inventory Management</Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>Sign in to continue</Typography>
          {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}
          <Box component="form" onSubmit={submit} noValidate>
            <Stack spacing={2}>
              <TextField label="Email" type="email" autoComplete="username" value={form.email} onChange={set('email')} error={Boolean(errors.email)} helperText={errors.email} autoFocus />
              <TextField label="Password" type="password" autoComplete="current-password" value={form.password} onChange={set('password')} error={Boolean(errors.password)} helperText={errors.password} />
              <Button type="submit" variant="contained" size="large" disabled={busy || Object.values(errors).some(Boolean) || Boolean(apiError)}>{busy ? 'Signing in...' : 'Sign in'}</Button>
            </Stack>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>
            Demo: manager@example.com / Manager@123 &middot; sales@example.com / Sales@123
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
