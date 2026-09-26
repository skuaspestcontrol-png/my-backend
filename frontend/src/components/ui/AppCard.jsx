export default function AppCard({ children, title, action, style, headerStyle, bodyStyle, className }) {
  return (
    <section
      className={['crm-card', className].filter(Boolean).join(' ')}
      style={{
        overflow: 'hidden',
        background: 'var(--card-bg)',
        border: '1px solid var(--border-soft)',
        boxShadow: 'var(--shadow-card)',
        ...style
      }}
    >
      {title ? (
        <header className="crm-card-header" style={{
          padding: 16,
          borderBottom: '1px solid var(--card-header-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          background: 'var(--card-header-bg)',
          color: 'var(--card-header-text)',
          ...headerStyle
        }}>
          <h3 style={{ margin: 0, fontSize: 18, color: 'inherit' }}>{title}</h3>
          {action}
        </header>
      ) : null}
      <div className="crm-card-body" style={{ padding: 16, ...bodyStyle }}>{children}</div>
    </section>
  );
}
