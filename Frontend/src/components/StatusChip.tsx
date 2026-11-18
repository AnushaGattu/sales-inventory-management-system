import { Chip, type ChipProps } from '@mui/material';

const MAP: Record<string, { label: string; color: ChipProps['color'] }> = {
  COMPLETED: { label: 'Completed', color: 'success' },
  APPROVED: { label: 'Approved', color: 'success' },
  PENDING_APPROVAL: { label: 'Pending approval', color: 'warning' },
  PENDING: { label: 'Pending', color: 'warning' },
  REJECTED: { label: 'Rejected', color: 'error' },
  CANCELLED: { label: 'Cancelled', color: 'error' },
};

type StatusChipProps = { status: string; size?: ChipProps['size'] };

export default function StatusChip({ status, size = 'small' }: StatusChipProps) {
  const { label, color } = MAP[status] || { label: status, color: 'default' as const };
  return <Chip label={label} color={color} size={size} variant={color === 'default' ? 'outlined' : 'filled'} />;
}
