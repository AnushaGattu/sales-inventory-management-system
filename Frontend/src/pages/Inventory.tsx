import { useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Paper, Stack, Switch,
  Tab, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, Tabs, TextField,
} from '@mui/material';
import { inventoryApi, productsApi } from '../api/endpoints';
import useFetch from '../hooks/useFetch';
import PageHeader from '../components/PageHeader';
import Loader from '../components/Loader';
import ErrorAlert from '../components/ErrorAlert';
import { useAuth } from '../context/AuthContext';
import { useNotify } from '../context/NotificationContext';
import { getErrorMessage } from '../utils/errors';
import { formatDateTime } from '../utils/format';
import { hasErrors } from '../utils/validators';

function AdjustDialog({ product, onClose, onSaved }) {
  const notify = useNotify();
  const [change, setChange] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [busy, setBusy] = useState(false);

  const updateChange = (value: string) => {
    setChange(value);
    setErrors((current) => Object.keys(current).length
      ? { ...current, change: !Number.isInteger(Number(value)) || Number(value) === 0 ? 'Enter a non-zero whole number (negative to remove stock)' : '' }
      : current);
    setApiError('');
  };
  const updateNote = (value: string) => {
    setNote(value);
    setErrors((current) => Object.keys(current).length
      ? { ...current, note: value.trim().length < 3 ? 'A short reason is required' : '' }
      : current);
    setApiError('');
  };

  const submit = async () => {
    const n = Number(change);
    const v = {
      change: !Number.isInteger(n) || n === 0 ? 'Enter a non-zero whole number (negative to remove stock)' : '',
      note: note.trim().length < 3 ? 'A short reason is required' : '',
    };
    setErrors(v);
    if (v.change || v.note) return;
    setBusy(true); setApiError('');
    try {
      await inventoryApi.adjust({ product_id: product.id, quantity_change: n, note: note.trim() });
      notify.success('Stock adjusted'); onSaved();
    } catch (e) { setApiError(getErrorMessage(e)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Adjust stock - {product.sku}</DialogTitle>
      <DialogContent>
        {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="info">On hand: {product.stock_quantity} &middot; Reserved: {product.reserved_quantity}</Alert>
          <TextField label="Quantity change" type="number" value={change} onChange={(e) => updateChange(e.target.value)} error={Boolean(errors.change)} helperText={errors.change || 'e.g. 25 to add, -3 to remove'} />
          <TextField label="Reason" value={note} onChange={(e) => updateNote(e.target.value)} error={Boolean(errors.note)} helperText={errors.note} inputProps={{ maxLength: 255 }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={busy || hasErrors(errors) || Boolean(apiError)}>{busy ? 'Saving...' : 'Apply'}</Button>
      </DialogActions>
    </Dialog>
  );
}

function StockTab() {
  const { isManager } = useAuth();
  const [lowOnly, setLowOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState(10);
  const [adjusting, setAdjusting] = useState(null);
  const { data, loading, error, reload } = useFetch(
    () => productsApi.list({ low_stock: lowOnly || undefined, page: page + 1, page_size: rows }), [lowOnly, page, rows]);

  return (
    <>
      <FormControlLabel sx={{ mb: 1 }} control={<Switch checked={lowOnly} onChange={(e) => { setLowOnly(e.target.checked); setPage(0); }} />} label="Low stock only" />
      <ErrorAlert message={error} onRetry={reload} sx={{ mb: 2 }} />
      {loading && !data ? <Loader variant="table" /> : (
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow><TableCell>SKU</TableCell><TableCell>Product</TableCell><TableCell align="right">On hand</TableCell><TableCell align="right">Reserved</TableCell><TableCell align="right">Available</TableCell><TableCell align="right">Reorder level</TableCell>{isManager && <TableCell align="right">Actions</TableCell>}</TableRow></TableHead>
            <TableBody>
              {data?.items.length === 0 && <TableRow><TableCell colSpan={7} align="center">No products</TableCell></TableRow>}
              {data?.items.map((p) => {
                const low = p.available_quantity <= p.reorder_level;
                return (
                  <TableRow key={p.id} hover>
                    <TableCell>{p.sku}</TableCell><TableCell>{p.name}</TableCell>
                    <TableCell align="right">{p.stock_quantity}</TableCell><TableCell align="right">{p.reserved_quantity}</TableCell>
                    <TableCell align="right"><Chip size="small" label={p.available_quantity} color={low ? 'error' : 'default'} variant={low ? 'filled' : 'outlined'} /></TableCell>
                    <TableCell align="right">{p.reorder_level}</TableCell>
                    {isManager && <TableCell align="right"><Button size="small" disabled={loading || Boolean(error)} onClick={() => setAdjusting(p)}>Adjust</Button></TableCell>}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <TablePagination component="div" count={data?.total || 0} page={page} rowsPerPage={rows} rowsPerPageOptions={[10, 25, 50]}
        onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setRows(Number(e.target.value)); setPage(0); }} />
      {adjusting && <AdjustDialog product={adjusting} onClose={() => setAdjusting(null)} onSaved={() => { setAdjusting(null); reload(); }} />}
    </>
  );
}

function TransactionsTab() {
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState(10);
  const { data, loading, error, reload } = useFetch(() => inventoryApi.transactions({ page: page + 1, page_size: rows }), [page, rows]);

  return (
    <>
      <ErrorAlert message={error} onRetry={reload} sx={{ mb: 2 }} />
      {loading && !data ? <Loader variant="table" /> : (
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow><TableCell>When</TableCell><TableCell>Product</TableCell><TableCell>Type</TableCell><TableCell align="right">Change</TableCell><TableCell align="right">Balance</TableCell><TableCell>Note</TableCell><TableCell>By</TableCell></TableRow></TableHead>
            <TableBody>
              {data?.items.length === 0 && <TableRow><TableCell colSpan={7} align="center">No transactions</TableCell></TableRow>}
              {data?.items.map((t) => (
                <TableRow key={t.id} hover>
                  <TableCell>{formatDateTime(t.created_at)}</TableCell><TableCell>{t.product.name}</TableCell>
                  <TableCell><Chip size="small" variant="outlined" label={t.txn_type} /></TableCell>
                  <TableCell align="right" sx={{ color: t.quantity_change < 0 ? 'error.main' : 'success.main' }}>{t.quantity_change > 0 ? `+${t.quantity_change}` : t.quantity_change}</TableCell>
                  <TableCell align="right">{t.balance_after}</TableCell><TableCell>{t.note || '-'}</TableCell><TableCell>{t.creator?.name || 'System'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <TablePagination component="div" count={data?.total || 0} page={page} rowsPerPage={rows} rowsPerPageOptions={[10, 25, 50]}
        onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setRows(Number(e.target.value)); setPage(0); }} />
    </>
  );
}

export default function Inventory() {
  const [tab, setTab] = useState('stock');
  return (
    <>
      <PageHeader title="Inventory" subtitle="Stock levels and the full movement ledger" />
      <Paper sx={{ p: { xs: 1, sm: 2 } }}>
        <Tabs value={tab} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab value="stock" label="Stock levels" /><Tab value="ledger" label="Transactions" />
        </Tabs>
        <Box>{tab === 'stock' ? <StockTab /> : <TransactionsTab />}</Box>
      </Paper>
    </>
  );
}
