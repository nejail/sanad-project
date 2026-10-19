// Design tokens taken from the SANAD high-fidelity Figma file.
export const colors = {
  bg: '#0f172a',
  surface: '#1e293b',
  surfaceAlt: '#162033',
  border: '#334155',
  primary: '#0ea5e9',
  primaryDark: '#0284c7',
  primarySoft: 'rgba(14,165,233,0.12)',
  text: '#f1f5f9',
  subtext: '#cbd5e1',
  muted: '#94a3b8',
  price: '#f5a524',
  success: '#22c55e',
  successSoft: 'rgba(34,197,94,0.15)',
  danger: '#ef4444',
  dangerSoft: 'rgba(239,68,68,0.12)',
  gold: '#d4af37',
  promoStart: '#a855f7',
  promoEnd: '#7c3aed',
};

export const radius = { sm: 8, md: 12, lg: 16, xl: 32 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };

export const font = {
  title: { fontSize: 28, fontWeight: '700' as const, color: colors.text },
  h2: { fontSize: 20, fontWeight: '700' as const, color: colors.text },
  h3: { fontSize: 16, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 15, color: colors.subtext },
  label: { fontSize: 13, fontWeight: '600' as const, color: colors.subtext },
  small: { fontSize: 12, color: colors.muted },
};
