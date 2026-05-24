import { theme } from '../../styles/theme';

export default function EmptyState({ title = 'No data found', message = 'Try adjusting your filters or add a new record.' }) {
  return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <h4 style={{ margin: 0, fontSize: 18, color: theme.colors.text, fontWeight: 800 }}>{title}</h4>
      <p style={{ margin: '6px 0 0', color: theme.colors.muted, fontSize: 14, fontWeight: 600 }}>{message}</p>
    </div>
  );
}
