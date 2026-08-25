/** Design tokens partagés — module Comptabilité financière */
export const ACCOUNTANT_COLORS = {
  brandNavy: '#051161',
  brandBlue: '#1A73A3',
  brandTeal: '#50C2B9',
  slate900: '#0f172a',
  slate500: '#64748b',
  slate200: '#e8edf5',
  background: '#f8fafc',
  accentGreen: '#10b981',
  accentRed: '#ef4444',
  border: '#e8edf5',
};

export const accountantCardStyle = {
  borderRadius: 16,
  border: `1px solid ${ACCOUNTANT_COLORS.border}`,
  boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
};

export const formatFcfa = (val) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 })
    .format(val || 0)
    .replace('XAF', 'FCFA');
