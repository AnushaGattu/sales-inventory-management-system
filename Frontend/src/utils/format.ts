let currency = 'INR';
export const setCurrency = (c) => { if (c) currency = c; };

export const formatCurrency = (value) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0));

export const formatNumber = (value) => new Intl.NumberFormat('en-IN').format(Number(value || 0));

export const formatDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-';

export const formatDate = (iso) =>
  iso ? new Date(iso + (iso.length <= 10 ? 'T00:00:00' : '')).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '-';
