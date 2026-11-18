import { useState, type ChangeEvent } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, Paper,
  Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import { customersApi } from '../api/endpoints';
import useFetch from '../hooks/useFetch';
import useDebounce from '../hooks/useDebounce';
import PageHeader from '../components/PageHeader';
import Loader from '../components/Loader';
import ErrorAlert from '../components/ErrorAlert';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { useNotify } from '../context/NotificationContext';
import { getErrorMessage, getFieldErrors } from '../utils/errors';
import { hasErrors, isEmail, isPhone, required } from '../utils/validators';

const EMPTY = { name: '', email: '', phone: '', address: '' };
type CustomerRecord = { id: number; name: string; email: string | null; phone: string | null; address: string | null; is_active: boolean };
type CustomerForm = typeof EMPTY;
type CustomerDialogProps = { customer?: CustomerRecord; onClose: () => void; onSaved: () => void };

function CustomerDialog({ customer, onClose, onSaved }: CustomerDialogProps) {
  const editing = Boolean(customer);
  const notify = useNotify();
  const [form, setForm] = useState<CustomerForm>(editing && customer ? { name: customer.name, email: customer.email || '', phone: customer.phone || '', address: customer.address || '' } : EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [busy, setBusy] = useState(false);
  const validateField = (field: keyof CustomerForm, value: string) => {
    if (field === 'name') return required(value, 'Name');
    if (field === 'email') return isEmail(value);
    if (field === 'phone') return isPhone(value);
    return '';
  };
  const set = (field: keyof CustomerForm) => (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => Object.keys(current).length
      ? { ...current, [field]: validateField(field, value) }
      : current);
    setApiError('');
  };

  const submit = async () => {
    const v = { name: required(form.name, 'Name'), email: isEmail(form.email), phone: isPhone(form.phone) };
    setErrors(v);
    if (hasErrors(v)) return;
    setBusy(true); setApiError('');
    const body = { name: form.name.trim(), email: form.email.trim() || null, phone: form.phone.trim() || null, address: form.address.trim() || null };
    try {
      if (editing) await customersApi.update(customer.id, { ...body, is_active: customer.is_active });
      else await customersApi.create(body);
      notify.success(editing ? 'Customer updated' : 'Customer created');
      onSaved();
    } catch (e) {
      setErrors((prev) => ({ ...prev, ...getFieldErrors(e) }));
      setApiError(getErrorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editing ? 'Edit customer' : 'New customer'}</DialogTitle>
      <DialogContent>
        {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Name" value={form.name} onChange={set('name')} error={Boolean(errors.name)} helperText={errors.name} />
          <TextField label="Email" type="email" value={form.email} onChange={set('email')} error={Boolean(errors.email)} helperText={errors.email} />
          <TextField label="Phone" value={form.phone} onChange={set('phone')} error={Boolean(errors.phone)} helperText={errors.phone} />
          <TextField label="Address" value={form.address} onChange={set('address')} multiline minRows={2} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button onClick={submit} variant="contained" disabled={busy || hasErrors(errors) || Boolean(apiError)}>{busy ? 'Saving...' : 'Save'}</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function Customers() {
  const { isManager } = useAuth();
  const notify = useNotify();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState(10);
  const [dialog, setDialog] = useState<{ customer?: CustomerRecord } | null>(null);
  const [toDelete, setToDelete] = useState<CustomerRecord | null>(null);
  const q = useDebounce(search);

  const { data, loading, error, reload } = useFetch(
    () => customersApi.list({ q: q || undefined, page: page + 1, page_size: rows }), [q, page, rows]);

  const deactivate = async () => {
    if (!toDelete) return;
    try { await customersApi.deactivate(toDelete.id); notify.success('Customer deactivated'); setToDelete(null); reload(); }
    catch (e) { notify.error(getErrorMessage(e)); setToDelete(null); }
  };

  return (
    <>
      <PageHeader title="Customers" subtitle="People and companies you sell to"
        actions={<Button variant="contained" startIcon={<AddIcon />} disabled={loading || Boolean(error)} onClick={() => setDialog({})}>New customer</Button>} />
      <Paper sx={{ p: { xs: 1, sm: 2 } }}>
        <Box sx={{ mb: 2 }}>
          <TextField sx={{ maxWidth: 360 }} placeholder="Search by name, email or phone" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }} />
        </Box>
        <ErrorAlert message={error} onRetry={reload} sx={{ mb: 2 }} />
        {loading && !data ? <Loader variant="table" /> : (
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow><TableCell>Name</TableCell><TableCell>Email</TableCell><TableCell>Phone</TableCell><TableCell>Address</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
              <TableBody>
                {data?.items.length === 0 && <TableRow><TableCell colSpan={6} align="center">No customers found</TableCell></TableRow>}
                {data?.items.map((c) => (
                  <TableRow key={c.id} hover>
                    <TableCell>{c.name}</TableCell><TableCell>{c.email || '-'}</TableCell><TableCell>{c.phone || '-'}</TableCell><TableCell>{c.address || '-'}</TableCell>
                    <TableCell><Chip size="small" label={c.is_active ? 'Active' : 'Inactive'} color={c.is_active ? 'success' : 'default'} variant="outlined" /></TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit"><IconButton size="small" disabled={loading || Boolean(error)} onClick={() => setDialog({ customer: c })}><EditIcon fontSize="small" /></IconButton></Tooltip>
                      {isManager && <Tooltip title="Deactivate"><IconButton size="small" color="error" disabled={loading || Boolean(error)} onClick={() => setToDelete(c)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <TablePagination component="div" count={data?.total || 0} page={page} rowsPerPage={rows} rowsPerPageOptions={[10, 25, 50]}
          onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setRows(Number(e.target.value)); setPage(0); }} />
      </Paper>
      {dialog && <CustomerDialog customer={dialog.customer} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); reload(); }} />}
      <ConfirmDialog open={Boolean(toDelete)} title="Deactivate customer" confirmLabel="Deactivate"
        message={`"${toDelete?.name}" will be hidden from new orders. Order history is kept.`} onConfirm={deactivate} onClose={() => setToDelete(null)} />
    </>
  );
}
