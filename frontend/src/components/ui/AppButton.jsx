import { theme } from '../../styles/theme';
import LoadingSpinner from './LoadingSpinner';

const variants = {
  primary: { bg: theme.colors.primary, fg: '#fff', border: theme.colors.primary, hover: theme.colors.primaryHover },
  secondary: { bg: theme.colors.softPink, fg: theme.colors.primary, border: '#FBCFE8', hover: '#FCE7F3' },
  outline: { bg: '#fff', fg: theme.colors.primary, border: '#9F174D66', hover: theme.colors.softPink },
  danger: { bg: theme.colors.danger, fg: '#fff', border: theme.colors.danger, hover: '#B91C1C' },
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
        borderRadius: 12,
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
        whiteSpace: 'normal',
        textAlign: 'left',
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
