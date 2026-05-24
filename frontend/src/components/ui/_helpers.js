import { theme } from '../../styles/theme';

export const cx = (...parts) => parts.filter(Boolean).join(' ');

export const baseControl = {
  minHeight: `${theme.buttonSize.md.height}px`,
  borderRadius: `${theme.radius.md}px`,
  border: `1px solid ${theme.colors.border}`,
  background: theme.colors.surface,
  color: theme.colors.text,
  padding: '0 12px',
  fontSize: theme.fontSize.sm,
  outline: 'none',
  width: '100%'
};

export const focusRingStyle = {
  boxShadow: '0 0 0 3px color-mix(in srgb, var(--color-primary) 22%, transparent)',
  borderColor: theme.colors.primary
};
