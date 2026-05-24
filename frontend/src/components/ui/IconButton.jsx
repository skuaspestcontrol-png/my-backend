import { theme } from '../../styles/theme';

export default function IconButton({ children, size = 'md', label, ...props }) {
  const px = size === 'sm' ? 34 : size === 'lg' ? 44 : 40;
  return (
    <button
      type="button"
      aria-label={label}
      style={{
        width: px,
        height: px,
        borderRadius: 12,
        border: `1px solid ${theme.colors.border}`,
        background: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: theme.colors.text,
        cursor: 'pointer'
      }}
      {...props}
    >
      {children}
    </button>
  );
}
