export default function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'grid', gap: 4 }}>
        <h1 style={{ margin: 0, fontSize: 30, color: '#111827' }}>{title}</h1>
        {subtitle ? <p style={{ margin: 0, color: '#6B7280', fontSize: 14 }}>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
