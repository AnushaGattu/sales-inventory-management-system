import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';

type PageHeaderProps = { title: string; subtitle?: string; actions?: ReactNode };

export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 3 }}>
      <Box sx={{ minWidth: 0, flex: '1 1 220px' }}>
        <Typography variant="h4" component="h1" sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' }, overflowWrap: 'anywhere' }}>{title}</Typography>
        {subtitle && <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{subtitle}</Typography>}
      </Box>
      {actions && <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', flexDirection: { xs: 'column', sm: 'row' }, width: { xs: '100%', sm: 'auto' }, '& > *': { maxWidth: '100%' }, '& .MuiButton-root': { width: { xs: '100%', sm: 'auto' } } }}>{actions}</Box>}
    </Box>
  );
}
