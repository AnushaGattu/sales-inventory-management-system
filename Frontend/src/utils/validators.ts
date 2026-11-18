// Small client-side validators. They mirror (not replace) the backend rules, for instant feedback.
export const required = (v, label) => (String(v ?? '').trim() ? '' : `${label} is required`);

export const isEmail = (v) => (!v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Enter a valid email address');

export const isPhone = (v) => (!v || /^[0-9+\-() ]{7,20}$/.test(v) ? '' : 'Enter a valid phone number (7-20 digits)');

export const positiveNumber = (v, label) => {
  const n = Number(v);
  return v === '' || Number.isNaN(n) || n <= 0 ? `${label} must be greater than 0` : '';
};

export const nonNegativeInt = (v, label) => {
  const n = Number(v);
  return v === '' || !Number.isInteger(n) || n < 0 ? `${label} must be a whole number (0 or more)` : '';
};

export const positiveInt = (v, label) => {
  const n = Number(v);
  return v === '' || !Number.isInteger(n) || n < 1 ? `${label} must be a whole number (1 or more)` : '';
};

export const hasErrors = (errors) => Object.values(errors).some(Boolean);
