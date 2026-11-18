import { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Divider, Grid2 as Grid, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { ordersApi } from '../api/endpoints';
import useFetch from '../hooks/useFetch';
import PageHeader from '../components/PageHeader';
import Loader from '../components/Loader';
import ErrorAlert from '../components/ErrorAlert';
import StatusChip from '../components/StatusChip';
import ConfirmDialog from '../components/ConfirmDialog';
import DecisionDialog from '../components/DecisionDialog';
import { useAuth } from '../context/AuthContext';
import { useNotify } from '../context/NotificationContext';
import { getErrorMessage } from '../utils/errors';
import { formatCurrency, formatDateTime } from '../utils/format';

function Field({ label, children }) {
  return (<Box sx={{ mb: 1.5 }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography>{children || '-'}</Typography></Box>);
}

export default function OrderDetail() {
  const { orderId } = useParams();
  const { user, isManager } = useAuth();
  const notify = useNotify();
  const { data: order, loading, error, reload } = useFetch(() => ordersApi.get(orderId), [orderId]);
  const [decision, setDecision] = useState(null);   // 'approve' | 'reject' | null
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cancelError, setCancelError] = useState('');

  if (loading && !order) return <Loader variant="detail" />;
  if (error && !order) return (<><ErrorAlert message={error} onRetry={reload} /><Button component={RouterLink} to="/orders" sx={{ mt: 2 }}>Back to orders</Button></>);

  const pending = order.status === 'PENDING_APPROVAL';
  const isOwn = order.creator.id === user.id;
  const canDecide = pending && isManager && !isOwn;
  const canCancel = pending && (isOwn || isManager);

  const cancel = async () => {
    setBusy(true);
    setCancelError('');
    try {
      await ordersApi.cancel(order.id);
      notify.success('Order cancelled');
      setConfirmCancel(false);
      reload();
    } catch (e) {
      setCancelError(getErrorMessage(e));
    } finally { setBusy(false); }
  };

  const closeCancelDialog = () => {
    if (busy) return;
    setConfirmCancel(false);
    setCancelError('');
  };

  return (
    <>
      <PageHeader
        title={order.order_number}
        subtitle={`Created ${formatDateTime(order.created_at)} by ${order.creator.name}`}
        actions={<>
          <Button component={RouterLink} to="/orders" startIcon={<ArrowBackIcon />}>Orders</Button>
          {canCancel && <Button color="error" variant="outlined" disabled={loading || Boolean(error) || busy || confirmCancel} onClick={() => { setCancelError(''); setConfirmCancel(true); }}>Cancel order</Button>}
          {canDecide && <Button color="error" variant="contained" disabled={loading || Boolean(error) || busy} onClick={() => setDecision('reject')}>Reject</Button>}
          {canDecide && <Button color="success" variant="contained" disabled={loading || Boolean(error) || busy} onClick={() => setDecision('approve')}>Approve</Button>}
        </>}
      />
      {pending && isManager && isOwn && <Alert severity="info" sx={{ mb: 2 }}>You created this order, so another manager must approve it.</Alert>}
      {pending && !isManager && <Alert severity="warning" sx={{ mb: 2 }}>Waiting for manager approval. Stock is reserved for this order.</Alert>}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>Order</Typography>
            <Field label="Status"><StatusChip status={order.status} /></Field>
            <Field label="Customer">{order.customer.name}</Field>
            <Field label="Total">{formatCurrency(order.total_amount)}</Field>
            <Field label="Completed at">{order.completed_at && formatDateTime(order.completed_at)}</Field>
            <Field label="Notes">{order.notes}</Field>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>Approval</Typography>
            {!order.approval ? <Typography color="text.secondary">Not required - the order was below the approval limit.</Typography> : (
              <>
                <Field label="Decision"><StatusChip status={order.approval.status} /></Field>
                <Field label="Requested">{formatDateTime(order.approval.requested_at)}</Field>
                <Field label="Decided by">{order.approval.decider?.name}</Field>
                <Field label="Decided at">{order.approval.decided_at && formatDateTime(order.approval.decided_at)}</Field>
                <Field label="Comments">{order.approval.comments}</Field>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: { xs: 1, sm: 2 } }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Items</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow><TableCell>SKU</TableCell><TableCell>Product</TableCell><TableCell align="right">Unit price</TableCell><TableCell align="right">Qty</TableCell><TableCell align="right">Line total</TableCell></TableRow></TableHead>
            <TableBody>
              {order.items.map((i) => (
                <TableRow key={i.id}><TableCell>{i.product.sku}</TableCell><TableCell>{i.product.name}</TableCell><TableCell align="right">{formatCurrency(i.unit_price)}</TableCell><TableCell align="right">{i.quantity}</TableCell><TableCell align="right">{formatCurrency(i.line_total)}</TableCell></TableRow>
              ))}
              <TableRow><TableCell colSpan={4} align="right"><strong>Total</strong></TableCell><TableCell align="right"><strong>{formatCurrency(order.total_amount)}</strong></TableCell></TableRow>
            </TableBody>
          </Table>
        </TableContainer>
        <Divider sx={{ mt: 1 }} />
      </Paper>

      {decision && (
        <DecisionDialog open mode={decision} approvalId={order.approval.id} order={order} onClose={() => setDecision(null)}
          onDone={(_, mode) => { setDecision(null); notify.success(mode === 'approve' ? 'Order approved and completed' : 'Order rejected'); reload(); }} />
      )}
      <ConfirmDialog open={confirmCancel} title="Cancel order" confirmLabel="Cancel order" busy={busy}
        message="Reserved stock will be released. This cannot be undone." error={cancelError} onConfirm={cancel} onClose={closeCancelDialog} />
    </>
  );
}
