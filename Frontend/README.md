# Frontend - Sales & Inventory UI (React + TypeScript + Material UI)

## Run
```bash
npm install
npm run dev               # http://localhost:5173
npm run build             # production build in dist/
npm run typecheck         # TypeScript check
```
The backend must be running (see `../Backend/README.md`). Sign in with a seeded user, e.g. `manager@example.com / Manager@123`.

## Stack
React 18 - TypeScript - Vite 6 - **Material UI 6** (+ icons) - **React Router 7 data router** (`createBrowserRouter`, nested routes,
lazy route modules) - Axios. No animation libraries; MUI motion is switched off in the theme.

## Folder layout
```
src/
  main.tsx, App.tsx        bootstrap + providers (Theme, Notification, Auth, Router)
  routes/index.tsx         the whole route table (guards, nesting, lazy loading)
  theme/theme.ts           MUI theme, animations disabled
  api/client.ts            axios instance + JWT & 401 interceptors
  api/endpoints.ts         one function per backend endpoint
  context/                 AuthContext (session, role helpers, settings), NotificationContext (snackbar)
  components/              AppLayout (sidebar/app bar), RequireAuth, DecisionDialog, StatusChip, ConfirmDialog, ...
  hooks/                   useFetch (data loading), useDebounce (search)
  pages/                   Login, Dashboard, Products, Customers, Orders, OrderCreate, OrderDetail, Approvals, Inventory, NotFound
  utils/                   format.ts, validators.ts, errors.ts
tsconfig.json              TypeScript compiler configuration
vite.config.ts             Vite + React plugin configuration
```

## Screens
| Route | Who | Purpose |
|-------|-----|---------|
| `/login` | public | Sign in |
| `/` | all | Dashboard: revenue, orders by status, pending approvals, low stock, 7-day sales, top products |
| `/products`, `/customers` | all (write: manager for products) | Searchable, paginated tables with create/edit dialogs |
| `/orders`, `/orders/new`, `/orders/:orderId` | all | List with filters (status in URL), order form with live total + approval notice, detail |
| `/approvals` | manager | Tabs by status; approve / reject dialogs |
| `/inventory` | all (adjust: manager) | Stock levels, low-stock filter, adjustment dialog, movement ledger |
