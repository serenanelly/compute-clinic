/** Design tokens partagés — module Caissier (cohérence visuelle & IHM) */
export const CASHIER_COLORS = {
  brandBlue: '#1e3a8a',
  brandBlueLight: '#eff6ff',
  brandGray: '#475569',
  slate900: '#0f172a',
  slate500: '#64748b',
  slate200: '#e2e8f0',
  background: '#f8fafc',
  accentGreen: '#0f766e',
  accentRed: '#be123c',
  border: '#e2e8f0',
};

export const cardStyle = {
  borderRadius: 12,
  border: `1px solid ${CASHIER_COLORS.border}`,
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

export const filterCardStyle = {
  ...cardStyle,
  marginBottom: 24,
};

export const primaryButtonStyle = {
  backgroundColor: CASHIER_COLORS.brandBlue,
  borderRadius: 8,
};

export const formatFcfa = (val) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 })
    .format(val || 0)
    .replace('XAF', 'FCFA');
