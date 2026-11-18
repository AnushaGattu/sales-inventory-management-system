import { createBrowserRouter, Outlet } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import RequireAuth from '../components/RequireAuth';
import RouteError from '../components/RouteError';
import { MANAGER_ROLES } from '../context/AuthContext';

// React Router "data router" API (createBrowserRouter + RouterProvider) with route-level code splitting:
// each page module is downloaded only when its route is first visited.
const page = (importer) => async () => ({ Component: (await importer()).default });

export const router = createBrowserRouter([
  { path: '/login', lazy: page(() => import('../pages/Login')), errorElement: <RouteError /> },
  {
    path: '/',
    element: <RequireAuth><AppLayout /></RequireAuth>,
    errorElement: <RouteError />,
    children: [
      { index: true, lazy: page(() => import('../pages/Dashboard')) },
      { path: 'products', lazy: page(() => import('../pages/Products')) },
      { path: 'customers', lazy: page(() => import('../pages/Customers')) },
      {
        path: 'orders',
        children: [
          { index: true, lazy: page(() => import('../pages/Orders')) },
          { path: 'new', lazy: page(() => import('../pages/OrderCreate')) },
          { path: ':orderId', lazy: page(() => import('../pages/OrderDetail')) },
        ],
      },
      {
        path: 'approvals',
        element: <RequireAuth roles={MANAGER_ROLES}><Outlet /></RequireAuth>,
        children: [{ index: true, lazy: page(() => import('../pages/Approvals')) }],
      },
      { path: 'inventory', lazy: page(() => import('../pages/Inventory')) },
      { path: '*', lazy: page(() => import('../pages/NotFound')) },
    ],
  },
  { path: '*', lazy: page(() => import('../pages/NotFound')) },
]);
