import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Button, Paper, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, Tabs,
} from '@mui/material';
import { approvalsApi } from '../api/endpoints';
import useFetch from '../hooks/useFetch';
import PageHeader from '../components/PageHeader';
import Loader from '../components/Loader';
import ErrorAlert from '../components/ErrorAlert';
import StatusChip from '../components/StatusChip';
import DecisionDialog from '../components/DecisionDialog';
import { useAuth } from '../context/AuthContext';
import { useNotify } from '../context/NotificationContext';
import { formatCurrency, formatDateTime } from '../utils/format';

const TABS = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

export default function Approvals() {
  const { user } = useAuth();
  const notify = useNotify();
  const [tab, setTab] = useState('PENDING');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState(10);
  const [active, setActive] = useState(null);  // { approval, mode }

  const { data, loading, error, reload } = useFetch(
    () => approvalsApi.list({ status: tab, page: page + 1, page_size: rows }), [tab, page, rows]);

  return (
    <>
      <PageHeader title="Approvals" subtitle="Orders above the approval limit wait here for a manager decision" />
      <Paper sx={{ p: { xs: 1, sm: 2 } }}>
        <Tabs value={tab} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile onChange={(_, v) => { setTab(v); setPage(0); }} sx={{ mb: 2 }}>
          {TABS.map((t) => <Tab key={t} value={t} label={t.charAt(0) + t.slice(1).toLowerCase()} />)}
        </Tabs>
        <ErrorAlert message={error} onRetry={reload} sx={{ mb: 2 }} />
        {loading && !data ? <Loader variant="table" /> : (
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow><TableCell>Order</TableCell><TableCell>Customer</TableCell><TableCell>Requested by</TableCell><TableCell>Requested</TableCell><TableCell align="right">Amount</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
              <TableBody>
                {data?.items.length === 0 && <TableRow><TableCell colSpan={7} align="center">Nothing here</TableCell></TableRow>}
                {data?.items.map((a) => {
                  const own = a.order.creator.id === user.id;
                  return (
                    <TableRow key={a.id} hover>
                      <TableCell><Button component={RouterLink} to={`/orders/${a.order.id}`} size="small">{a.order.order_number}</Button></TableCell>
                      <TableCell>{a.order.customer.name}</TableCell><TableCell>{a.requester.name}</TableCell>
                      <TableCell>{formatDateTime(a.requested_at)}</TableCell>
                      <TableCell align="right">{formatCurrency(a.order.total_amount)}</TableCell>
                      <TableCell><StatusChip status={a.status} /></TableCell>
                      <TableCell align="right">
                        {a.status === 'PENDING' && (own ? 'Your own order' : (
                          <>
                            <Button size="small" color="error" disabled={loading || Boolean(error)} onClick={() => setActive({ approval: a, mode: 'reject' })}>Reject</Button>
                            <Button size="small" color="success" variant="contained" sx={{ ml: 1 }} disabled={loading || Boolean(error)} onClick={() => setActive({ approval: a, mode: 'approve' })}>Approve</Button>
                          </>
                        ))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <TablePagination component="div" count={data?.total || 0} page={page} rowsPerPage={rows} rowsPerPageOptions={[10, 25, 50]}
          onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setRows(Number(e.target.value)); setPage(0); }} />
      </Paper>
      {active && (
        <DecisionDialog open mode={active.mode} approvalId={active.approval.id} order={active.approval.order} onClose={() => setActive(null)}
          onDone={(_, mode) => { setActive(null); notify.success(mode === 'approve' ? 'Order approved and completed' : 'Order rejected'); reload(); }} />
      )}
    </>
  );
}
