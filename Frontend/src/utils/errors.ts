// Backend error shape: { detail: string, code: string, errors: [{field, message}] }
export function getErrorMessage(error) {
  if (!error?.response) return error?.code === 'ECONNABORTED' ? 'The request timed out.' : 'Cannot reach the server. Please check your connection.';
  const { detail } = error.response.data || {};
  if (typeof detail === 'string') return detail;
  return `Request failed (${error.response.status})`;
}

// Individual messages (validation / stock problems) for display as a list.
export function getErrorList(error) {
  const errors = error?.response?.data?.errors;
  return Array.isArray(errors) ? errors.map((e) => (e.field && !e.field.startsWith('product:') ? `${e.field}: ${e.message}` : e.message)) : [];
}

// Map backend field errors onto form fields: { price: 'must be greater than 0' }
export function getFieldErrors(error) {
  const out = {};
  (error?.response?.data?.errors || []).forEach((e) => { if (e.field) out[e.field.split('.').pop()] = e.message; });
  return out;
}
