export const cx = (...parts) => parts.filter(Boolean).join(' ');

export const baseControl = {
  minHeight: '40px',
  borderRadius: '12px',
  border: '1px solid var(--input-border)',
  background: 'var(--input-bg)',
  color: 'var(--input-text)',
  padding: '0 12px',
  fontSize: '14px',
  outline: 'none',
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  display: 'block'
};

export const focusRingStyle = {
  boxShadow: '0 0 0 3px var(--focus-ring)',
  borderColor: 'var(--color-primary)'
};
