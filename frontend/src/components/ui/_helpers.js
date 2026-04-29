import { theme } from '../../styles/theme';

export const cx = (...parts) => parts.filter(Boolean).join(' ');

export const baseControl = {
  minHeight: `${theme.buttonSize.md.height}px`,
  borderRadius: `${theme.radius.md}px`,
  border: `1px solid ${theme.colors.border}`,
  background: '#fff',
  color: theme.colors.text,
  padding: '0 12px',
  fontSize: theme.fontSize.sm,
  outline: 'none',
  width: '100%'
};

export const focusRingStyle = {
  boxShadow: `0 0 0 3px rgba(159,23,77,0.2)`,
  borderColor: theme.colors.primary
};
