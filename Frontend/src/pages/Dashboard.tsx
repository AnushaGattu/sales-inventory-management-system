import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Card, CardActionArea, CardContent, Chip, Grid2 as Grid, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography,
} from '@mui/material';
import { dashboardApi } from '../api/endpoints';
import useFetch from '../hooks/useFetch';
import PageHeader from '../components/PageHeader';
import Loader from '../components/Loader';
import ErrorAlert from '../components/ErrorAlert';
import StatusChip from '../components/StatusChip';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, formatNumber } from '../utils/format';

type StatCardProps = { label: string; value: string; to?: string; color?: string };

function StatCard({ label, value, to, color }: StatCardProps) {
  const body = (
    <CardContent>
      <Typography color="text.secondary" variant="body2">{label}</Typography>
      <Typography variant="h5" sx={{ fontWeight: 600, color }}>{value}</Typography>
    </CardContent>
  );
  return (
    <Card>{to ? <CardActionArea component={RouterLink} to={to}>{body}</CardActionArea> : body}</Card>
  );
}

export default function Dashboard() {
  const { user, isManager } = useAuth();
  const { data, loading, error, reload } = useFetch(() => dashboardApi.summary());

  if (loading && !data) return <Loader variant="dashboard" />;
  if (error && !data) return <ErrorAlert message={error} onRetry={reload} />;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={data.scope === 'own' ? `Your sales activity, ${user.name}` : 'Company-wide sales, orders, approvals and inventory'}
      />
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><StatCard label="Revenue (completed orders)" value={formatCurrency(data.total_revenue)} /></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><StatCard label="Total orders" value={formatNumber(data.total_orders)} to="/orders" /></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="Pending approvals" value={formatNumber(data.pending_approvals)} to={isManager ? '/approvals' : '/orders?status=PENDING_APPROVAL'} color={data.pending_approvals ? 'warning.main' : undefined} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><StatCard label="Low-stock products" value={formatNumber(data.low_stock_count)} to="/inventory" color={data.low_stock_count ? 'error.main' : undefined} /></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><StatCard label="Inventory value" value={formatCurrency(data.inventory_value)} /></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><StatCard label="Active products" value={formatNumber(data.active_products)} to="/products" /></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><StatCard label="Active customers" value={formatNumber(data.active_customers)} to="/customers" /></Grid>
      </Grid>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Orders by status</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {Object.entries(data.orders_by_status as Record<string, number>).map(([status, count]) => (
            <Box key={status} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StatusChip status={status} /> <Chip size="small" label={count} />
            </Box>
          ))}
        </Box>
      </Paper>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Sales - last 7 days</Typography>
            <TableContainer>
              <Table size="small" sx={{ minWidth: 440 }}>
                <TableHead><TableRow><TableCell>Date</TableCell><TableCell align="right">Orders</TableCell><TableCell align="right">Revenue</TableCell></TableRow></TableHead>
                <TableBody>
                  {data.sales_last_7_days.map((d) => (
                    <TableRow key={d.date}><TableCell>{formatDate(d.date)}</TableCell><TableCell align="right">{d.orders}</TableCell><TableCell align="right">{formatCurrency(d.revenue)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Top selling products</Typography>
            <TableContainer>
              <Table size="small" sx={{ minWidth: 440 }}>
                <TableHead><TableRow><TableCell>Product</TableCell><TableCell align="right">Units</TableCell><TableCell align="right">Revenue</TableCell></TableRow></TableHead>
                <TableBody>
                  {data.top_products.length === 0 && <TableRow><TableCell colSpan={3} align="center">No completed sales yet</TableCell></TableRow>}
                  {data.top_products.map((p) => (
                    <TableRow key={p.product_id}><TableCell>{p.name} <Typography component="span" variant="caption" color="text.secondary">({p.sku})</Typography></TableCell><TableCell align="right">{p.quantity_sold}</TableCell><TableCell align="right">{formatCurrency(p.revenue)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </>
  );
}
