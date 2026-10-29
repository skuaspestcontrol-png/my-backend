export const theme = {
  colors: {
    primary: 'var(--color-primary)',
    primaryHover: 'var(--color-primary-dark)',
    bg: 'var(--color-bg)',
    softPink: 'var(--color-primary-light)',
    card: 'var(--surface-card)',
    surface: 'var(--surface-card)',
    surfaceSoft: 'var(--surface-secondary)',
    borderSoft: 'var(--border-soft)',
    textSecondary: 'var(--text-secondary)',
    text: 'var(--color-text)',
    muted: 'var(--color-muted)',
    border: 'var(--brand-border-color)',
    success: '#16A34A',
    warning: '#F59E0B',
    danger: '#DC2626',
    info: '#2563EB'
  },
  fontSize: {
    xs: '12px',
    sm: '14px',
    md: '16px',
    lg: '18px',
    xl: '24px',
    '2xl': '30px'
  },
  buttonSize: {
    sm: { height: 34, icon: 16, px: 12 },
    md: { height: 40, icon: 18, px: 16 },
    lg: { height: 48, icon: 20, px: 20 }
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radius: { sm: 10, md: 12, lg: 16 },
  shadow: {
    sm: '0 1px 2px rgba(15,23,42,0.06)',
    md: '0 8px 24px rgba(15,23,42,0.08)'
  },
  status: {
    active: { bg: 'var(--status-active-bg)', fg: 'var(--status-active-text)' },
    pending: { bg: 'var(--status-pending-bg)', fg: 'var(--status-pending-text)' },
    danger: { bg: 'var(--status-danger-bg)', fg: 'var(--status-danger-text)' },
    info: { bg: 'var(--status-info-bg)', fg: 'var(--status-info-text)' }
  }
};

export const mq = {
  mobile: '@media (max-width: 767px)',
  tablet: '@media (min-width: 768px) and (max-width: 1023px)',
  desktop: '@media (min-width: 1024px)'
};
