import { isRouteErrorResponse, Link as RouterLink, useRouteError } from 'react-router-dom';
import { Alert, Box, Button } from '@mui/material';

// Rendered by React Router when a route throws (e.g. a lazy chunk fails to load).
export default function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error ? error.message : 'Unexpected error';
  return (
    <Box sx={{ p: 4, maxWidth: 600, mx: 'auto' }}>
      <Alert severity="error" action={<Button component={RouterLink} to="/" color="inherit" size="small">Home</Button>}>
        Something went wrong: {message}
      </Alert>
    </Box>
  );
}
