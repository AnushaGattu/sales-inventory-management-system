import { useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Box, Button, IconButton, InputAdornment, MenuItem, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TablePagination, TableRow, TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ClearIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import { ordersApi } from '../api/endpoints';
import useFetch from '../hooks/useFetch';
import useDebounce from '../hooks/useDebounce';
import PageHeader from '../components/PageHeader';
import Loader from '../components/Loader';
import ErrorAlert from '../components/ErrorAlert';
import StatusChip from '../components/StatusChip';
import { formatCurrency, formatDateTime } from '../utils/format';

const STATUSES = ['PENDING_APPROVAL', 'COMPLETED', 'REJECTED', 'CANCELLED'];

export default function Orders() {
  // The status filter lives in the URL (?status=...) so it is shareable and survives refresh / back button.
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState(10);
  const q = useDebounce(search);

  const { data, loading, error, reload } = useFetch(
    () => ordersApi.list({ q: q || undefined, status: status || undefined, page: page + 1, page_size: rows }),
    [q, status, page, rows],
  );

  return (
    <>
      <PageHeader title="Sales Orders" subtitle="Create, track and follow up orders"
        actions={<Button component={RouterLink} to="/orders/new" variant="contained" startIcon={<AddIcon />} disabled={loading || Boolean(error)}>New order</Button>} />
      <Paper sx={{ p: { xs: 1, sm: 2 } }}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <TextField sx={{ maxWidth: 320 }} placeholder="Search order no. or customer" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
              endAdornment: search && (
                <InputAdornment position="end">
                  <IconButton aria-label="Clear search" edge="end" size="small" onClick={() => { setSearch(''); setPage(0); }}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }} />
          <TextField select label="Status" value={status} sx={{ maxWidth: 220 }}
            onChange={(e) => { const next = new URLSearchParams(params); if (e.target.value) next.set('status', e.target.value); else next.delete('status'); setParams(next); setPage(0); }}>
            <MenuItem value="">All</MenuItem>
            {STATUSES.map((s) => <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>)}
          </TextField>
        </Box>
        <ErrorAlert message={error} onRetry={reload} sx={{ mb: 2 }} />
        {loading && !data ? <Loader variant="table" /> : (
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow><TableCell>Order</TableCell><TableCell>Customer</TableCell><TableCell>Created by</TableCell><TableCell>Date</TableCell><TableCell align="right">Total</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
              <TableBody>
                {data?.items.length === 0 && <TableRow><TableCell colSpan={6} align="center">No orders found</TableCell></TableRow>}
                {data?.items.map((o) => (
                  <TableRow key={o.id} hover>
                    <TableCell><Button component={RouterLink} to={`/orders/${o.id}`} size="small">{o.order_number}</Button></TableCell>
                    <TableCell>{o.customer.name}</TableCell><TableCell>{o.creator.name}</TableCell>
                    <TableCell>{formatDateTime(o.created_at)}</TableCell>
                    <TableCell align="right">{formatCurrency(o.total_amount)}</TableCell>
                    <TableCell><StatusChip status={o.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <TablePagination component="div" count={data?.total || 0} page={page} rowsPerPage={rows} rowsPerPageOptions={[10, 25, 50]}
          onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setRows(Number(e.target.value)); setPage(0); }} />
      </Paper>
    </>
  );
}
