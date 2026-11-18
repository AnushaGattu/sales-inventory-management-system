import { useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Alert, Autocomplete, Box, Button, IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { customersApi, ordersApi, productsApi } from '../api/endpoints';
import useFetch from '../hooks/useFetch';
import PageHeader from '../components/PageHeader';
import Loader from '../components/Loader';
import ErrorAlert from '../components/ErrorAlert';
import { useAuth } from '../context/AuthContext';
import { useNotify } from '../context/NotificationContext';
import { getErrorList, getErrorMessage } from '../utils/errors';
import { formatCurrency } from '../utils/format';

let lineSeq = 0; // simple unique keys (crypto.randomUUID needs a secure context)
type CustomerOption = { id: number; name: string };
type ProductOption = { id: number; sku: string; name: string; price: number | string; available_quantity: number };
type OrderLine = { key: number; product: ProductOption | null; quantity: string };
type FormErrors = { customer?: string; lines: Record<number, string>; general?: string };
type ApiError = { message: string; list: string[] };
const newLine = (): OrderLine => ({ key: ++lineSeq, product: null, quantity: '1' });
const emptyApiError: ApiError = { message: '', list: [] };

function getFormErrors(customer: CustomerOption | null, lines: OrderLine[]): FormErrors {
  const errors: FormErrors = { lines: {} };
  if (!customer) errors.customer = 'Select a customer';
  lines.forEach((line) => {
    const quantity = Number(line.quantity);
    if (!line.product) errors.lines[line.key] = 'Select a product';
    else if (!Number.isInteger(quantity) || quantity < 1) errors.lines[line.key] = 'Quantity must be a whole number of 1 or more';
    else if (quantity > line.product.available_quantity) errors.lines[line.key] = `Only ${line.product.available_quantity} available`;
  });
  return errors;
}

const hasFormErrors = (errors: FormErrors) =>
  Boolean(errors.customer || errors.general || Object.values(errors.lines).some(Boolean));

export default function OrderCreate() {
  const navigate = useNavigate();
  const notify = useNotify();
  const { settings } = useAuth();
  const customers = useFetch(() => customersApi.list({ page_size: 100 }));
  const products = useFetch(() => productsApi.list({ page_size: 100 }));

  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [lines, setLines] = useState([newLine()]);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({ lines: {} });
  const [apiError, setApiError] = useState<ApiError>(emptyApiError);
  const [busy, setBusy] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);

  const total = useMemo(
    () => lines.reduce((sum, l) => sum + (l.product ? Number(l.product.price) * (Number(l.quantity) || 0) : 0), 0), [lines]);
  const needsApproval = total > Number(settings.approval_threshold);

  const updateCustomer = (value: CustomerOption | null) => {
    setCustomer(value);
    if (validationAttempted) setErrors(getFormErrors(value, lines));
    setApiError(emptyApiError);
  };
  const update = (key: number, patch: Partial<OrderLine>) => {
    const next = lines.map((line) => (line.key === key ? { ...line, ...patch } : line));
    setLines(next);
    if (validationAttempted) setErrors(getFormErrors(customer, next));
    setApiError(emptyApiError);
  };
  const changeLines = (makeNext: (current: OrderLine[]) => OrderLine[]) => {
    const next = makeNext(lines);
    setLines(next);
    if (validationAttempted) setErrors(getFormErrors(customer, next));
    setApiError(emptyApiError);
  };
  const updateNotes = (value: string) => { setNotes(value); setApiError(emptyApiError); };
  const chosenIds = new Set(lines.map((l) => l.product?.id).filter(Boolean));

  const validate = () => {
    setValidationAttempted(true);
    const nextErrors = getFormErrors(customer, lines);
    setErrors(nextErrors);
    return !hasFormErrors(nextErrors);
  };

  const submit = async () => {
    if (!validate()) return;
    setBusy(true); setApiError(emptyApiError);
    try {
      const order = await ordersApi.create({
        customer_id: customer.id, notes: notes.trim() || null,
        items: lines.map((l) => ({ product_id: l.product.id, quantity: Number(l.quantity) })),
      });
      notify.success(order.status === 'PENDING_APPROVAL'
        ? `Order ${order.order_number} sent to a manager for approval`
        : `Order ${order.order_number} completed`);
      navigate(`/orders/${order.id}`);
    } catch (e) {
      setApiError({ message: getErrorMessage(e), list: getErrorList(e) });
    } finally { setBusy(false); }
  };

  if ((customers.loading && !customers.data) || (products.loading && !products.data)) return <Loader variant="form" />;
  if (customers.error || products.error) return <ErrorAlert message={customers.error || products.error} onRetry={() => { customers.reload(); products.reload(); }} />;

  return (
    <>
      <PageHeader title="New sales order" subtitle="Stock is validated when you submit" />
      {apiError.message && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {apiError.message}
          {apiError.list.length > 0 && <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>{apiError.list.map((m) => <li key={m}>{m}</li>)}</ul>}
        </Alert>
      )}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Stack spacing={3}>
          <Autocomplete
            options={customers.data.items} value={customer} onChange={(_, v) => updateCustomer(v)}
            getOptionLabel={(c) => c.name} isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => <TextField {...params} label="Customer" error={Boolean(errors.customer)} helperText={errors.customer} />}
          />
          <TableContainer>
            <Table size="small" sx={{ minWidth: 680 }}>
              <TableHead><TableRow><TableCell sx={{ minWidth: 280 }}>Product</TableCell><TableCell align="right">Unit price</TableCell><TableCell sx={{ width: 140 }}>Quantity</TableCell><TableCell align="right">Line total</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={l.key}>
                    <TableCell>
                      <Autocomplete
                        options={products.data.items.filter((p) => !chosenIds.has(p.id) || p.id === l.product?.id)}
                        value={l.product} onChange={(_, v) => update(l.key, { product: v })}
                        getOptionLabel={(p) => `${p.name} (${p.sku})`} isOptionEqualToValue={(a, b) => a.id === b.id}
                        getOptionDisabled={(p) => p.available_quantity <= 0}
                        renderOption={(props, p) => <li {...props} key={p.id}>{p.name} ({p.sku}) - {p.available_quantity} available</li>}
                        renderInput={(params) => <TextField {...params} placeholder="Select product" error={Boolean(errors.lines?.[l.key])} helperText={errors.lines?.[l.key]} />}
                      />
                    </TableCell>
                    <TableCell align="right">{l.product ? formatCurrency(l.product.price) : '-'}</TableCell>
                    <TableCell><TextField type="number" value={l.quantity} onChange={(e) => update(l.key, { quantity: e.target.value })} inputProps={{ min: 1 }} /></TableCell>
                    <TableCell align="right">{l.product ? formatCurrency(Number(l.product.price) * (Number(l.quantity) || 0)) : '-'}</TableCell>
                    <TableCell><IconButton aria-label="remove line" disabled={lines.length === 1} onClick={() => changeLines((current) => current.filter((x) => x.key !== l.key))}><DeleteIcon /></IconButton></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box><Button startIcon={<AddIcon />} onClick={() => changeLines((current) => [...current, newLine()])}>Add item</Button></Box>
          <TextField label="Notes (optional)" value={notes} onChange={(e) => updateNotes(e.target.value)} multiline minRows={2} inputProps={{ maxLength: 500 }} />
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography color="text.secondary">Order total</Typography>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>{formatCurrency(total)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' }, width: { xs: '100%', sm: 'auto' } }}>
            <Button component={RouterLink} to="/orders" disabled={busy} fullWidth>Cancel</Button>
            <Button variant="contained" onClick={submit} disabled={busy || hasFormErrors(errors) || Boolean(apiError.message)} fullWidth>{busy ? 'Submitting...' : needsApproval ? 'Submit for approval' : 'Place order'}</Button>
          </Box>
        </Box>
        {needsApproval && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Orders above {formatCurrency(settings.approval_threshold)} need manager approval. Stock will be reserved and the order
            completed once a manager approves it.
          </Alert>
        )}
      </Paper>
    </>
  );
}
