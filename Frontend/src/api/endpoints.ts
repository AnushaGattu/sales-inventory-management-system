// One thin function per backend endpoint. Components never build URLs themselves.
import client, { TOKEN_KEY } from './client';

const data = (promise) => promise.then((r) => r.data);

export const authApi = {
  login: (email, password) =>
    data(client.post('/auth/login', new URLSearchParams({ username: email, password }))),
  me: () => data(client.get('/auth/me')),
  settings: () => data(client.get('/meta/settings')),
};

export const productsApi = {
  list: (params) => data(client.get('/products', { params })),
  create: (body) => data(client.post('/products', body)),
  update: (id, body) => data(client.put(`/products/${id}`, body)),
  deactivate: (id) => data(client.delete(`/products/${id}`)),
};

export const customersApi = {
  list: (params) => data(client.get('/customers', { params })),
  create: (body) => data(client.post('/customers', body)),
  update: (id, body) => data(client.put(`/customers/${id}`, body)),
  deactivate: (id) => data(client.delete(`/customers/${id}`)),
};

export const ordersApi = {
  list: (params) => data(client.get('/orders', { params })),
  get: (id) => data(client.get(`/orders/${id}`)),
  create: (body) => data(client.post('/orders', body)),
  cancel: (id) => data(client.post(`/orders/${id}/cancel`)),
};

export const approvalsApi = {
  list: (params) => data(client.get('/approvals', { params })),
  approve: (id, comments) => data(client.post(`/approvals/${id}/approve`, { comments })),
  reject: (id, comments) => data(client.post(`/approvals/${id}/reject`, { comments })),
};

export const inventoryApi = {
  transactions: (params) => data(client.get('/inventory/transactions', { params })),
  adjust: (body) => data(client.post('/inventory/adjustments', body)),
};

export const dashboardApi = {
  summary: (() => {
    let inFlight: Promise<unknown> | null = null;

    return () => {
      if (!inFlight) {
        inFlight = data(client.get('/dashboard/summary')).finally(() => {
          inFlight = null;
        });
      }
      return inFlight;
    };
  })(),
};

export { TOKEN_KEY };
