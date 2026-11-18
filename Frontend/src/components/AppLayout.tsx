import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  AppBar, Box, Button, Chip, Divider, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText,
  Toolbar, Typography, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import PeopleIcon from '@mui/icons-material/People';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../context/AuthContext';

const DRAWER_WIDTH = 240;

const NAV = [
  { to: '/', label: 'Dashboard', icon: <DashboardIcon />, end: true },
  { to: '/orders', label: 'Sales Orders', icon: <ReceiptLongIcon /> },
  { to: '/approvals', label: 'Approvals', icon: <FactCheckIcon />, managerOnly: true },
  { to: '/products', label: 'Products', icon: <Inventory2Icon /> },
  { to: '/customers', label: 'Customers', icon: <PeopleIcon /> },
  { to: '/inventory', label: 'Inventory', icon: <WarehouseIcon /> },
];

export default function AppLayout() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [open, setOpen] = useState(false);
  const { user, logout, isManager } = useAuth();
  const navigate = useNavigate();

  const items = NAV.filter((n) => !n.managerOnly || isManager);

  const drawer = (
    <Box>
      <Toolbar><Typography variant="h6" noWrap>Sales &amp; Inventory</Typography></Toolbar>
      <Divider />
      <List>
        {items.map((n) => (
          <ListItemButton
            key={n.to} component={NavLink} to={n.to} end={n.end} onClick={() => setOpen(false)}
            sx={{ '&.active': { bgcolor: 'primary.main', color: 'primary.contrastText', '& .MuiListItemIcon-root': { color: 'inherit' } } }}
          >
            <ListItemIcon>{n.icon}</ListItemIcon>
            <ListItemText primary={n.label} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" sx={{ ml: { md: `${DRAWER_WIDTH}px` }, width: { md: `calc(100% - ${DRAWER_WIDTH}px)` }, bgcolor: 'background.paper', color: 'text.primary' }} elevation={1}>
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 }, px: { xs: 1, sm: 2 } }}>
          {!isDesktop && <IconButton edge="start" onClick={() => setOpen(true)} sx={{ mr: 1 }} aria-label="open menu"><MenuIcon /></IconButton>}
          <Box sx={{ flexGrow: 1 }} />
          <Typography noWrap sx={{ mr: 1, maxWidth: { xs: 96, sm: 'none' }, fontSize: { xs: '0.875rem', sm: '1rem' } }}>{user?.name}</Typography>
          <Chip size="small" label={user?.role} color="primary" variant="outlined" sx={{ mr: { xs: 0.5, sm: 2 }, display: { xs: 'none', sm: 'inline-flex' } }} />
          <Button color="inherit" size={isSmallScreen ? 'small' : 'medium'} startIcon={<LogoutIcon />} onClick={() => { logout(); navigate('/login', { replace: true }); }}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={isDesktop ? 'permanent' : 'temporary'} open={isDesktop || open} onClose={() => setOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, width: { md: `calc(100% - ${DRAWER_WIDTH}px)` }, minWidth: 0 }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
