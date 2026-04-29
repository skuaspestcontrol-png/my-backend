import { theme } from '../../styles/theme';

const map = {
  active: theme.status.active,
  pending: theme.status.pending,
  danger: theme.status.danger,
  info: theme.status.info
};

export default function StatusBadge({ status = 'info', children }) {
  const tone = map[String(status).toLowerCase()] || theme.status.info;
  return <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: 24, borderRadius: 999, padding: '0 10px', fontSize: 12, fontWeight: 700, background: tone.bg, color: tone.fg }}>{children || status}</span>;
}
