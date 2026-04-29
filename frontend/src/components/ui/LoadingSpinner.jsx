import { theme } from '../../styles/theme';

export default function LoadingSpinner({ size = 18, color = theme.colors.primary }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: '999px',
        border: `2px solid ${color}33`,
        borderTopColor: color,
        display: 'inline-block',
        animation: 'crm-spin 0.8s linear infinite'
      }}
    />
  );
}
