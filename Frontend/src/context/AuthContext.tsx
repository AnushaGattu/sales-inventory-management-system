import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, TOKEN_KEY } from '../api/endpoints';
import { setCurrency } from '../utils/format';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export const MANAGER_ROLES = ['MANAGER'];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({ approval_threshold: 0, currency: 'INR' });
  const [loading, setLoading] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));

  const loadSettings = useCallback(async () => {
    const s = await authApi.settings();
    setCurrency(s.currency);
    setSettings(s);
  }, []);

  // Restore the session on page refresh.
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    Promise.all([authApi.me(), authApi.settings()])
      .then(([me, s]) => { setCurrency(s.currency); setSettings(s); setUser(me); })
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  const logout = useCallback(() => { localStorage.removeItem(TOKEN_KEY); setUser(null); }, []);

  // Fired by the axios interceptor when the API answers 401.
  useEffect(() => {
    window.addEventListener('auth:expired', logout);
    return () => window.removeEventListener('auth:expired', logout);
  }, [logout]);

  const login = useCallback(async (email, password) => {
    const res = await authApi.login(email, password);
    localStorage.setItem(TOKEN_KEY, res.access_token);
    await loadSettings();
    setUser(res.user);
    return res.user;
  }, [loadSettings]);

  const value = useMemo(() => ({
    user, settings, loading, login, logout,
    isManager: MANAGER_ROLES.includes(user?.role),
  }), [user, settings, loading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
