import { useState, type ChangeEvent } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton,
  InputAdornment, Paper, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination,
  TableRow, TextField, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import { productsApi } from '../api/endpoints';
import useFetch from '../hooks/useFetch';
import useDebounce from '../hooks/useDebounce';
import PageHeader from '../components/PageHeader';
import Loader from '../components/Loader';
import ErrorAlert from '../components/ErrorAlert';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { useNotify } from '../context/NotificationContext';
import { getErrorMessage, getFieldErrors } from '../utils/errors';
import { formatCurrency } from '../utils/format';
import { hasErrors, nonNegativeInt, positiveNumber, required } from '../utils/validators';

const EMPTY = { sku: '', name: '', description: '', price: '', stock_quantity: '0', reorder_level: '10' };
type ProductRecord = { id: number; sku: string; name: string; description: string | null; price: number | string; stock_quantity: number; reorder_level: number; is_active: boolean };
type ProductForm = typeof EMPTY;
type ProductDialogProps = { open: boolean; product?: ProductRecord; onClose: () => void; onSaved: () => void };

function ProductDialog({ open, product, onClose, onSaved }: ProductDialogProps) {
  const editing = Boolean(product);
  const notify = useNotify();
  const [form, setForm] = useState<ProductForm>(editing && product ? {
    sku: product.sku,
    name: product.name,
    description: product.description || '',
    price: String(product.price),
    stock_quantity: String(product.stock_quantity),
    reorder_level: String(product.reorder_level),
  } : EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [busy, setBusy] = useState(false);
  const validateField = (field: keyof ProductForm, value: string) => {
    if (field === 'sku') return editing ? '' : required(value, 'SKU');
    if (field === 'name') return required(value, 'Name');
    if (field === 'price') return positiveNumber(value, 'Price');
    if (field === 'stock_quantity') return editing ? '' : nonNegativeInt(value, 'Stock');
    if (field === 'reorder_level') return nonNegativeInt(value, 'Reorder level');
    return '';
  };
  const set = (field: keyof ProductForm) => (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => Object.keys(current).length
      ? { ...current, [field]: validateField(field, value) }
      : current);
    setApiError('');
  };

  const submit = async () => {
    const v = {
      sku: editing ? '' : required(form.sku, 'SKU'),
      name: required(form.name, 'Name'),
      price: positiveNumber(form.price, 'Price'),
      stock_quantity: editing ? '' : nonNegativeInt(form.stock_quantity, 'Stock'),
      reorder_level: nonNegativeInt(form.reorder_level, 'Reorder level'),
    };
    setErrors(v);
    if (hasErrors(v)) return;
    setBusy(true); setApiError('');
    try {
      const common = { name: form.name.trim(), description: form.description || null, price: form.price, reorder_level: Number(form.reorder_level) };
      if (editing) await productsApi.update(product.id, common);
      else await productsApi.create({ ...common, sku: form.sku.trim(), stock_quantity: Number(form.stock_quantity) });
      notify.success(editing ? 'Product updated' : 'Product created');
      onSaved();
    } catch (e) {
      setErrors((prev) => ({ ...prev, ...getFieldErrors(e) }));
      setApiError(getErrorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editing ? `Edit ${product.sku}` : 'New product'}</DialogTitle>
      <DialogContent>
        {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="SKU" value={form.sku} onChange={set('sku')} disabled={editing} error={Boolean(errors.sku)} helperText={errors.sku || (editing ? 'SKU cannot be changed' : 'Letters, numbers, - _ .')} />
          <TextField label="Name" value={form.name} onChange={set('name')} error={Boolean(errors.name)} helperText={errors.name} />
          <TextField label="Description" value={form.description || ''} onChange={set('description')} multiline minRows={2} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Price" type="number" value={form.price} onChange={set('price')} error={Boolean(errors.price)} helperText={errors.price} inputProps={{ min: 0, step: '0.01' }} />
            {!editing && <TextField label="Opening stock" type="number" value={form.stock_quantity} onChange={set('stock_quantity')} error={Boolean(errors.stock_quantity)} helperText={errors.stock_quantity} inputProps={{ min: 0 }} />}
            <TextField label="Reorder level" type="number" value={form.reorder_level} onChange={set('reorder_level')} error={Boolean(errors.reorder_level)} helperText={errors.reorder_level} inputProps={{ min: 0 }} />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button onClick={submit} variant="contained" disabled={busy || hasErrors(errors) || Boolean(apiError)}>{busy ? 'Saving...' : 'Save'}</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function Products() {
  const { isManager } = useAuth();
  const notify = useNotify();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState(10);
  const [showInactive, setShowInactive] = useState(false);
  const [dialog, setDialog] = useState<{ product?: ProductRecord } | null>(null);
  const [toDelete, setToDelete] = useState<ProductRecord | null>(null);
  const q = useDebounce(search);

  const { data, loading, error, reload } = useFetch(
    () => productsApi.list({ q: q || undefined, page: page + 1, page_size: rows, include_inactive: showInactive }),
    [q, page, rows, showInactive],
  );

  const deactivate = async () => {
    if (!toDelete) return;
    try { await productsApi.deactivate(toDelete.id); notify.success('Product deactivated'); setToDelete(null); reload(); }
    catch (e) { notify.error(getErrorMessage(e)); setToDelete(null); }
  };

  return (
    <>
      <PageHeader title="Products" subtitle="Catalogue and pricing"
        actions={isManager && <Button variant="contained" startIcon={<AddIcon />} disabled={loading || Boolean(error)} onClick={() => setDialog({})}>New product</Button>} />
      <Paper sx={{ p: { xs: 1, sm: 2 } }}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField sx={{ maxWidth: 360 }} placeholder="Search by name or SKU" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }} />
          {isManager && <FormControlLabel control={<Switch checked={showInactive} onChange={(e) => { setShowInactive(e.target.checked); setPage(0); }} />} label="Show inactive" />}
        </Box>
        <ErrorAlert message={error} onRetry={reload} sx={{ mb: 2 }} />
        {loading && !data ? <Loader variant="table" /> : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>SKU</TableCell><TableCell>Name</TableCell><TableCell align="right">Price</TableCell>
                  <TableCell align="right">In stock</TableCell><TableCell align="right">Reserved</TableCell><TableCell align="right">Available</TableCell>
                  <TableCell>Status</TableCell>{isManager && <TableCell align="right">Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {data?.items.length === 0 && <TableRow><TableCell colSpan={8} align="center">No products found</TableCell></TableRow>}
                {data?.items.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell>{p.sku}</TableCell><TableCell>{p.name}</TableCell>
                    <TableCell align="right">{formatCurrency(p.price)}</TableCell>
                    <TableCell align="right">{p.stock_quantity}</TableCell><TableCell align="right">{p.reserved_quantity}</TableCell>
                    <TableCell align="right">
                      <Chip size="small" label={p.available_quantity} color={p.available_quantity <= p.reorder_level ? 'error' : 'default'} variant={p.available_quantity <= p.reorder_level ? 'filled' : 'outlined'} />
                    </TableCell>
                    <TableCell>{p.is_active ? <Chip size="small" color="success" label="Active" variant="outlined" /> : <Chip size="small" label="Inactive" />}</TableCell>
                    {isManager && (
                      <TableCell align="right">
                        <Tooltip title="Edit"><IconButton size="small" disabled={loading || Boolean(error)} onClick={() => setDialog({ product: p })}><EditIcon fontSize="small" /></IconButton></Tooltip>
                        {p.is_active && <Tooltip title="Deactivate"><IconButton size="small" color="error" disabled={loading || Boolean(error)} onClick={() => setToDelete(p)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <TablePagination component="div" count={data?.total || 0} page={page} rowsPerPage={rows} rowsPerPageOptions={[10, 25, 50]}
          onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setRows(Number(e.target.value)); setPage(0); }} />
      </Paper>

      {dialog && <ProductDialog open product={dialog.product} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); reload(); }} />}
      <ConfirmDialog open={Boolean(toDelete)} title="Deactivate product" confirmLabel="Deactivate"
        message={`"${toDelete?.name}" will no longer be available for new orders. Existing orders are not affected.`}
        onConfirm={deactivate} onClose={() => setToDelete(null)} />
    </>
  );
}
