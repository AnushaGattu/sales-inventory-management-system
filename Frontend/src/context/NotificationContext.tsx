import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';

const NotificationContext = createContext(null);
export const useNotify = () => useContext(NotificationContext);

export function NotificationProvider({ children }) {
  const [toast, setToast] = useState(null);
  const show = useCallback((severity) => (message) => setToast({ severity, message, key: Date.now() }), []);
  const api = useMemo(() => ({ success: show('success'), error: show('error'), info: show('info') }), [show]);

  return (
    <NotificationContext.Provider value={api}>
      {children}
      <Snackbar
        key={toast?.key}
        open={Boolean(toast)}
        autoHideDuration={5000}
        onClose={(_, reason) => reason !== 'clickaway' && setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? <Alert severity={toast.severity} variant="filled" onClose={() => setToast(null)}>{toast.message}</Alert> : undefined}
      </Snackbar>
    </NotificationContext.Provider>
  );
}
