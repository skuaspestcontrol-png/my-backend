export default function EmptyState({ title = 'No data found', message = 'Try adjusting your filters or add a new record.' }) {
  return (
    <div className="portal-empty-state">
      <h4>{title}</h4>
      <p>{message}</p>
    </div>
  );
}
