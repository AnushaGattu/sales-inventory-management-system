import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { approvalsApi } from '../api/endpoints';
import { getErrorMessage } from '../utils/errors';
import { formatCurrency } from '../utils/format';

/** Approve / reject dialog shared by the Approvals list and the Order detail page.
 *  `mode` is 'approve' | 'reject'; a reason is mandatory only when rejecting (the API enforces it too). */
export default function DecisionDialog({ open, mode, approvalId, order, onClose, onDone }) {
  const [comments, setComments] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const reject = mode === 'reject';

  const close = () => { setComments(''); setError(''); onClose(); };
  const updateComments = (value: string) => {
    setComments(value);
    if (error) {
      setError(reject && value.trim().length < 3 ? 'Please give a reason (at least 3 characters)' : '');
    }
  };

  const submit = async () => {
    if (reject && comments.trim().length < 3) { setError('Please give a reason (at least 3 characters)'); return; }
    setBusy(true); setError('');
    try {
      const updated = reject
        ? await approvalsApi.reject(approvalId, comments.trim())
        : await approvalsApi.approve(approvalId, comments.trim() || null);
      setComments('');
      onDone(updated, mode);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : close} maxWidth="sm" fullWidth>
      <DialogTitle>{reject ? 'Reject order' : 'Approve order'} {order?.order_number}</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }} color="text.secondary">
          {order?.customer?.name} - {formatCurrency(order?.total_amount)}.{' '}
          {reject ? 'Reserved stock will be released.' : 'Stock will be deducted and the order completed.'}
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField
          label={reject ? 'Reason (required)' : 'Comments (optional)'} value={comments}
          onChange={(e) => updateComments(e.target.value)} multiline minRows={3} inputProps={{ maxLength: 500 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={busy}>Cancel</Button>
        <Button onClick={submit} disabled={busy || Boolean(error)} variant="contained" color={reject ? 'error' : 'success'}>
          {reject ? 'Reject' : 'Approve'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
