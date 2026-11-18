import { Alert, Button } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

type ErrorAlertProps = { message?: string | null; onRetry?: () => void; sx?: SxProps<Theme> };

export default function ErrorAlert({ message, onRetry, sx }: ErrorAlertProps) {
  if (!message) return null;
  return (
    <Alert severity="error" sx={sx} action={onRetry && <Button color="inherit" size="small" onClick={onRetry}>Retry</Button>}>
      {message}
    </Alert>
  );
}
