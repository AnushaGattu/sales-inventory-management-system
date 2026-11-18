import { Box, Grid2 as Grid, Paper, Skeleton, Stack } from '@mui/material';

type LoaderVariant = 'page' | 'table' | 'dashboard' | 'form' | 'detail';
type LoaderProps = { variant?: LoaderVariant };

function PageTitle() {
  return (
    <Box sx={{ mb: 2 }}>
      <Skeleton variant="text" width={220} height={42} animation={false} />
      <Skeleton variant="text" width={300} height={24} animation={false} />
    </Box>
  );
}

function TableSkeleton() {
  return (
    <Paper sx={{ p: 2 }}>
      <Skeleton variant="rounded" width="min(320px, 100%)" height={40} animation={false} sx={{ mb: 2 }} />
      <Stack spacing={1.5}>
        <Skeleton variant="rounded" height={38} animation={false} />
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} variant="rounded" height={32} animation={false} />
        ))}
      </Stack>
    </Paper>
  );
}

export default function Loader({ variant = 'page' }: LoaderProps) {
  if (variant === 'table') return <TableSkeleton />;

  if (variant === 'dashboard') {
    return (
      <>
        <PageTitle />
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {Array.from({ length: 7 }, (_, index) => (
            <Grid key={index} size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper sx={{ p: 2 }}>
                <Skeleton variant="text" width="65%" animation={false} />
                <Skeleton variant="text" width="45%" height={38} animation={false} />
              </Paper>
            </Grid>
          ))}
        </Grid>
        <Grid container spacing={2}>
          {[0, 1].map((index) => (
            <Grid key={index} size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 2 }}>
                <Skeleton variant="text" width="50%" height={32} animation={false} />
                <Skeleton variant="rounded" height={180} animation={false} />
              </Paper>
            </Grid>
          ))}
        </Grid>
      </>
    );
  }

  if (variant === 'form') {
    return (
      <>
        <PageTitle />
        <Paper sx={{ p: 3 }}>
          <Stack spacing={3}>
            <Skeleton variant="rounded" height={48} animation={false} />
            <Skeleton variant="rounded" height={170} animation={false} />
            <Skeleton variant="rounded" height={48} animation={false} />
            <Skeleton variant="rounded" width={150} height={40} animation={false} sx={{ alignSelf: 'flex-end' }} />
          </Stack>
        </Paper>
      </>
    );
  }

  if (variant === 'detail') {
    return (
      <>
        <PageTitle />
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {[0, 1].map((index) => (
            <Grid key={index} size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 3 }}>
                <Skeleton variant="text" width="40%" height={32} animation={false} />
                {Array.from({ length: 4 }, (_, row) => (
                  <Skeleton key={row} variant="text" height={34} animation={false} />
                ))}
              </Paper>
            </Grid>
          ))}
        </Grid>
        <TableSkeleton />
      </>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Skeleton variant="text" width={220} height={42} animation={false} />
      <Skeleton variant="rounded" height={180} animation={false} />
    </Box>
  );
}
