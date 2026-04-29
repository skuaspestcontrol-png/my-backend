export default function EmptyState({ title = 'No data found', message = 'Try adjusting your filters or add a new record.' }) {
  return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <h4 style={{ margin: 0, fontSize: 18, color: '#111827' }}>{title}</h4>
      <p style={{ margin: '6px 0 0', color: '#6B7280', fontSize: 14 }}>{message}</p>
    </div>
  );
}
