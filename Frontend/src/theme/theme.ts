import { createTheme } from '@mui/material/styles';

// "No animation" requirement is enforced in three places: (1) theme.transitions.create returns 'none',
// (2) MUI components that animate get duration 0 / ripple off, (3) a global CSS reset below.
const noMotion = { transitionDuration: 0 };

const theme = createTheme({
  palette: {
    primary: { main: '#1565c0' },
    secondary: { main: '#455a64' },
    background: { default: '#f4f6f8' },
  },
  shape: { borderRadius: 8 },
  typography: { fontFamily: 'Roboto, Helvetica, Arial, sans-serif', h4: { fontWeight: 600 } },
  transitions: { create: () => 'none' },
  components: {
    MuiCssBaseline: {
      styleOverrides: `*, *::before, *::after { transition: none !important; animation: none !important; scroll-behavior: auto !important; }`,
    },
    MuiButtonBase: { defaultProps: { disableRipple: true } },
    MuiDialog: { defaultProps: noMotion },
    MuiMenu: { defaultProps: noMotion },
    MuiPopover: { defaultProps: noMotion },
    MuiDrawer: { defaultProps: { transitionDuration: 0 } },
    MuiSnackbar: { defaultProps: noMotion },
    MuiCollapse: { defaultProps: { timeout: 0 } },
    MuiTooltip: { defaultProps: { enterDelay: 0 } },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
    MuiTableCell: { styleOverrides: { head: { fontWeight: 600, backgroundColor: '#eef2f6' } } },
    MuiTableContainer: { styleOverrides: { root: { overflowX: 'auto', WebkitOverflowScrolling: 'touch' } } },
    MuiTable: { styleOverrides: { root: { minWidth: 640 } } },
    MuiTablePagination: {
      styleOverrides: {
        toolbar: { flexWrap: 'wrap', justifyContent: 'flex-end', paddingLeft: 8, paddingRight: 8 },
        selectLabel: { '@media (max-width: 599.95px)': { display: 'none' } },
        input: { '@media (max-width: 599.95px)': { display: 'none' } },
      },
    },
  },
});

export default theme;
