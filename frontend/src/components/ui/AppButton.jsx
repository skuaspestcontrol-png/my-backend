import { theme } from '../../styles/theme';
import LoadingSpinner from './LoadingSpinner';

const variants = {
  primary: { bg: theme.colors.primary, fg: '#fff', border: theme.colors.primary, hover: theme.colors.primaryHover },
  secondary: { bg: 'color-mix(in srgb, var(--color-secondary) 16%, #ffffff)', fg: '#166534', border: 'color-mix(in srgb, var(--color-secondary) 35%, #ffffff)', hover: 'color-mix(in srgb, var(--color-secondary) 26%, #ffffff)' },
  outline: { bg: '#fff', fg: theme.colors.primary, border: 'color-mix(in srgb, var(--color-primary) 38%, #ffffff)', hover: theme.colors.softPink },
  danger: { bg: theme.colors.danger, fg: '#fff', border: theme.colors.danger, hover: '#B91C1C' },
  success: { bg: 'var(--color-success)', fg: '#fff', border: 'var(--color-success)', hover: '#15803D' },
  ghost: { bg: 'transparent', fg: theme.colors.text, border: 'transparent', hover: '#F3F4F6' }
};

export default function AppButton({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  iconLeft,
  iconRight,
  loading = false,
  disabled = false,
  style,
  ...props
}) {
  const s = theme.buttonSize[size] || theme.buttonSize.md;
  const v = variants[variant] || variants.primary;
  const iconSize = s.icon;
  const isDisabled = disabled || loading;

  const decorate = (node) => (node ? <span style={{ display: 'inline-flex', width: iconSize, height: iconSize }}>{node}</span> : null);

  return (
    <button
      type="button"
      disabled={isDisabled}
      aria-busy={loading}
      style={{
        minHeight: s.height,
        padding: `0 ${s.px}px`,
        width: fullWidth ? '100%' : 'auto',
        borderRadius: 10,
        border: `1px solid ${v.border}`,
        background: v.bg,
        color: v.fg,
        fontSize: theme.fontSize.sm,
        fontWeight: 700,
        letterSpacing: '0.01em',
        boxShadow: theme.shadow.sm,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.6 : 1,
        whiteSpace: 'nowrap',
        textAlign: 'center',
        ...style
      }}
      {...props}
    >
      {loading ? <LoadingSpinner size={iconSize} color={v.fg} /> : decorate(iconLeft)}
      <span>{children}</span>
      {!loading ? decorate(iconRight) : null}
    </button>
  );
}
